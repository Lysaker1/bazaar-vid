# Component Template Implementation Guide

This document outlines the step-by-step implementation of our template-based solution for Remotion custom components.

## Problem 

We're consistently seeing errors when custom components are being loaded:

```
Error: Unexpected token '{'. import call expects one or two arguments.
[useRemoteComponent] Component loaded but __REMOTION_COMPONENT not found
[CustomScene] Metadata fetch timeout for component after 5 seconds
```

These errors stem from inconsistent component generation, particularly with import statements and component registration.

## Implementation Steps

### Step 1: Create Component Template File

First, create a new file at `src/server/workers/componentTemplate.ts`:

```typescript
// src/server/workers/componentTemplate.ts
/**
 * Standard template for all Remotion components generated by the LLM
 * This ensures consistent structure, imports, and exports
 */

export const COMPONENT_TEMPLATE = `
"use client";

import React from 'react';
import { 
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  Easing
} from 'remotion';

// Component implementation goes here
const {{COMPONENT_NAME}} = (props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  
  // Animation Design Brief data is available in props.brief
  {{COMPONENT_IMPLEMENTATION}}
  
  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {{COMPONENT_RENDER}}
    </AbsoluteFill>
  );
};

// This is required - DO NOT modify this line
window.__REMOTION_COMPONENT = {{COMPONENT_NAME}};
`;

/**
 * Apply the template to component implementation details
 * 
 * @param componentName Validated component name (CamelCase)
 * @param implementation Component implementation logic
 * @param render JSX render content
 * @returns Complete component code using the template
 */
export function applyComponentTemplate(
  componentName: string,
  implementation: string = '',
  render: string = '<div>Empty component</div>'
): string {
  return COMPONENT_TEMPLATE
    .replace(/{{COMPONENT_NAME}}/g, componentName)
    .replace('{{COMPONENT_IMPLEMENTATION}}', implementation)
    .replace('{{COMPONENT_RENDER}}', render);
}
```

### Step 2: Update Component Generation Process

Modify `src/server/workers/generateComponentCode.ts` to use the template:

1. Import the template utilities:

```typescript
import { COMPONENT_TEMPLATE, applyComponentTemplate } from "./componentTemplate";
```

2. Add a syntax validation function:

```typescript
/**
 * Validates component syntax before storing
 * @param code The component code to validate
 * @returns An object with valid flag and optional error message
 */
function validateComponentSyntax(code: string): { valid: boolean; error?: string } {
  try {
    // Use Function constructor to check if code parses
    // This won't execute the code, just check syntax
    new Function('"use strict";' + code);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

3. Update the LLM system prompt:

```typescript
// Replace the existing system prompt with this:
{
  role: "system",
  content: `You are an expert React and Remotion developer. You build beautiful video components using Remotion and React.
  
When creating React components with Remotion, you will ONLY provide implementation details following a very strict template structure.

You will NOT write complete component files. Instead:
1. ONLY provide the COMPONENT_NAME, COMPONENT_IMPLEMENTATION, and COMPONENT_RENDER parts.
2. These parts will be inserted into our template that already has:
   - "use client" directive
   - All necessary imports from React and Remotion
   - Component structure with props
   - window.__REMOTION_COMPONENT assignment

COMPONENT STRUCTURE RULES:
1. COMPONENT_NAME: Provide a CamelCase name for the component (e.g., BlueCircleScene)
2. COMPONENT_IMPLEMENTATION: Provide ONLY the implementation logic inside the component function
   - Access animation design brief data with props.brief
   - Use frame, width, height, fps, and durationInFrames which are already defined
   - Define variables, calculations, and animations here
3. COMPONENT_RENDER: Provide ONLY the JSX content that goes inside the AbsoluteFill
   - The AbsoluteFill wrapper is already included in the template
   - Only provide what goes inside it

IMPORTANT RESTRICTIONS:
- DO NOT include imports - they're already in the template
- DO NOT include the "use client" directive - it's already in the template
- DO NOT include the window.__REMOTION_COMPONENT assignment - it's already in the template
- DO NOT use or reference any external images, videos, or other media files
- DO NOT use the <Img> component from Remotion
- DO NOT include any code that attempts to load assets using URLs or file paths
- DO NOT use staticFile from Remotion
- INSTEAD, create visual elements using CSS, SVG, or other programmatically generated graphics
- Focus on animations, shapes, text, and colors

For animation:
- Make extensive use of Remotion's animation utilities like interpolate and Easing
- Create simple shapes using divs with appropriate styling
- Use SVG elements for more complex shapes and illustrations
- Access the Animation Design Brief data through props.brief`
}
```

4. Update the tool function parameters:

```typescript
tools: [
  {
    type: "function",
    function: {
      name: "generate_remotion_component",
      description: "Generate a Remotion React component based on the provided description",
      parameters: {
        type: "object",
        properties: {
          componentName: {
            type: "string",
            description: "Name of the React component to generate (CamelCase)"
          },
          componentImplementation: {
            type: "string",
            description: "The implementation logic that will go inside the component function (without the function declaration or return statement)"
          },
          componentRender: {
            type: "string",
            description: "The JSX to render inside the AbsoluteFill (without the AbsoluteFill wrapper)"
          },
          componentDescription: {
            type: "string",
            description: "Brief description of what the component does"
          }
        },
        required: ["componentName", "componentImplementation", "componentRender", "componentDescription"]
      }
    }
  }
]
```

5. Replace the code processing logic with template application:

```typescript
// Replace the existing component processing logic
const componentCode = applyComponentTemplate(
  sanitizedComponentName,
  args.componentImplementation || '',
  args.componentRender || '<div>Empty component</div>'
);

