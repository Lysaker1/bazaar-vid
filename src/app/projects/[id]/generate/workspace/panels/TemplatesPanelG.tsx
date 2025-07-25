"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import { SearchIcon, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { TEMPLATES, type TemplateDefinition } from "~/templates/registry";
import { Player } from "@remotion/player";
import { useVideoState } from "~/stores/videoState";

interface TemplatesPanelGProps {
  projectId: string;
  onSceneGenerated?: (sceneId: string) => Promise<void>;
}

// Template thumbnail showing frame 15 by default
const TemplateThumbnail = ({ template, format }: { template: TemplateDefinition; format: string }) => {
  const { component, isCompiling, compilationError, playerProps } = useCompiledTemplate(template, format);

  if (compilationError) {
    return (
      <div className="w-full h-24 sm:h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xs sm:text-sm font-medium">Template Error</div>
          <div className="text-gray-500 text-[10px] sm:text-xs mt-1">Failed to compile</div>
        </div>
      </div>
    );
  }

  if (isCompiling || !component) {
    return (
      <div className="w-full h-24 sm:h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-4 sm:h-6 w-4 sm:w-6 animate-spin text-gray-400 mx-auto mb-1 sm:mb-2" />
          <div className="text-gray-500 text-xs sm:text-sm">Compiling...</div>
        </div>
      </div>
    );
  }

  // Calculate safe initial frame (frame 15 or halfway through if template is shorter)
  const safeInitialFrame = Math.min(15, Math.floor(template.duration / 2));

  return (
    <div className="w-full h-full">
      <Player
        {...playerProps}
        controls={false}
        showVolumeControls={false}
        autoPlay={false}
        initialFrame={safeInitialFrame}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
};

// Template video player for hover state
const TemplateVideoPlayer = ({ template, format }: { template: TemplateDefinition; format: string }) => {
  const { component, isCompiling, compilationError, playerProps } = useCompiledTemplate(template, format);

  if (compilationError || isCompiling || !component) {
    // Fall back to thumbnail on error/loading
    return <TemplateThumbnail template={template} format={format} />;
  }

  return (
    <div className="w-full h-full">
      <Player
        {...playerProps}
        controls={false}
        showVolumeControls={false}
        autoPlay={true}
        loop={true}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
};

// Template preview component with thumbnail/video toggle
const TemplatePreview = ({ template, onClick, isLoading, format }: { 
  template: TemplateDefinition; 
  onClick: () => void;
  isLoading: boolean;
  format: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <div 
      className="relative w-full aspect-video bg-black rounded overflow-hidden cursor-pointer transition-all duration-200 group"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Show static frame 15 by default, playing video on hover */}
      {isHovered ? (
        <TemplateVideoPlayer template={template} format={format} />
      ) : (
        <TemplateThumbnail template={template} format={format} />
      )}
      
      {/* Loading overlay - only shows when loading, covers full card */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 z-10">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-white text-sm font-medium">Adding...</span>
          </div>
        </div>
      )}

      {/* Template name overlay - only visible on hover when not loading */}
      {isHovered && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 sm:p-3 z-10">
          <div className="text-white text-xs sm:text-sm font-medium">
            {template.name}
          </div>
          {/* Format compatibility indicators */}
          {template.supportedFormats && template.supportedFormats.length < 3 && (
            <div className="flex gap-1 mt-1">
              {template.supportedFormats.map(fmt => (
                <span 
                  key={fmt} 
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    fmt === format 
                      ? 'bg-green-500/80 text-white' 
                      : 'bg-white/20 text-white/70'
                  }`}
                >
                  {fmt === 'landscape' ? '16:9' : fmt === 'portrait' ? '9:16' : '1:1'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Get dimensions based on format
const getFormatDimensions = (format: string) => {
  switch (format) {
    case 'portrait':
      return { width: 1080, height: 1920 };
    case 'square':
      return { width: 1080, height: 1080 };
    case 'landscape':
    default:
      return { width: 1920, height: 1080 };
  }
};

// Real template compilation component  
const useCompiledTemplate = (template: TemplateDefinition, format: string = 'landscape') => {
  // Templates already have working React components - use them directly!
  const component = template.component;
  const isCompiling = false; // No compilation needed
  const compilationError = null; // No compilation errors
  const dimensions = getFormatDimensions(format);

  return { 
    component, 
    isCompiling, 
    compilationError,
    playerProps: {
      component,
      durationInFrames: template.duration,
      fps: 30,
      compositionWidth: dimensions.width,
      compositionHeight: dimensions.height,
    }
  };
};

export default function TemplatesPanelG({ projectId, onSceneGenerated }: TemplatesPanelGProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  
  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();
  
  // Get video state methods
  const { addScene, addAssistantMessage, getCurrentProps } = useVideoState();
  
  // Get current project format
  const currentFormat = getCurrentProps()?.meta?.format ?? 'landscape';
  
  // Direct template addition mutation - bypasses LLM pipeline
  const addTemplateMutation = api.generation.addTemplate.useMutation({
    onSuccess: async (result) => {
      setLoadingTemplateId(null);
      if (result.success && result.scene) {
        // Only show toast if there's a message
        if (result.message?.trim()) {
          toast.success(`${result.message}`);
        }
        console.log('[TemplatesPanelG] Template added successfully:', result.scene);
        
        // 🚨 CRITICAL: Update video state directly for immediate UI update
        console.log('[TemplatesPanelG] Updating video state directly...');
        
        // Add the scene to video state (addScene checks for duplicates internally)
        addScene(projectId, result.scene);
        
        // Note: The server already creates the "Added template:" message in the database
        // so we don't need to create it client-side to avoid duplicates
        
        // Still invalidate caches for consistency with database
        await utils.generation.getProjectScenes.invalidate({ projectId });
        await utils.chat.getMessages.invalidate({ projectId });
        
        // Call the callback if provided
        if (onSceneGenerated && result.scene?.id) {
          console.log('[TemplatesPanelG] Triggering additional video state update...');
          await onSceneGenerated(result.scene.id);
        }
        
        console.log('[TemplatesPanelG] ✅ Video state updated and caches invalidated');
      } else {
        toast.error("Failed to add template");
      }
    },
    onError: (error) => {
      setLoadingTemplateId(null);
      console.error('[TemplatesPanelG] Template addition failed:', error);
      toast.error(`Failed to add template: ${error.message}`);
    },
  });

  // Handle template addition
  const handleAddTemplate = useCallback(async (template: TemplateDefinition) => {
    console.log('[TemplatesPanelG] Adding template:', template.name);
    console.log('[TemplatesPanelG] Template object:', template);
    console.log('[TemplatesPanelG] Template code preview:', template.getCode().substring(0, 200) + '...');
    
    setLoadingTemplateId(template.id);
    
    const mutationParams = {
      projectId,
      templateId: template.id,
      templateName: template.name,
      templateCode: template.getCode(), // Get the code string for database storage
      templateDuration: template.duration,
    };
    
    console.log('[TemplatesPanelG] Mutation parameters:', mutationParams);
    
    addTemplateMutation.mutate(mutationParams);
  }, [projectId, addTemplateMutation]);

  // Filter templates based on search and format compatibility
  const filteredTemplates = useMemo(() => {
    let templates = TEMPLATES;
    
    // Filter by format compatibility
    templates = templates.filter(template => {
      // If template has no format restrictions, show it
      if (!template.supportedFormats || template.supportedFormats.length === 0) {
        return true;
      }
      // Otherwise, check if current format is supported
      return template.supportedFormats.includes(currentFormat);
    });
    
    // Filter by search query
    if (searchQuery.trim()) {
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return templates;
  }, [searchQuery, currentFormat]);
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search */}
      <div className="flex-none p-2 border-b">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates Grid - Mobile-responsive grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Format indicator */}
        <div className="mb-3 px-1">
          <div className="text-xs text-gray-500">
            Showing templates compatible with <span className="font-medium text-gray-700">
              {currentFormat === 'landscape' ? 'Landscape (16:9)' : 
               currentFormat === 'portrait' ? 'Portrait (9:16)' : 
               'Square (1:1)'}
            </span> format
          </div>
        </div>
        
        <div 
          className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"
        >
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="overflow-hidden hover:shadow-lg transition-shadow p-0">
              {/* Clickable Full-Size Preview with Frame 15 Thumbnail + Hover Video */}
              <TemplatePreview 
                template={template} 
                onClick={() => handleAddTemplate(template)}
                isLoading={loadingTemplateId === template.id}
                format={currentFormat}
              />
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <SearchIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No templates found</p>
            {searchQuery ? (
              <p className="text-xs mt-1">Try a different search term</p>
            ) : (
              <p className="text-xs mt-1">No templates available for {currentFormat} format</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}