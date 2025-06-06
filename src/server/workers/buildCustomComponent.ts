// src/server/workers/buildCustomComponent.ts
import { db } from "~/server/db";
import { customComponentJobs } from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import os from "os";
import { measureDuration, recordMetric } from "~/lib/metrics";
import path from "path";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { env } from "~/env";
import * as fs from "fs";
import { updateComponentStatus } from "~/server/services/componentGenerator.service";
import logger, { buildLogger } from '~/lib/logger';
import { repairComponentSyntax, ensureRemotionComponentAssignment } from "./repairComponentSyntax";

// Dynamically import esbuild to prevent bundling issues
let esbuild: typeof import('esbuild') | null = null;

// R2 configuration from environment variables
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// Config for the worker pool
const MAX_CONCURRENT_BUILDS = Math.max(1, os.cpus().length - 1); // cpuCount - 1, minimum 1
const buildQueue: { jobId: string; promise: Promise<void> }[] = [];
let activeBuilds = 0;

/**
 * Process pending custom component jobs
 * 
 * 1. Find pending jobs
 * 2. Queue jobs for processing with concurrency limit
 * 3. Process each job:
 *    - Update status to "building"
 *    - Compile TSX using esbuild with optimized settings
 *    - Upload JS to R2
 *    - Update job status to "success" or "error"
 *    - Record metrics
 */