// Validate the generated component
const validation = validateComponentSyntax(componentCode);
if (!validation.valid) {
  componentLogger.error(jobId, `Generated component has syntax errors: ${validation.error}`);
  
  // Create fallback component with error message
  const fallbackComponent = applyComponentTemplate(
    sanitizedComponentName,
    `// Original implementation had syntax errors: ${validation.error}`,
    `<div style={{ backgroundColor: 'rgba(255, 0, 0, 0.2)', padding: '20px', borderRadius: '8px', color: 'red' }}>
      <h2>Component Error</h2>
      <p>The component could not be generated correctly.</p>
    </div>`
  );
  
  const totalDuration = Date.now() - startTime;
  componentLogger.complete(jobId, `Fallback component generation complete in ${totalDuration}ms`, {
    duration: totalDuration,
    componentName: sanitizedComponentName,
    error: validation.error
  });
  
  return {
    code: fallbackComponent,
    dependencies: {},
  };
}
```

### Step 3: Update API Route for Template Detection

Modify `src/app/api/components/[componentId]/route.ts` to recognize template-based components:

1. Add detection for templated components:

```typescript
// Inside the GET function, after fetching jsContent:

// Check if the component is already using our template format
const isTemplatedComponent = jsContent.includes('window.__REMOTION_COMPONENT =') && 
                           !jsContent.includes('function detectAndRegisterComponent()');

if (isTemplatedComponent) {
  // If it's already using our template, just validate it but don't modify
  apiRouteLogger.debug(componentId, "Component uses template format, skipping transformation");
  
  // Still apply basic preprocessing for safety
  jsContent = preprocessComponentCode(jsContent, componentId);
} else {
  // For older components, apply our standard transformations
  apiRouteLogger.debug(componentId, "Component uses legacy format, applying transformations");
  
  // Apply preprocessing with our enhanced function
  jsContent = preprocessComponentCode(jsContent, componentId);
  
  // Additional safety fix for createElement variable mismatches
  if (jsContent.includes('.createElement') && jsContent.includes('import React')) {
    // Find all potential React aliases used with createElement
    const creatorMatches = [...jsContent.matchAll(/([a-zA-Z0-9_$]+)\.createElement/g)];
    const creatorVariables = new Set<string>();
    
    creatorMatches.forEach(match => {
      // Safely extract the matched group and ensure it's a string
      const varName = match[1] || '';
      // Only add non-empty strings that aren't 'React'
      if (varName && varName !== 'React') {
        creatorVariables.add(varName);
      }
    });
    
    // Replace all non-React createElement calls
    creatorVariables.forEach(varName => {
      // Ensure varName is defined before using it in RegExp
      if (varName) {
        const pattern = new RegExp(`${varName}\.createElement`, 'g');
        jsContent = jsContent.replace(pattern, 'React.createElement');
        
        apiRouteLogger.debug(componentId, `Fixed createElement alias: ${varName} → React`);
      }
    });
  }
  
  // Handle audio file references that might not exist
  jsContent = jsContent.replace(/src:\s*["']([^"']+\.mp3)["']/g, 'src: ""');
  jsContent = jsContent.replace(/src=\{["']([^"']+\.mp3)["']\}/g, 'src=""');
}
```

2. Improve the fallback component for syntax errors:

```typescript
// Inside the try/catch block for syntax validation:

// Generate a fallback component that will render properly
jsContent = `
  "use client";
  
  import React from 'react';
  import { AbsoluteFill } from 'remotion';
  
  // Error fallback component
  const ErrorComponent = (props) => {
    return React.createElement('div', {
      style: { 
        backgroundColor: 'rgba(255, 0, 0, 0.1)', 
        color: 'red',
        padding: '20px',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }
    }, [
      React.createElement('h2', {key: 'title'}, 'Component Syntax Error'),
      React.createElement('p', {key: 'id'}, 'ID: ${componentId}'),
      React.createElement('p', {key: 'error', style: {fontSize: '11px'}}, 'Error: ${
        syntaxError instanceof Error 
          ? syntaxError.message.replace(/'/g, "\\'") 
          : String(syntaxError).replace(/'/g, "\\'")
      }')
    ]);
  };
  
  // This is the required export - DO NOT modify this line
  window.__REMOTION_COMPONENT = ErrorComponent;
`;
```

### Step 4: Testing

1. **Test legacy component handling:**
   - Visit `http://localhost:3000/api/components/{old-component-id}` 
   - Verify it uses old component loading logic

2. **Test template-based component generation:**
   - Trigger a new component generation in the chat
   - Check logs for syntax validation 
   - Verify the component uses the template format

3. **Test syntax error handling:**
   - Modify a template-based component to include a syntax error
   - Verify it returns a valid fallback component

## Migration Plan

1. **Immediate Fix**: Deploy these changes to fix component loading issues
2. **Gradual Migration**: All new components will use the template format
3. **Legacy Support**: Maintain compatibility with existing components
4. **Eventual Migration**: Consider rebuilding legacy components with the template format in the future

## Implementation Checklist

- [ ] Create `componentTemplate.ts` file
- [ ] Update `generateComponentCode.ts` to use the template
- [ ] Update the LLM system prompt
- [ ] Update the tool function parameters
- [ ] Add syntax validation logic
- [ ] Modify `route.ts` to detect template-based components
- [ ] Improve fallback component for syntax errors
- [ ] Run tests
- [ ] Deploy changes 