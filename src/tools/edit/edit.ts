import { BaseMCPTool } from "~/tools/helpers/base";
import { AIClientService } from "~/server/services/ai/aiClient.service";
import { getModel, getIndividualModel } from "~/config/models.config";
import { getSystemPrompt } from "~/config/prompts.config";
import type { EditToolInput, EditToolOutput } from "~/tools/helpers/types";
import { editToolInputSchema } from "~/tools/helpers/types";

/**
 * EDIT Tool - Pure function that transforms scene content
 * NO DATABASE ACCESS - only transformation
 * Sprint 42: Refactored to pure function
 */
export class EditTool extends BaseMCPTool<EditToolInput, EditToolOutput> {
  name = "EDIT";
  description = "Transform existing scene content based on user prompt";
  inputSchema = editToolInputSchema;

  protected async execute(input: EditToolInput): Promise<EditToolOutput> {
    try {
      // Validate input
      if (!input.tsxCode) {  // ✓ Using correct field name
        throw new Error("No scene code provided");
      }

      console.log('✏️ [EDIT TOOL] Executing edit:', {
        prompt: input.userPrompt,
        hasErrorDetails: !!input.errorDetails,
        codeLength: input.tsxCode.length
      });

      // Just edit the code - one unified approach
      console.log('✏️ [EDIT TOOL] Processing edit request');
      return await this.performEdit(input);
      
    } catch (error) {
      console.error('✏️ [EDIT TOOL] Error:', error);
      return {
        success: false,
        reasoning: `Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as EditToolOutput;
    }
  }

  private async performEdit(input: EditToolInput): Promise<EditToolOutput> {
    try {
      const functionName = this.extractFunctionName(input.tsxCode);
      
      // Build context for the AI
      let context = `USER REQUEST: "${input.userPrompt}"`;
      
      if (input.errorDetails) {
        context += `\n\nERROR TO FIX:\n${input.errorDetails}`;
      }
      
      if (input.webContext) {
        context += `\n\nWEBSITE BRAND CONTEXT:
- URL: ${input.webContext.originalUrl}
- Title: ${input.webContext.pageData.title}
- Description: ${input.webContext.pageData.description || 'Not available'}
- Key headings: ${input.webContext.pageData.headings.slice(0, 5).join(', ')}

BRAND MATCHING INSTRUCTIONS:
- Use the website screenshots to match the brand's visual identity
- Extract and apply colors, fonts, and design patterns from the screenshots
- Maintain brand consistency in your edits`;
      }
      
      if (input.imageUrls?.length) {
        context += `\n\nIMAGE CONTEXT: User provided ${input.imageUrls.length} image(s)`;
      }
      
      if (input.videoUrls?.length) {
        context += `\n\nVIDEO CONTEXT: User provided ${input.videoUrls.length} video(s)`;
        context += `\nVIDEO URLS: ${input.videoUrls.map((url, i) => `\nVideo ${i + 1}: ${url}`).join('')}`;
      }
      
      
      // Add reference scenes for style/color matching
      if (input.referenceScenes?.length) {
        context += `\n\nREFERENCE SCENES FOR STYLE/COLOR MATCHING:`;
        input.referenceScenes.forEach((scene) => {
          context += `\n\n${scene.name} (ID: ${scene.id}):\n\`\`\`tsx\n${scene.tsxCode}\n\`\`\``;
        });
        context += `\n\nIMPORTANT: Extract the specific colors, styles, animations, or patterns from the reference scenes that the user wants to apply. Be precise in matching the requested elements.`;
      }

      // Build message content based on available context
      let messageContent: any;
      
      // Prepare all available images (web screenshots + user images)
      const allImageUrls: string[] = [];
      if (input.webContext) {
        allImageUrls.push(input.webContext.screenshotUrls.desktop);
        allImageUrls.push(input.webContext.screenshotUrls.mobile);
      }
      if (input.imageUrls?.length) {
        allImageUrls.push(...input.imageUrls);
      }
      
      if (allImageUrls.length > 0) {
        // Build vision content array for image-based edits
        const contextInstructions = input.webContext 
          ? 'IMPORTANT: The first two images are website screenshots for brand matching. Use them to understand the brand\'s visual identity, colors, and design patterns. ' +
            (input.imageUrls?.length ? `The additional ${input.imageUrls.length} image(s) show specific content requirements. ` : '') +
            'Apply the brand style while incorporating any specific visual requirements from additional images.'
          : 'IMPORTANT: Look at the provided image(s) and recreate the visual elements from the image in the scene code. Match colors, layout, text, and visual hierarchy as closely as possible.';
        
        messageContent = [
          { 
            type: 'text', 
            text: `${context}

EXISTING CODE:
\`\`\`tsx
${input.tsxCode}
\`\`\`

${contextInstructions} Return the complete modified code.`
          }
        ];
        
        // Add all images (web screenshots first, then user images)
        for (const imageUrl of allImageUrls) {
          messageContent.push({
            type: 'image_url',
            image_url: { url: imageUrl }
          });
        }
      } else {
        // Text-only edit
        messageContent = `${context}

EXISTING CODE:
\`\`\`tsx
${input.tsxCode}
\`\`\`

Please edit the code according to the user request. Return the complete modified code.`;
      }

