"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { SearchIcon, FolderIcon, MoreVertical, Copy, Edit, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Player } from "@remotion/player";
import { transform } from 'sucrase';
import RemotionPreview from '../../components/RemotionPreview';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  createdAt?: string;
  thumbnail?: string;
}

interface MyProjectsPanelGProps {
  projects: Project[];
  currentProjectId: string;
}

// Project thumbnail showing frame 15 of actual video (not gradient)
const ProjectThumbnail = ({ project, componentImporter, playerProps }: { 
  project: Project; 
  componentImporter: (() => Promise<any>) | null;
  playerProps: any;
}) => {
  // If we have the compiled component, show frame 15
  if (componentImporter && playerProps) {
    return (
      <div className="relative w-full h-full">
        <RemotionPreview
          lazyComponent={componentImporter}
          durationInFrames={playerProps.durationInFrames}
          fps={playerProps.fps}
          width={playerProps.width}
          height={playerProps.height}
          inputProps={playerProps.inputProps}
          refreshToken={`project-${project.id}-thumbnail`}
          // Static frame 15 thumbnail
          controls={false}
          showVolumeControls={false}
          doubleClickToFullscreen={false}
          clickToPlay={false}
          loop={false}
          autoPlay={false}
          initialFrame={15}
        />
        
        {/* Always visible title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <h3 className="text-white font-medium text-sm truncate">{project.name}</h3>
        </div>
      </div>
    );
  }

  // Fallback to gradient while video is loading
  return (
    <div className="relative w-full h-full">
      {/* Thumbnail background */}
      <div 
        style={{
          width: '100%',
          height: '100%',
          background: project.thumbnail 
            ? `url(${project.thumbnail})` 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Always visible title at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <h3 className="text-white font-medium text-sm truncate">{project.name}</h3>
      </div>
    </div>
  );
};

// Helper function to create fallback scene
const createFallbackScene = (sceneName: string, index: number, reason: string, functionName: string = `FallbackScene${index}`) => {
  return `
function ${functionName}() {
  const { AbsoluteFill } = window.Remotion;
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#ffebee',
        border: '2px dashed #f44336',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '300px'
      }}>
        <h3 style={{ color: '#d32f2f', margin: '0 0 10px 0', fontSize: '16px' }}>
          Scene: ${sceneName}
        </h3>
        <p style={{ color: '#666', margin: '0', fontSize: '12px' }}>
          ${reason}
        </p>
      </div>
    </AbsoluteFill>
  );
}`;
};

// Helper function to process scene code and prevent variable conflicts
function processSceneCode(sceneCode: string, sceneId: string): string {
  // Create unique suffix from scene ID
  const uniqueSuffix = sceneId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  
  // Find module-level const declarations before the function
  const functionMatch = sceneCode.match(/export default function (\w+)/);
  if (!functionMatch) {
    // If no function found, return as-is
    return sceneCode;
  }
  
  const functionStart = functionMatch.index!;
  const beforeFunction = sceneCode.substring(0, functionStart);
  const fromFunction = sceneCode.substring(functionStart);
  
  // Extract module-level const declarations
  const constRegex = /^const\s+(\w+)\s*=\s*([^;]+);?\s*$/gm;
  const moduleConstants: Array<{ name: string; value: string; uniqueName: string }> = [];
  let match;
  
  while ((match = constRegex.exec(beforeFunction)) !== null) {
    const varName = match[1];
    const varValue = match[2];
    if (varName && varValue) {
      const uniqueName = `${varName}_${uniqueSuffix}`;
      moduleConstants.push({
        name: varName,
        value: varValue,
        uniqueName
      });
    }
  }
  
  if (moduleConstants.length === 0) {
    // No module-level constants, return as-is
    return sceneCode;
  }
  
  // Remove module-level const declarations from before function
  let cleanBeforeFunction = beforeFunction;
  moduleConstants.forEach(({ name, value }) => {
    const constPattern = new RegExp(`^const\\s+${name}\\s*=\\s*[^;]+;?\\s*$`, 'gm');
    cleanBeforeFunction = cleanBeforeFunction.replace(constPattern, '');
  });
  
  // Update variable references in function code
  let updatedFunctionCode = fromFunction;
  moduleConstants.forEach(({ name, uniqueName }) => {
    // Replace variable references (but not in strings)
    const varPattern = new RegExp(`\\b${name}\\b(?![a-zA-Z0-9_])`, 'g');
    updatedFunctionCode = updatedFunctionCode.replace(varPattern, uniqueName);
  });
  
  // Add unique variables at the start of the function
  const functionBodyMatch = updatedFunctionCode.match(/(\{[\s\S]*)/);
  if (functionBodyMatch && functionBodyMatch[1]) {
    const functionBody = functionBodyMatch[1];
    const variableDeclarations = moduleConstants
      .map(({ uniqueName, value }) => `  const ${uniqueName} = ${value};`)
      .join('\n');
    
    const newFunctionBody = `{\n${variableDeclarations}\n${functionBody.substring(1)}`;
    updatedFunctionCode = updatedFunctionCode.replace(functionBody, newFunctionBody);
  }
  
  return cleanBeforeFunction + updatedFunctionCode;
}

// Playing video component (on hover)
const ProjectVideoPlayer = ({ project, componentImporter, playerProps }: { 
  project: Project; 
  componentImporter: (() => Promise<any>) | null;
  playerProps: any;
}) => {
  // Render the actual RemotionPreview with autoPlay
  if (componentImporter && playerProps) {
    return (
      <RemotionPreview
        lazyComponent={componentImporter}
        durationInFrames={playerProps.durationInFrames}
        fps={playerProps.fps}
        width={playerProps.width}
        height={playerProps.height}
        inputProps={playerProps.inputProps}
        refreshToken={`project-${project.id}-playing`}
        // Playing video on hover
        controls={false}
        showVolumeControls={false}
        doubleClickToFullscreen={false}
        clickToPlay={false}
        loop={true}
        autoPlay={true}
        initialFrame={0}
      />
    );
  }

  // Default fallback
  return (
    <div className="w-full h-full bg-gray-600 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="text-xs opacity-75">Loading preview...</div>
      </div>
    </div>
  );
};

// Real video compilation component (shared between thumbnail and playing states)
const useCompiledVideo = (project: Project, delayMs: number = 0) => {
  const [componentImporter, setComponentImporter] = useState<(() => Promise<any>) | null>(null);
  const [componentBlobUrl, setComponentBlobUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const [isDelayed, setIsDelayed] = useState(delayMs > 0);

  // Add delay for staggered loading
  useEffect(() => {
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        setIsDelayed(false);
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [delayMs]);

  // Load project scenes with improved error handling
  const { data: projectScenes, isLoading, error } = api.generation.getProjectScenes.useQuery(
    { projectId: project.id },
    { 
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 1, // Only retry once to avoid spam
      enabled: !isDelayed, // Enable after delay period
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect
      refetchOnMount: false, // Don't refetch if data is already cached
    }
  );

  // Calculate total duration from all scenes
  const totalDuration = useMemo(() => {
    if (!projectScenes || projectScenes.length === 0) return 150; // Default 5 seconds
    try {
      return projectScenes.reduce((total, scene) => {
        const sceneDuration = typeof scene.duration === 'number' && scene.duration > 0 ? scene.duration : 150;
        return total + sceneDuration;
      }, 0);
    } catch (err) {
      console.warn('Error calculating total duration for project', project.id, err);
      return 150; // Fallback duration
    }
  }, [projectScenes, project.id]);

  // Player props for RemotionPreview
  const playerProps = useMemo(() => {
    if (!componentImporter) return null;
    
    return {
      durationInFrames: totalDuration,
      fps: 30,
      width: 1920,
      height: 1080,
      inputProps: {}
    };
  }, [componentImporter, totalDuration]);

  // Compile scenes into a single component (same logic as PreviewPanelG)
  const compileProjectScenes = useCallback(async () => {
    if (!projectScenes || projectScenes.length === 0) {
      console.log('[useCompiledVideo] No scenes to compile for project', project.id);
      return;
    }

    setIsCompiling(true);
    setCompilationError(null);
    
    try {
      console.log('[useCompiledVideo] Compiling', projectScenes.length, 'scenes for project', project.id);
      
      // Filter scenes that have code
      const scenesWithCode = projectScenes.filter(scene => scene.tsxCode && scene.tsxCode.trim().length > 0);
      
      if (scenesWithCode.length === 0) {
        throw new Error('No scenes with valid code found');
      }

      // Compile each scene
      const compiledScenes = await Promise.all(
        scenesWithCode.map(async (scene, index) => {
          try {
            // Process scene code to prevent variable conflicts first
            const processedSceneCode = processSceneCode(scene.tsxCode, scene.id);
            
            // Extract component name from the processed code
            const componentNameMatch = processedSceneCode.match(/export\s+default\s+function\s+(\w+)/);
            const baseComponentName = componentNameMatch ? componentNameMatch[1] : `GeneratedScene`;
            
            // Ensure unique component name by adding scene ID suffix
            const uniqueComponentName = `${baseComponentName}_${scene.id.replace(/-/g, '_').substring(0, 8)}`;
            
            // Clean the processed scene code for compilation
            let cleanSceneCode = processedSceneCode
              .replace(/import\s+\{[^}]+\}\s+from\s+['"]remotion['"];?\s*/g, '') // Remove remotion imports
              .replace(/import\s+.*from\s+['"]react['"];?\s*/g, '') // Remove React imports
              .replace(/const\s+\{\s*[^}]+\s*\}\s*=\s*window\.Remotion;\s*/g, '') // Remove window.Remotion destructuring
              .replace(/export\s+default\s+function\s+\w+/, `function ${uniqueComponentName}`) // Replace main function export
              .replace(/export\s+default\s+[^;]+;?/g, '') // Remove any remaining export default statements
              .replace(/export\s*\{\s*[^}]*default[^}]*\};?/g, ''); // Remove export { default } statements

            return {
              isValid: true,
              compiledCode: cleanSceneCode,
              componentName: uniqueComponentName,
              duration: scene.duration || 150
            };
          } catch (error) {
            console.error('[useCompiledVideo] Error compiling scene', index, error);
            // Create unique fallback name for error scenes too
            const fallbackName = `FallbackScene_${scene.id.replace(/-/g, '_').substring(0, 8)}`;
            return {
              isValid: false,
              compiledCode: createFallbackScene(scene.name || `Scene ${index + 1}`, index, 'Compilation error', fallbackName),
              componentName: fallbackName,
              duration: scene.duration || 150
            };
          }
        })
      );

      // For single scene, use simpler approach
      if (compiledScenes.length === 1) {
        const scene = compiledScenes[0];
        if (!scene) {
          throw new Error('Scene compilation failed');
        }
        
        const singleSceneCode = `
const { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Sequence, Audio, Video, Img, staticFile, Loop, Series } = window.Remotion;

${scene.compiledCode}

export default function SingleSceneComposition() {
  return <${scene.componentName} />;
}
        `;

        console.log('[useCompiledVideo] Generated single scene code for project', project.id);

        // Transform with Sucrase
        const { code: transformedCode } = transform(singleSceneCode, {
          transforms: ['typescript', 'jsx'],
          jsxRuntime: 'classic',
          production: false,
        });

        // Create blob URL
        const blob = new Blob([transformedCode], { type: 'application/javascript' });
        const newBlobUrl = URL.createObjectURL(blob);
        setComponentBlobUrl(newBlobUrl);
        
        // Import the module
        const module = await import(/* webpackIgnore: true */ newBlobUrl);
        const Component = module.default;
        
        if (!Component) {
          throw new Error('No default export found in generated component');
        }
        
        setComponentImporter(() => () => Promise.resolve({ default: Component }));
        
      } else {
        // Multi-scene composition with Series
        const sceneComponents = compiledScenes.map((scene, index) => `
          <Series.Sequence durationInFrames={${scene.duration}}>
            <${scene.componentName} />
          </Series.Sequence>
        `).join('\n          ');

        const multiSceneCode = `
const { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Sequence, Audio, Video, Img, staticFile, Loop, Series } = window.Remotion;

${compiledScenes.map(scene => scene.compiledCode).join('\n\n')}

export default function MultiSceneComposition() {
  return (
    <AbsoluteFill>
      <Loop durationInFrames={${totalDuration}}>
        <Series>
          ${sceneComponents}
        </Series>
      </Loop>
    </AbsoluteFill>
  );
}
        `;

        console.log('[useCompiledVideo] Generated multi-scene code for project', project.id);

        // Transform with Sucrase
        const { code: transformedCode } = transform(multiSceneCode, {
          transforms: ['typescript', 'jsx'],
          jsxRuntime: 'classic',
          production: false,
        });

        // Create blob URL
        const blob = new Blob([transformedCode], { type: 'application/javascript' });
        const newBlobUrl = URL.createObjectURL(blob);
        setComponentBlobUrl(newBlobUrl);
        
        // Import the module
        const module = await import(/* webpackIgnore: true */ newBlobUrl);
        const Component = module.default;
        
        if (!Component) {
          throw new Error('No default export found in generated component');
        }
        
        setComponentImporter(() => () => Promise.resolve({ default: Component }));
      }
      
    } catch (error) {
      console.error('[useCompiledVideo] Compilation error for project', project.id, error);
      setCompilationError(error instanceof Error ? error.message : 'Unknown compilation error');
      
      // Create fallback component
      try {
        const fallbackCode = `
const { AbsoluteFill } = window.Remotion;

export default function FallbackComposition() {
  return (
    <AbsoluteFill style={{
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#ffebee',
        border: '2px dashed #f44336',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '300px'
      }}>
        <h3 style={{ color: '#d32f2f', margin: '0 0 10px 0', fontSize: '16px' }}>
          ${project.name}
        </h3>
        <p style={{ color: '#666', margin: '0', fontSize: '12px' }}>
          Preview not available
        </p>
      </div>
    </AbsoluteFill>
  );
}`;

        const { code: fallbackTransformed } = transform(fallbackCode, {
          transforms: ['typescript', 'jsx'],
          jsxRuntime: 'classic',
          production: false,
        });

        const fallbackBlob = new Blob([fallbackTransformed], { type: 'application/javascript' });
        const fallbackBlobUrl = URL.createObjectURL(fallbackBlob);
        const fallbackModule = await import(/* webpackIgnore: true */ fallbackBlobUrl);
        
        setComponentImporter(() => () => Promise.resolve({ default: fallbackModule.default }));
      } catch (fallbackError) {
        console.error('[useCompiledVideo] Even fallback failed for project', project.id, fallbackError);
      }
    } finally {
      setIsCompiling(false);
    }
  }, [projectScenes, project.id, project.name, totalDuration]);

  // Compile scenes when data is loaded
  useEffect(() => {
    if (projectScenes && projectScenes.length > 0 && !componentImporter && !isCompiling) {
      compileProjectScenes();
    }
  }, [projectScenes, componentImporter, isCompiling, compileProjectScenes]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (componentBlobUrl) {
        URL.revokeObjectURL(componentBlobUrl);
      }
    };
  }, [componentBlobUrl]);

  return {
    componentImporter,
    playerProps,
    isLoading: isLoading || isCompiling,
    error: error || compilationError
  };
};

// Project preview component with thumbnail/video toggle
const ProjectPreview = ({ 
  project, 
  onClick, 
  onRename,
  onDuplicate,
  onDelete,
  isCurrentProject,
  isDeletingProject = false,
  index = 0
}: { 
  project: Project; 
  onClick: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isCurrentProject: boolean;
  isDeletingProject?: boolean;
  index?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stagger API calls: current project loads immediately, others have increasing delays
  const delayMs = isCurrentProject ? 0 : Math.min(index * 200, 2000); // Max 2 second delay
  
  // Use the shared compiled video hook with staggered loading
  const { componentImporter, playerProps, isLoading, error } = useCompiledVideo(project, delayMs);

  // Debounced hover to prevent rapid API calls
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    setIsHovered(true);
    
    // Delay video playback by 300ms to prevent rapid firing
    hoverTimeoutRef.current = setTimeout(() => {
      setShouldLoadVideo(true);
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    setIsHovered(false);
    // Stop video playback immediately
    setShouldLoadVideo(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) {
      return;
    }
    onClick();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div 
        className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group"
        onClick={handleCardClick}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
            <div className="text-xs">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div 
        className="relative w-full aspect-video bg-gray-700 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group"
        onClick={handleCardClick}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white text-center px-4">
            <div className="text-xs opacity-75">Preview unavailable</div>
            <div className="text-xs opacity-50 mt-1">{project.name}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Show static frame 15 by default, playing video on hover */}
      {isHovered && shouldLoadVideo ? (
        <ProjectVideoPlayer project={project} componentImporter={componentImporter} playerProps={playerProps} />
      ) : (
        <ProjectThumbnail project={project} componentImporter={componentImporter} playerProps={playerProps} />
      )}
      
      {/* Hover overlay with controls only (titles always visible in thumbnail) */}
      <div 
        className={`absolute inset-0 transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Three dots menu - top right (only visible on hover) */}
        <div className="absolute top-2 right-2 z-50" data-dropdown-trigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/90 hover:bg-black text-white backdrop-blur-sm relative z-50 border border-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 z-50">
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }} 
                className="cursor-pointer"
              >
                <Edit className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }} 
                className="cursor-pointer"
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDeletingProject) {
                    onDelete();
                  }
                }} 
                className={`cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700 ${
                  isDeletingProject ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isDeletingProject}
              >
                {isDeletingProject ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {isDeletingProject ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Current project indicator - bottom (only visible on hover) */}
        {isCurrentProject && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <div className="text-xs text-blue-300">Currently open</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function MyProjectsPanelG({ 
  projects, 
  currentProjectId 
}: MyProjectsPanelGProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Handle project navigation
  const handleProjectClick = useCallback((projectId: string) => {
    if (projectId !== currentProjectId) {
      router.push(`/projects/${projectId}/generate`);
    }
  }, [currentProjectId, router]);

  // Handle project rename
  const handleProjectRename = useCallback((project: Project) => {
    console.log('handleProjectRename called for:', project.name);
    // TODO: Implement rename functionality
    toast.info(`Rename functionality for "${project.name}" coming soon!`);
  }, []);

  // Handle project duplicate
  const handleProjectDuplicate = useCallback((project: Project) => {
    console.log('handleProjectDuplicate called for:', project.name);
    // TODO: Implement duplicate functionality
    toast.info(`Duplicate functionality for "${project.name}" coming soon!`);
  }, []);

  // Add delete mutation
  const deleteMutation = api.project.delete.useMutation({
    onSuccess: (data) => {
      toast.success(`Project "${data.deletedProject.title}" has been deleted successfully`);
      
      // If we deleted the current project, navigate to projects list or dashboard
      if (data.deletedProject.id === currentProjectId) {
        router.push('/dashboard');
      } else {
        // Refresh the page to update the projects list
        window.location.reload();
      }
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
      toast.error(`Failed to delete project: ${error.message}`);
    }
  });

  // Handle project delete
  const handleProjectDelete = useCallback((project: Project) => {
    console.log('handleProjectDelete called for:', project.name);
    
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${project.name}"?\n\nThis action cannot be undone and will permanently delete all scenes, components, and project data.`
    );
    
    if (!confirmDelete) {
      return; // User cancelled
    }

    // Use the tRPC delete mutation
    deleteMutation.mutate({ id: project.id });
  }, [deleteMutation]);

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    return projects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search */}
      <div className="flex-none p-2 border-b">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects Grid - Dynamic responsive grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div 
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
          }}
        >
          {filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className={`overflow-hidden transition-all p-0 ${
                project.id === currentProjectId 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'hover:shadow-lg'
              }`}
            >
              <ProjectPreview 
                project={project} 
                onClick={() => handleProjectClick(project.id)}
                onRename={() => handleProjectRename(project)}
                onDuplicate={() => handleProjectDuplicate(project)}
                onDelete={() => handleProjectDelete(project)}
                isCurrentProject={project.id === currentProjectId}
                isDeletingProject={deleteMutation.isPending && deleteMutation.variables?.id === project.id}
                index={filteredProjects.indexOf(project)}
              />
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <FolderIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </p>
            {searchQuery && (
              <p className="text-xs mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 