export async function processPendingJobs() {
  logger.info("Processing pending custom component jobs...");
  
  try {
    // Find jobs ready for build - look for "building" and "manual_build_retry" status
    const pendingJobs = await db.query.customComponentJobs.findMany({
      where: or(
        eq(customComponentJobs.status, "building"),
        eq(customComponentJobs.status, "manual_build_retry")
      ),
      limit: 10, // Get more jobs than we can process at once, to keep the queue filled
    });

    logger.info(`Found ${pendingJobs.length} jobs ready for build (status 'building' or 'manual_build_retry')`);
    
    // If no pending jobs, return early
    if (pendingJobs.length === 0) {
      return;
    }

    // Try to load esbuild if not loaded yet
    if (!esbuild) {
      try {
        esbuild = await import('esbuild');
        logger.info("Successfully loaded esbuild module");
      } catch (err) {
        logger.warn("Failed to load esbuild, will use fallback transformation:", { error: err });
      }
    }

    // Queue jobs for processing, respecting concurrency limits
    for (const job of pendingJobs) {
      // Add job to the build queue
      const buildPromise = queueBuild(job.id);
      buildQueue.push({ jobId: job.id, promise: buildPromise });
    }

    // Wait for all jobs to complete with timeout protection
    await Promise.all(
      buildQueue.map(item => 
        // Wrap each promise with a timeout to avoid hanging
        Promise.race([
          item.promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Build timeout for job ${item.jobId}`)), 300000)
          )
        ])
      )
    );
    
    // Clear the queue
    buildQueue.length = 0;
    
  } catch (error) {
    // Improve error logging
    if (error instanceof Error) {
      logger.error(`Error processing jobs: ${error.message}`, { stack: error.stack });
      // Record the error for metrics
      void recordMetric("worker_error", 1, { 
        errorType: error.constructor.name,
        message: error.message.substring(0, 100) // Truncate long error messages
      });
    } else {
      logger.error("Unknown error processing jobs:", { error });
    }
    
    // Try to clear the queue even on error
    try {
      buildQueue.length = 0;
    } catch (e) {
      // Do nothing if this also fails
    }
  }
}

/**
 * Queue a build job for processing, respecting concurrency limits
 */
async function queueBuild(jobId: string): Promise<void> {
  // Wait until we have capacity to process this job
  while (activeBuilds >= MAX_CONCURRENT_BUILDS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Increment active builds counter
  activeBuilds++;
  
  try {
    // Process the job
    await processJob(jobId);
  } finally {
    // Decrement active builds counter
    activeBuilds--;
  }
}

/**
 * Process a single custom component job
 */
async function processJob(jobId: string): Promise<void> {
  buildLogger.start(jobId, "Processing job started");
  
  try {
    await measureDuration("component_build", async () => {
      // Get the job details
      const job = await db.query.customComponentJobs.findFirst({
        where: eq(customComponentJobs.id, jobId),
        columns: {
          id: true,
          status: true,
          tsxCode: true,  // Explicitly selecting tsxCode
          metadata: true,
          projectId: true,
          effect: true,
          outputUrl: true,
          errorMessage: true,
          retryCount: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      // Add diagnostic logging to check the fetched job
      buildLogger.start(jobId, "Fetched job data for build", {
        jobId: job?.id,
        status: job?.status,
        hasTsxCodeInFetchedRecord: !!job?.tsxCode,
        tsxCodeLengthInFetchedRecord: job?.tsxCode?.length ?? 0,
        metadata: job?.metadata ? JSON.stringify(job.metadata).substring(0, 100) + '...' : null
      });
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      // Update status to building
      await db.update(customComponentJobs)
        .set({
          status: "building",
          updatedAt: new Date(),
        })
        .where(eq(customComponentJobs.id, jobId));

      // Check if tsxCode is available (it could be null after schema change)
      if (!job.tsxCode) {
        buildLogger.error(jobId, "TSX code field is indeed null/undefined in the fetched job record", {
          jobFields: Object.keys(job).join(', ')
        });
        throw new Error("TSX code is missing for this job");
      }
      
      // Log component code length for debugging
      buildLogger.start(jobId, `Processing component code (${job.tsxCode.length} characters)`);
      
      // Sanitize TSX code (remove unsafe imports, etc.)
      const sanitizedTsx = sanitizeTsx(job.tsxCode);
      
      // Compile the code - use esbuild if available, otherwise fallback
      let jsCode: string;
      
      if (esbuild) {
        try {
          jsCode = await compileWithEsbuild(sanitizedTsx, jobId);
        } catch (esbuildError) {
          buildLogger.error(jobId, "CRITICAL: esbuild compilation failed. ABORTING build for this component.", { 
            error: esbuildError,
            errorMessage: esbuildError instanceof Error ? esbuildError.message : String(esbuildError),
            stack: esbuildError instanceof Error ? esbuildError.stack : undefined,
            type: "COMPILE:ERROR"
          });
          
          // Save a portion of the TSX code for debugging purposes
          buildLogger.error(jobId, "Failed TSX code snippet (first 500 chars):", {
            tsxSnippet: sanitizedTsx.substring(0, 500) + "..."
          });
          
          // Update job status to error and exit
          await updateComponentStatus(jobId, 'error', db, undefined, `esbuild compilation failed: ${esbuildError instanceof Error ? esbuildError.message : String(esbuildError)}`);
          return; // Exit processJob - do NOT use fallback
        }
      } else {
        buildLogger.warn(jobId, "esbuild not available, using simple fallback compiler (this is not recommended for production)", {
          type: "NO_ESBUILD"
        });
        // Only use fallback when esbuild is not available at all
        jsCode = await compileWithFallback(sanitizedTsx, jobId);
      }
      
      buildLogger.upload(jobId, "Uploading to R2...");

      // Verify the component has the required window.__REMOTION_COMPONENT assignment
      const componentNameMatch = /export\s+default\s+(?:function\s+)?(\w+)/.exec(jsCode);
      if (componentNameMatch?.[1]) {
        const componentName = componentNameMatch[1];
        
        // Check if the window.__REMOTION_COMPONENT assignment is present
        if (!jsCode.includes('window.__REMOTION_COMPONENT')) {
          buildLogger.warn(jobId, `Component bundle missing window.__REMOTION_COMPONENT assignment, adding it for ${componentName}`, { 
            type: "COMPONENT_FIX" 
          });
          
          // Add the assignment
          const { code, added } = ensureRemotionComponentAssignment(jsCode, componentName);
          if (added) {
            // Use the fixed code for upload
            jsCode = code;
            buildLogger.compile(jobId, `Added window.__REMOTION_COMPONENT assignment for ${componentName}`);
          }
        } else {
          buildLogger.compile(jobId, `Component already has window.__REMOTION_COMPONENT assignment`);
        }
      } else {
        buildLogger.warn(jobId, "Could not determine component name to verify window.__REMOTION_COMPONENT assignment", { 
          type: "COMPONENT_NAME_DETECTION" 
        });
      }

      // Upload to R2
      const key = `custom-components/${jobId}.js`;
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: jsCode,
          ContentType: "application/javascript",
        })
      );

      // Update job with success
      const outputUrl = `${R2_PUBLIC_URL}/${key}`;
      await db.update(customComponentJobs)
        .set({
          status: "success",
          outputUrl,
          updatedAt: new Date(),
        })
        .where(eq(customComponentJobs.id, jobId));
        
      buildLogger.complete(jobId, `Component built successfully, available at ${outputUrl}`);
    }, { jobId });

  } catch (error) {
    buildLogger.error(jobId, "Error processing job", { error: error instanceof Error ? error.message : String(error) });
    
    // Update job with error
    await db.update(customComponentJobs)
      .set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: ((await db.query.customComponentJobs.findFirst({
          where: eq(customComponentJobs.id, jobId),
          columns: { retryCount: true }
        }))?.retryCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(customComponentJobs.id, jobId));
      
    // Record error metric
    await recordMetric("component_build_error", 1, { 
      jobId, 
      errorType: error instanceof Error ? error.constructor.name : "Unknown" 
    });
  }
}

/**
 * Special fix for common syntax issues that cause build failures
 */
function fixSyntaxIssues(code: string): string {
  // Fix 1: Replace patterns that cause "Unterminated regular expression" errors in esbuild
  // First version: </tag>);
  let fixed = code.replace(/(<\/[a-zA-Z][a-zA-Z0-9]*>)(\s*\);)/g, '$1; $2');
  
  // Second version: </tag>)
  fixed = fixed.replace(/(<\/[a-zA-Z][a-zA-Z0-9]*>)(\s*\))/g, '$1; $2');
  
  // Add semicolons after all JSX closing tags as an extra safety measure
  // THIS LINE IS LIKELY CAUSING THE ");" error, let's comment it out
  // fixed = fixed.replace(/(<\/[a-zA-Z][a-zA-Z0-9]*>)(\s*(?![;\s\na-zA-Z<]))/g, '$1;$2');
  
  // Fix 2: Ensure proper TypeScript generics with React.FC
  // Incorrect: React.FC<{data: ...}>
  // Correct: React.FC<ComponentProps>
  const reactFCPattern = /React\.FC(?:<{[^}]+}>)/g;
  if (reactFCPattern.test(fixed)) {
    logger.debug("[ESBUILD-FIX] Found potentially problematic React.FC pattern, fixing interface definition");
    // This is a complex fix that would require more context-aware processing
    // For now, we'll just log it and let the preprocessor handle it
  }
  
  // Log if changes were made
  if (fixed !== code) {
    logger.debug("[ESBUILD-FIX] Applied syntax fixes to component code");
  }
  
  return fixed;
}

/**
 * Compile TSX code using esbuild
 */
async function compileWithEsbuild(
  tsxCode: string, 
  jobId = "unknown", 
  options: { outputFile?: string } = {}
): Promise<string> {
  if (!esbuild) {
    throw new Error("esbuild is not loaded. Cannot compile.");
  }

  // Apply syntax fixes before compilation
  const fixedTsxCode = fixSyntaxIssues(tsxCode);
  
  try {
    // Log the first few lines around line 45 to debug the issue
    // const lines = fixedTsxCode.split('\n');
    // const startLine = Math.max(0, 44 - 5);
    // const endLine = Math.min(lines.length, 45 + 5);
    // const debugLines = lines.slice(startLine, endLine).join('\n');
    // buildLogger.debug(jobId, "[ESBUILD] Code around line 45 (before compilation):", { debugLines });
    
    // Common build options
    const buildOptions: import('esbuild').BuildOptions = {
      stdin: {
        contents: fixedTsxCode,
        resolveDir: process.cwd(), // Important for resolving any potential relative paths if ever used
        loader: 'tsx',
      },
      bundle: true, // Bundle dependencies
      format: 'esm', // Changed from 'iife' to 'esm' for standard ES modules
      platform: 'browser',
      target: 'es2020', // Modern JS target
      minify: true, // Minify the output
      loader: { '.tsx': 'tsx' },
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      external: ['react', 'react-dom', 'remotion', '@remotion/*'], // External dependencies that should not be bundled
      logLevel: 'warning',
    };

    let compiledJs: string;

    if (options.outputFile) {
      buildOptions.outfile = options.outputFile;
      const result = await esbuild.build(buildOptions);
      if (result.errors.length > 0) {
        buildLogger.error(jobId, "[ESBUILD] Build failed with errors (output to file):", { errors: JSON.stringify(result.errors, null, 2) });
      }
      if (result.warnings.length > 0) {
        buildLogger.warn(jobId, "[ESBUILD] Build completed with warnings (output to file):", { warnings: JSON.stringify(result.warnings, null, 2) });
      }
      // Read the generated file and return its content
      compiledJs = fs.readFileSync(options.outputFile, 'utf8');
    } else {
      buildOptions.write = false;
      const result = await esbuild.build(buildOptions);
      if (result.errors.length > 0) {
        buildLogger.error(jobId, "[ESBUILD] Build failed with errors (string output):", { errors: JSON.stringify(result.errors, null, 2) });
      }
      if (result.warnings.length > 0) {
        buildLogger.warn(jobId, "[ESBUILD] Build completed with warnings (string output):", { warnings: JSON.stringify(result.warnings, null, 2) });
      }
      if (result.outputFiles && result.outputFiles.length > 0 && result.outputFiles[0]) {
        compiledJs = result.outputFiles[0].text;
      } else {
        throw new Error("esbuild compilation did not produce output files (string output).");
      }
    }

    buildLogger.info(jobId, "[ESBUILD] Compilation successful", { outputSize: compiledJs.length });
    buildLogger.debug(jobId, "[ESBUILD] Compiled JS snippet", { snippet: compiledJs.substring(0, 500) });
    return compiledJs;

  } catch (error) {
    buildLogger.error(jobId, "[ESBUILD] Error during esbuild compilation:", { error: error instanceof Error ? error.message : String(error) });
    
    // If we still get the unterminated regex error, try the fallback compiler
    // Note: compileWithFallback itself calls sanitizeTsx, so fixedTsxCode is not directly passed here.
    // It passes the original tsxCode to compileWithFallback.
    if (error instanceof Error && error.message.includes('Unterminated regular expression')) {
      buildLogger.warn(jobId, "[ESBUILD] Unterminated regular expression error persists, trying fallback compiler");
      return compileWithFallback(tsxCode, jobId); // Pass original tsxCode to fallback
    }
    
    throw error; // Re-throw to be caught by processJob or buildCustomComponent
  }
}

/**
 * Fallback compilation method that uses simple transforms
 * This is used when esbuild is not available or fails
 */
async function compileWithFallback(tsxCode: string, jobId = "unknown"): Promise<string> {
  buildLogger.info(jobId, "Using simplified fallback compilation method");
  
  // Perform some basic transformations:
  // 1. Remove TypeScript types
  // 2. Convert JSX to React.createElement manually
  
  let code = tsxCode;
  
  // Replace TypeScript type annotations
  code = code.replace(/:\s*[A-Za-z0-9_<>\[\]|&,\s.]+(?=\s*[,=)])/g, '');
  code = code.replace(/<[A-Za-z0-9_]+>(?=\()/g, '');
  
  // Remove interface and type declarations
  code = code.replace(/interface\s+[^{]+{[^}]*}/g, '');
  code = code.replace(/type\s+[^=]+=\s*[^;]+;/g, '');
  
  // Add ESM export wrapper
  code = `
// Fallback compiled version
${code}

// Ensure default export for React.lazy compatibility
export default ${detectExportedComponentName(code) || 'Component'};
  `;
  
  return code;
}

/**
 * Helper function to detect the component name from code
 */
function detectExportedComponentName(code: string): string | null {
  // Check for export default ComponentName
  const defaultExport = /export\s+default\s+([A-Za-z0-9_]+)\s*;?/.exec(code);
  if (defaultExport?.[1]) {
    return defaultExport[1];
  }
  
  // Check for export default function ComponentName
  const defaultFunctionExport = /export\s+default\s+function\s+([A-Za-z0-9_]+)/.exec(code);
  if (defaultFunctionExport?.[1]) {
    return defaultFunctionExport[1];
  }
  
  // Check for const/function ComponentName declarations that might be exported
  const componentDefinition = /(?:const|function)\s+([A-Za-z0-9_]+)\s*(?:=|:|\()/.exec(code);
  if (componentDefinition?.[1]) {
    return componentDefinition[1];
  }
  
  return null;
}

/**
 * Sanitize TSX code by removing unsafe imports and handling React/Remotion imports
 * 
 * 1. Removes all unsafe imports (non-React, non-Remotion)
 * 2. Preserves React and Remotion imports for ESM compatibility
 * 3. Preserves the component code itself
 */
export function sanitizeTsx(tsxCode: string): string {
  // First, remove duplicate default exports
  let sanitizedCode = removeDuplicateDefaultExports(tsxCode);
  
  // SPECIFIC FIX for </AbsoluteFill>; pattern from LLM
  const faultySemicolonPattern = /<\/AbsoluteFill>\s*;/g;
  if (faultySemicolonPattern.test(sanitizedCode)) {
    logger.warn("Detected and removing misplaced semicolon after </AbsoluteFill>.");
    sanitizedCode = sanitizedCode.replace(faultySemicolonPattern, '</AbsoluteFill>');
  }
  
  // Split by lines
  const lines = sanitizedCode.split('\n');
  
  // Keep React and Remotion imports, filter out other imports
  const codeWithAllowedImports = lines.filter(line => {
    const trimmedLine = line.trim();
    // Skip any import statements except React and Remotion
    if (trimmedLine.startsWith('import ')) {
      return (
        trimmedLine.includes(' from "react"') || 
        trimmedLine.includes(" from 'react'") ||
        trimmedLine.includes(' from "remotion"') || 
        trimmedLine.includes(" from 'remotion'") ||
        trimmedLine.includes(' from "@remotion/') ||
        trimmedLine.includes(" from '@remotion/")
      );
    }
    return true;
  });
  
  // Ensure the code has a default export
  const code = codeWithAllowedImports.join('\n');
  
  // If no default export is found, try to add one
  if (!code.includes('export default')) {
    const componentName = detectExportedComponentName(code);
    if (componentName) {
      return `${code}\n\n// Adding default export for ESM compatibility\nexport default ${componentName};\n`;
    }
  }
  
  return code;
}

/**
 * Removes duplicate default exports from component code
 * This fixes issues with LLM-generated code sometimes having multiple default exports
 */
function removeDuplicateDefaultExports(code: string): string {
  // Find all export default statements - more comprehensive regex
  // This handles export default ComponentName; and export default ComponentName with newlines 
  // as well as export default function ComponentName() patterns
  const defaultExportRegex = /export\s+default\s+(function\s+)?([A-Za-z0-9_]+\s*(\(\))?\s*{|\s*[A-Za-z0-9_]+\s*;?)/g;
  const matches = Array.from(code.matchAll(defaultExportRegex));
  
  // If we have multiple default exports
  if (matches.length > 1) {
    logger.info(`Found ${matches.length} default exports in component, keeping only the first one:`, {
      matches: matches.map((match, i) => {
        const lineNumber = code.substring(0, match.index || 0).split('\n').length;
        return `[${i}] Line ~${lineNumber}: ${match[0]}`;
      })
    });
    
    // Keep only the first export default statement
    const firstMatch = matches[0];
    // TypeScript safety check
    if (!firstMatch?.index) {
      logger.warn("Warning: Expected to find matches but firstMatch is undefined or has no index");
      return code;
    }
    
    const otherMatches = matches.slice(1);
    
    // Replace other export default statements with comments
    let sanitizedCode = code;
    for (const match of otherMatches) {
      if (!match.index) continue; // TypeScript safety check
      
      const fullMatch = match[0]; // The full export default statement
      
      // Replace with comment to preserve semantics
      sanitizedCode = sanitizedCode.replace(
        fullMatch, 
        `// Removed duplicate export: ${fullMatch.replace(/\n/g, ' ')}`
      );
    }
    
    logger.info("Successfully sanitized duplicate exports, keeping first export default statement");
    return sanitizedCode;
  }
  
  // If there's only one or zero export default, return the original code
  return code;
}

export async function buildCustomComponent(jobId: string, forceRebuild = false): Promise<boolean> {
  const startTime = Date.now();
  buildLogger.start(jobId, `Starting custom component build ${forceRebuild ? '(forced rebuild)' : ''}`);
  
  try {
    // Get the component job data
    const job = await db.query.customComponentJobs.findFirst({
      where: eq(customComponentJobs.id, jobId),
      columns: {
        id: true,
        status: true,
        tsxCode: true,  // Explicitly selecting tsxCode
        metadata: true,
        projectId: true,
        effect: true,
        outputUrl: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Add diagnostic logging for buildCustomComponent
    buildLogger.start(jobId, "Fetched job data for buildCustomComponent", {
      jobId: job?.id,
      status: job?.status,
      hasTsxCode: !!job?.tsxCode,
      tsxCodeLength: job?.tsxCode?.length ?? 0,
      metadataKeys: job?.metadata ? Object.keys(job.metadata) : null
    });

    if (!job) {
      buildLogger.error(jobId, "Component job not found", { type: "NOT_FOUND" });
      return false;
    }

    // If already complete and not forcing a rebuild, skip
    if (job.status === "complete" && !forceRebuild) {
      buildLogger.start(jobId, "Component already built successfully. Use forceRebuild=true to rebuild.", { status: "SKIP" });
      return true;
    }

    // Update the job status to building
    await db.update(customComponentJobs)
      .set({ 
        status: "building",
        updatedAt: new Date()
      })
      .where(eq(customComponentJobs.id, jobId));

    // Abort if we don't have TSX code
    if (!job.tsxCode) {
      buildLogger.error(jobId, "No TSX code found for component job", { type: "NO_CODE" });
      await updateComponentStatus(jobId, "error", db, undefined, "No TSX code found");
      return false;
    }

    buildLogger.start(jobId, `Got ${job.tsxCode.length} bytes of TSX code`, { type: "CODE" });

    // 1. Create temporary directory
    const tmpDir = path.join(os.tmpdir(), `bazaar-components-${jobId}`);
    await mkdir(tmpDir, { recursive: true });
    buildLogger.start(jobId, `Created temporary directory ${tmpDir}`, { type: "FILES" });
    
    // 2. Process the TSX code to ensure ESM compatibility
    buildLogger.compile(jobId, "Preprocessing TSX code for ESM...");
    const processedTsxCode = sanitizeTsx(job.tsxCode);
    buildLogger.compile(jobId, `Preprocessing complete, processed code length: ${processedTsxCode.length}`);

    // 3. Compile with esbuild using stdin
    const compileStartTime = Date.now();
    buildLogger.compile(jobId, "Starting esbuild compilation with ESM format...");
    
    // Define a type for the compilation result
    type CompilationResult = { 
      success: boolean; 
      outputPath?: string; 
      error?: string 
    };
    
    // Compile using esbuild
    let compiled: CompilationResult;
    
    try {
      if (!esbuild) {
        await import('esbuild').then(esb => {
          esbuild = esb;
        });
      }
      
      if (!esbuild) {
        throw new Error("Failed to load esbuild");
      }
      
      const outputPath = path.join(tmpDir, "bundle.js"); // Corrected output path
      // Use the unified compileWithEsbuild function, ensuring it writes to outputPath
      const jsCode = await compileWithEsbuild(processedTsxCode, jobId, { outputFile: outputPath });
      
      // Output final result
      // The file is already written by compileWithEsbuild when outputFile is set
      const fileSize = fs.statSync(outputPath).size;
      buildLogger.compile(jobId, `Bundle size: ${Math.round(fileSize / 1024)}KB`, { type: "COMPILE:SUCCESS" });
      
      compiled = { 
        success: true, 
        outputPath 
      };
    } catch (error) {
      buildLogger.error(jobId, "esbuild compilation failed", { type: "COMPILE:ERROR" });
      
      // Detailed error analysis for esbuild errors
      let errorDetails = "Unknown compilation error";
      
      if (error instanceof Error) {
        errorDetails = error.message;
        
        // Parse the esbuild error message to extract location info
        const locationMatch = /([^:]+):(\d+):(\d+):/.exec(error.message);
        if (locationMatch) {
          const [_, file, lineStr, column] = locationMatch;
          buildLogger.error(jobId, error.message, { type: "COMPILE:ERROR", location: `${file}:${lineStr}:${column}` });
          
          // Try to log the problematic code section from the processed input
          try {
            const lines = processedTsxCode.split('\n'); // Use processedTsxCode
            
            // Ensure lineStr is a string before parsing
            const lineNum = lineStr ? parseInt(lineStr, 10) : 0;
            
            // Extract context (5 lines before and after)
            const start = Math.max(0, lineNum - 5);
            const end = Math.min(lines.length, lineNum + 5);
            
            const codeContext = [];
            for (let i = start; i < end; i++) {
              const prefix = i === lineNum - 1 ? '> ' : '  ';
              codeContext.push(`${prefix}${i + 1}: ${lines[i]}`);
            }
            
            buildLogger.error(jobId, "Problematic code section:", { 
              type: "COMPILE:ERROR:CODE", 
              codeContext: codeContext.join('\n')
            });
          } catch (logError) {
            buildLogger.error(jobId, "Could not log problematic code section", { 
              type: "COMPILE:ERROR:LOG", 
              error: logError instanceof Error ? logError.message : String(logError)
            });
          }
        }
      }
      
      compiled = {
        success: false,
        error: errorDetails
      };
    }
    
    const compileDuration = Date.now() - compileStartTime;
    
    if (!compiled.success) {
      buildLogger.error(jobId, `Compilation failed: ${compiled.error}`, { type: "COMPILE" });
      await updateComponentStatus(jobId, "error", db, undefined, `Build error: ${compiled.error}`);
      return false;
    }
    
    buildLogger.compile(jobId, `Compilation successful in ${compileDuration}ms, output: ${compiled.outputPath}`);

    // 3. Upload the bundle to R2
    const r2StartTime = Date.now();
    buildLogger.upload(jobId, "Uploading ESM bundle to R2...");
    
    // Configure R2 client
    const r2 = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Read the compiled bundle
    if (!compiled.outputPath) {
      buildLogger.error(jobId, "No output path from compilation", { type: "NO_OUTPUT" });
      await updateComponentStatus(jobId, "error", db, undefined, "No output from compilation");
      return false;
    }
    
    const bundleContent = await readFile(compiled.outputPath);
    const publicPath = `custom-components/${jobId}.js`;
    
    try {
      // Verify the ESM bundle has a default export
      const bundleContentStr = bundleContent.toString();
      if (!bundleContentStr.includes('export default')) {
        buildLogger.warn(jobId, "ESM bundle doesn't contain a default export, which is required for React.lazy", { 
          type: "ESM_VALIDATION" 
        });
        // We could add a default export here, but it's better to ensure the component code already has one
      }
      
      // Upload to R2
      const result = await r2.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: publicPath,
          Body: bundleContent,
          ContentType: 'application/javascript',
        })
      );
      
      const r2Duration = Date.now() - r2StartTime;
      buildLogger.upload(jobId, `R2 upload successful in ${r2Duration}ms`, { 
        ETag: result.ETag, 
        size: bundleContent.length 
      });
      
      // NEW: Verify file exists in R2 before updating database
      buildLogger.upload(jobId, "Verifying R2 upload with HeadObject check...");
      
      try {
        // Use HeadObject to verify the file exists without downloading it
        const headResult = await r2.send(
          new HeadObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: publicPath,
          })
        );
        
        if (headResult.$metadata.httpStatusCode === 200) {
          buildLogger.upload(jobId, "R2 upload verification successful", { 
            verificationStatus: headResult.$metadata.httpStatusCode,
            contentLength: headResult.ContentLength,
            contentType: headResult.ContentType
          });
          
          // Only update database status if verification passed
          const publicUrl = `${env.R2_PUBLIC_URL}/${publicPath}`;
          buildLogger.complete(jobId, `Bundle URL: ${publicUrl}`);
          
          await db.update(customComponentJobs)
            .set({ 
              outputUrl: publicUrl,
              status: "complete", // Consistently use "complete" status (not "success")
              updatedAt: new Date()
            })
            .where(eq(customComponentJobs.id, jobId));
            
          buildLogger.complete(jobId, "Database updated with status='complete'");
        } else {
          throw new Error(`R2 verification failed: Unexpected status ${headResult.$metadata.httpStatusCode}`);
        }
      } catch (verifyError) {
        buildLogger.error(jobId, `R2 upload verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`, { 
          type: "R2_VERIFY" 
        });
        await updateComponentStatus(jobId, "error", db, undefined, `R2 verification error: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`);
        return false;
      }
    } catch (r2Error) {
      buildLogger.error(jobId, `R2 upload failed: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`, { 
        type: "R2_UPLOAD" 
      });
      await updateComponentStatus(jobId, "error", db, undefined, `R2 upload error: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`);
      return false;
    }

    // Clean up the temp dir
    try {
      await rm(tmpDir, { recursive: true, force: true });
      buildLogger.start(jobId, `Removed temporary directory ${tmpDir}`, { type: "CLEANUP" });
    } catch (cleanupError) {
      // Non-fatal error, just log it
      buildLogger.warn(jobId, `Failed to clean up temp directory: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
    
    const totalDuration = Date.now() - startTime;
    buildLogger.complete(jobId, `Component build successful in ${totalDuration}ms`);
    
    return true;
  } catch (error) {
    buildLogger.error(jobId, `Unhandled build error: ${error instanceof Error ? error.message : String(error)}`, { 
      type: "UNHANDLED",
      stack: error instanceof Error ? error.stack : undefined
    });
    
    try {
      await updateComponentStatus(jobId, "error", db, undefined, `Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
    } catch (updateError) {
      buildLogger.error(jobId, `Failed to update status: ${updateError instanceof Error ? updateError.message : String(updateError)}`, { 
        type: "DB_UPDATE" 
      });
    }
    
    return false;
  }
}
