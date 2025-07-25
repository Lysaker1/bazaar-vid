//bazaar-vid/next.config.js
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import('next').NextConfig} */
const config = {
  eslint: {
    // Allow production builds to complete despite ESLint errors
    ignoreDuringBuilds: true,
  },
  
  // Suppress deprecation warnings in development
  reactStrictMode: true,
  
  // Configure webpack to ignore problematic files
  webpack: (config, { isServer, dev }) => {
    if (!config.resolve) {
      config.resolve = {};
    }
    
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // Add aliases for ~ to point to src directory
    config.resolve.alias['~'] = new URL('./src', import.meta.url).pathname;

    // Ignore all .d.ts files (e.g., esbuild/lib/main.d.ts)
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: 'null-loader',
    });

    // Add loader for .woff and .woff2 fonts to optimize tree shaking
    config.module.rules.push({
      test: /\.(woff|woff2)$/,
      type: 'asset/resource',
    });

    // Add support for importing SVG as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Handle Node.js built-in modules in client-side code
    if (!isServer) {
      if (!config.resolve.fallback) {
        config.resolve.fallback = {};
      }
      
      // Provide empty mock implementations for Node.js built-in modules
      // that might be imported in client-side code
      Object.assign(config.resolve.fallback, {
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        zlib: false,
        http: false,
        https: false,
        child_process: false,
        // Add ws as false to prevent client-side bundling
        ws: false,
        net: false,
        tls: false,
      });
    }

    // Mark esbuild as external to prevent bundling issues
    // This is required because esbuild needs to access its binary executable
    if (!config.externals) {
      config.externals = [];
    }
    
    // Add esbuild to externals to prevent it from being bundled
    if (isServer) {
      config.externals.push('esbuild');
    }

    // Suppress warnings from mlly module
    config.ignoreWarnings = [
      { module: /mlly/ },
      // Also ignore the specific critical dependency warning
      {
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Add webpack config to handle Remotion platform-specific binaries
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : [config.externals || {}]),
      ({ request }, callback) => {
        // Ignore platform-specific Remotion compositor binaries
        if (request?.includes('@remotion/compositor-')) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      },
    ].filter(Boolean);

    // Configure webpack to ignore logs directory for file watching
    if (dev) {
      // Define comprehensive patterns to ignore using only string patterns
      // Webpack expects string patterns, not RegExp objects
      const ignoredPatterns = [
        // Directories to completely ignore
        '**/node_modules/**',
        '**/.next/**',
        '**/logs/**',
        '**/tmp/**',
        '**/temp/**',
        '**/a2a-logs/**',
        '**/combined-logs/**',
        '**/error-logs/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        
        // A2A specific directories to prevent TaskProcessor restarts
        '**/src/server/services/a2a/**',
        '**/src/server/agents/**',
        '**/src/server/workers/**',
        
        // File patterns to ignore
        '**/*.log',
        '**/*.log.*',
        '**/combined-*.log',
        '**/error-*.log',
        '**/a2a-*.log',
        '**/components-*.log',
        '**/.DS_Store',
        '**/*.generated.*',
        '**/debug-*',
        '**/winston-*',
        
        // Specific log files
        '**/combined.log',
        '**/error.log',
        '**/a2a.log',
        
        // Temp files 
        '**/*.tmp',
        '**/*.temp',
        '**/~*'
      ];
      
      // Return a new config object with watchOptions property
      return {
        ...config,
        watchOptions: {
          ...(config.watchOptions || {}),
          ignored: ignoredPatterns,
          // Add longer polling interval to reduce CPU usage
          poll: 5000, // Check for changes every 5 seconds
          // Add aggregation delay to prevent multiple restarts
          aggregateTimeout: 5000, // Wait 5 seconds after changes before restarting
          // Reduce file system events 
          followSymlinks: false
        }
      };
    }

    // Return the config if we're not in dev mode
    return config;
  },
  
  // Transpile Remotion library
  transpilePackages: [
    "@remotion/cli", 
    "@remotion/player", 
    "@remotion/renderer", 
    "remotion",
    "src/scripts/log-agent"
  ],
  
  // External packages that should be bundled separately
  serverExternalPackages: ['@prisma/client', 'drizzle-orm', 'esbuild', '@aws-sdk/client-s3', 'sharp'],
  
  // Configure CORS and security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        // Add SEO-friendly headers for all pages
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      }
    ];
  },
  
  // Skip TypeScript type checking to optimize build time
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enhanced image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance optimizations
  compress: true,
  productionBrowserSourceMaps: false,
  
  // Static generation optimizations
  output: 'standalone',
  
  // Add these settings to quiet down the Next.js internals
  onDemandEntries: {
    // Keep pages in memory longer to avoid constant reloads
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    // Don't show verbose logs for page compilation
    pagesBufferLength: 5,
  },
  
  // Disable X-Powered-By header
  poweredByHeader: false,
  
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true, 
    scrollRestoration: true,
    optimizePackageImports: ['lucide-react'],
  },
};

export default config;