      console.log('🔍 [EDIT TOOL] Making edit with context:', {
        userPrompt: input.userPrompt,
        hasError: !!input.errorDetails,
        hasImages: !!input.imageUrls?.length,
        hasVideos: !!input.videoUrls?.length,
        hasWebContext: !!input.webContext,
        totalImages: allImageUrls.length,
        codeLength: input.tsxCode.length,
        codePreview: input.tsxCode.substring(0, 200),
        websiteUrl: input.webContext?.originalUrl
      });

      // Use the AI to edit the code
      // Check if there's a model override
      let modelConfig = getModel('editScene');
      if (input.modelOverride) {
        const overrideModel = getIndividualModel(input.modelOverride);
        if (overrideModel) {
          console.log(`🔄 [EDIT TOOL] Using override model: ${input.modelOverride}`);
          modelConfig = overrideModel;
        } else {
          console.warn(`⚠️ [EDIT TOOL] Model override ${input.modelOverride} not found, using default`);
        }
      }
      
      const systemPrompt = getSystemPrompt('CODE_EDITOR');

      // DEBUG: Log request size
      const requestContent = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
      const requestSize = requestContent.length + systemPrompt.length;
      console.log(`📊 [EDIT TOOL DEBUG] Request size: ${requestSize} chars (${(requestSize/1024).toFixed(2)}KB)`);
      
      // DEBUG: Time the AI call
      const startTime = Date.now();
      
      const response = await AIClientService.generateResponse(
        modelConfig,
        [{ role: "user", content: messageContent }],
        { role: 'system', content: systemPrompt },
        { responseFormat: { type: "json_object" }, debug: true }
      );

      const responseTime = Date.now() - startTime;

      const content = response?.content;
      if (!content) {
        throw new Error("No response from AI editor");
      }
      
      // ENHANCED DEBUG LOGGING
      console.log(`📏 [EDIT TOOL DEBUG] Response details:`, {
        size: content.length,
        sizeKB: (content.length / 1024).toFixed(2),
        sizeMB: (content.length / 1024 / 1024).toFixed(3),
        responseTime: `${responseTime}ms`,
        model: modelConfig.model,
        provider: modelConfig.provider,
        truncated: content.endsWith('...') || content.endsWith('\\') || !this.looksComplete(content),
        lastChars: content.slice(-100),
        hasValidJSON: this.isValidJSON(content)
      });
      
      // Check for common truncation patterns
      if (this.detectTruncation(content)) {
        console.error(`🚨 [EDIT TOOL DEBUG] TRUNCATION DETECTED!`);
        console.error(`Last 200 chars: "${content.slice(-200)}"`);
        console.error(`First 200 chars: "${content.slice(0, 200)}"`);
      }

      const parsed = this.extractJsonFromResponse(content);
      
      // Validate that we got valid code
      if (!parsed.code || typeof parsed.code !== 'string' || parsed.code.trim().length < 100) {
        throw new Error(`Invalid code returned`);
      }
      
      // 🚨 FIX: Replace incorrect currentFrame variable naming
      if (parsed.code.includes('const currentFrame = useCurrentFrame()')) {
        console.warn('🚨 [EDIT TOOL] Fixing currentFrame naming issue');
        parsed.code = parsed.code.replace(/const currentFrame = useCurrentFrame\(\)/g, 'const frame = useCurrentFrame()');
        // Also replace any usage of currentFrame variable (but not in destructuring)
        parsed.code = parsed.code.replace(/(?<!\{[^}]*)(\bcurrentFrame\b)(?![^{]*\}\s*=\s*window\.Remotion)/g, 'frame');
      }
      
      // 🚨 FIX: If there's both frame and currentFrame declared, remove currentFrame
      if (parsed.code.includes('const frame = useCurrentFrame()') && parsed.code.includes('const currentFrame')) {
        console.warn('🚨 [EDIT TOOL] Removing duplicate currentFrame declaration');
        // Remove any line that declares currentFrame
        parsed.code = parsed.code.replace(/^\s*const currentFrame\s*=.*$/gm, '');
      }
      
      // 🚨 FIX: If AI destructured currentFrame instead of useCurrentFrame
      if (parsed.code.match(/const\s*{[^}]*\bcurrentFrame\b[^}]*}\s*=\s*window\.Remotion/)) {
        console.warn('🚨 [EDIT TOOL] Fixing incorrect destructuring of currentFrame');
        parsed.code = parsed.code.replace(/(const\s*{[^}]*)(\bcurrentFrame\b)([^}]*}\s*=\s*window\.Remotion)/g, '$1useCurrentFrame$3');
      }

      console.log('✅ [EDIT TOOL] Edit completed:', {
        originalLength: input.tsxCode.length,
        newLength: parsed.code.length,
        changed: parsed.code !== input.tsxCode
      });

      return {
        success: true,
        tsxCode: parsed.code,
        duration: parsed.newDurationFrames || undefined,
        reasoning: parsed.reasoning || `Applied edit: ${input.userPrompt}`,
        chatResponse: parsed.reasoning || `I've updated the scene as requested`,
        changesApplied: parsed.changes || [`Applied edit: ${input.userPrompt}`],
      };
      
    } catch (error) {
      console.error('[EDIT TOOL] Edit failed:', error);
      throw error;
    }
  }

  private extractFunctionName(tsxCode: string): string {
    const match = tsxCode.match(/function\s+(\w+)|const\s+(\w+)\s*=/);
    return match?.[1] || match?.[2] || 'Scene';
  }


  private extractJsonFromResponse(content: string): any {
    try {
      // Try direct JSON parse first
      return JSON.parse(content);
    } catch (e) {
      console.log('🔍 [EDIT TOOL] Direct JSON parse failed, trying extraction...');
      console.log('🔍 [EDIT TOOL] Raw response (first 500 chars):', content.substring(0, 500));
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch?.[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e2) {
          console.error('🔍 [EDIT TOOL] Failed to parse extracted JSON from markdown:', e2);
          console.log('🔍 [EDIT TOOL] Extracted content:', jsonMatch[1].substring(0, 200));
        }
      }
      
      // Try to find JSON object in the content - look for the actual JSON response structure
      // First try to find a JSON object that starts with "code" property
      const jsonObjPattern = /\{\s*"code"\s*:\s*"[\s\S]*?"\s*,\s*"reasoning"\s*:[\s\S]*?\}\s*$/m;
      const structuredMatch = content.match(jsonObjPattern);
      if (structuredMatch?.[0]) {
        try {
          return JSON.parse(structuredMatch[0]);
        } catch (e3) {
          console.error('🔍 [EDIT TOOL] Failed to parse structured JSON:', e3);
        }
      }
      
      // If that fails, try a more careful extraction
      // Look for JSON that starts after the markdown code block
      const afterCodeBlock = content.split('```\n\n')?.[1] || content.split('```\r\n\r\n')?.[1];
      if (afterCodeBlock) {
        // Try to find JSON in the remaining content
        const jsonInRemainder = afterCodeBlock.match(/^\s*(\{[\s\S]*\})\s*$/);
        if (jsonInRemainder?.[1]) {
          try {
            return JSON.parse(jsonInRemainder[1]);
          } catch (e4) {
            console.error('🔍 [EDIT TOOL] Failed to parse JSON after code block:', e4);
          }
        }
      }
      
      // If all JSON parsing fails, try to construct a response manually
      console.warn('⚠️ [EDIT TOOL] All JSON parsing failed, attempting manual extraction...');
      
      // Look for code blocks that might contain the code
      const codeMatch = content.match(/```(?:tsx?|javascript|jsx)?\s*([\s\S]*?)\s*```/);
      if (codeMatch?.[1]) {
        console.log('✅ [EDIT TOOL] Found code block, constructing response manually');
        return {
          code: codeMatch[1],
          reasoning: 'Code extracted from response',
          changes: ['Applied requested changes']
        };
      }
      
      throw new Error('Could not extract JSON or code from response. Response: ' + content.substring(0, 500));
    }
  }

  private looksComplete(content: string): boolean {
    // Check if response appears complete
    const trimmed = content.trim();
    return trimmed.endsWith('}') || trimmed.endsWith('"}');
  }

  private isValidJSON(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  private detectTruncation(content: string): boolean {
    // Common truncation indicators
    const truncationPatterns = [
      /\\\s*$/,           // Ends with backslash
      /"\s*$/,            // Ends with unclosed quote
      /,\s*$/,            // Ends with comma
      /:\s*$/,            // Ends with colon
      /\[\s*$/,           // Ends with unclosed array
      /\{\s*$/,           // Ends with unclosed object
      /\\n\s*$/,          // Ends mid-escape sequence
      /[^}]\s*$/          // Doesn't end with closing brace
    ];
    
    const trimmed = content.trim();
    
    // If it's valid JSON, it's not truncated
    if (this.isValidJSON(content)) {
      return false;
    }
    
    // Check truncation patterns
    return truncationPatterns.some(pattern => pattern.test(trimmed));
  }

}

// Export singleton instance
export const editTool = new EditTool();
