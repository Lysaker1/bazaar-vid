// src/app/projects/[id]/generate/workspace/panels/ChatPanelG.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { useVideoState } from '~/stores/videoState';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { Loader2, Send, ImageIcon, Sparkles } from 'lucide-react';
import { cn } from "~/lib/cn";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { GeneratingMessage } from "~/components/chat/GeneratingMessage";
import { MediaUpload, type UploadedMedia, createMediaUploadHandlers } from "~/components/chat/MediaUpload";
import { AudioTrimPanel } from "~/components/audio/AudioTrimPanel";
import { VoiceInput } from "~/components/chat/VoiceInput";
import { useAutoFix } from "~/hooks/use-auto-fix";
import { useSSEGeneration } from "~/hooks/use-sse-generation";
import { PurchaseModal } from "~/components/purchase/PurchaseModal";


// Component message representation for UI display
interface ComponentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  status?: "pending" | "error" | "success" | "building" | "tool_calling";
  kind?: "text" | "error" | "status" | "tool_result" | "scene_plan";
  imageUrls?: string[];
}

interface ChatPanelGProps {
  projectId: string;
  selectedSceneId: string | null;
  onSceneGenerated?: (sceneId: string) => void;
  userId?: string;
}

export default function ChatPanelG({
  projectId,
  selectedSceneId,
  onSceneGenerated,
  userId,
}: ChatPanelGProps) {
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'thinking' | 'generating'>('thinking');
  const [generationComplete, setGenerationComplete] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514'); // Default model
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  
  // 🚨 NEW: State for media uploads
  const [uploadedImages, setUploadedImages] = useState<UploadedMedia[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🚨 NEW: Auto-expanding textarea state
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Get video state and current scenes
  const { getCurrentProps, replace, updateAndRefresh, getProjectChatHistory, addUserMessage, addAssistantMessage, updateMessage, updateScene, deleteScene, removeMessage, setSceneGenerating, updateProjectAudio } = useVideoState();
  const currentProps = getCurrentProps();
  const scenes = currentProps?.scenes || [];
  
  // 🚨 SIMPLIFIED: Scene context logic - let Brain LLM handle scene targeting
  const selectedScene = selectedSceneId ? scenes.find((s: any) => s.id === selectedSceneId) : null;
  
  // ✅ SINGLE SOURCE OF TRUTH: Use only VideoState for messages
  const messages = getProjectChatHistory(projectId);
  
  // Debug: Log messages to check for duplicates
  // Commented out to prevent re-render spam
  // console.log('[ChatPanelG] Messages from VideoState:', messages.length);
  
  // Convert VideoState messages to component format for rendering
  const componentMessages: ComponentMessage[] = useMemo(() => {
    // ✅ DEDUPLICATE: Remove duplicate messages by ID to prevent React key errors
    const uniqueMessages = messages.filter((msg, index, array) => 
      array.findIndex(m => m.id === msg.id) === index
    );
    
    // Removed console.log to prevent re-render spam
    
    return uniqueMessages.map(msg => ({
      id: msg.id,
      content: msg.message,
      isUser: msg.isUser,
      timestamp: new Date(msg.timestamp),
      status: msg.status,
      kind: msg.kind,
      imageUrls: msg.imageUrls,
    }));
  }, [messages]);

  // ✅ BATCH LOADING: Get iterations for all messages at once
  const messageIds = componentMessages
    .filter(m => !m.isUser && m.id && !m.id.startsWith('_') && !m.id.startsWith('temp-') && !m.id.startsWith('optimistic-'))
    .map(m => m.id);

  const { data: messageIterations } = api.generation.getBatchMessageIterations.useQuery(
    { messageIds },
    { 
      enabled: messageIds.length > 0,
      staleTime: 60000, // Cache for 1 minute
    }
  );

  // ✅ CORRECT: Use the generation endpoint that goes through Brain Orchestrator
  const generateSceneMutation = api.generation.generateScene.useMutation();

  // Auto-scroll function
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);
  
  // 🚨 CRITICAL FIX: Use getProjectScenes instead of getById to get actual scene data
  const { data: scenesData, refetch: refetchScenes } = api.generation.getProjectScenes.useQuery({ projectId: projectId });
  
  // 🚨 NEW: Get tRPC utils for cache invalidation
  const utils = api.useUtils();
  
  // Use auto-fix hook early to ensure consistent hook order
  // IMPORTANT: This must be called before any conditional logic
  useAutoFix(projectId, scenes);
  
  // Helper function to convert database scenes to InputProps format (same as page.tsx)
  const convertDbScenesToInputProps = useCallback((dbScenes: any[]) => {
    let currentStart = 0;
    const convertedScenes = dbScenes.map((dbScene) => {
      const sceneDuration = dbScene.duration || 150; 
      const scene = {
        id: dbScene.id,
        type: 'custom' as const,
        start: currentStart,
        duration: sceneDuration,
        data: {
          code: dbScene.tsxCode,
          name: dbScene.name,
          componentId: dbScene.id,
          props: dbScene.props || {}
        }
      };
      currentStart += sceneDuration;
      return scene;
    });
    
    return {
      meta: {
        title: currentProps?.meta?.title || 'New Project',
        duration: currentStart,
        backgroundColor: currentProps?.meta?.backgroundColor || '#000000'
      },
      scenes: convertedScenes
    };
  }, [currentProps]);

  // 🚨 FIX: Smart auto-scroll that respects user scroll position
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Detect when user manually scrolls
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold
      
      if (!isAtBottom && !userHasScrolled) {
        setUserHasScrolled(true);
        setShouldAutoScroll(false);
      } else if (isAtBottom && userHasScrolled) {
        setUserHasScrolled(false);
        setShouldAutoScroll(true);
      }
    }
  }, [userHasScrolled]);
  
  // Auto-scroll only when appropriate
  useEffect(() => {
    if (shouldAutoScroll && !userHasScrolled) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [componentMessages, shouldAutoScroll, userHasScrolled, scrollToBottom]);

  
  // 🚀 [TICKET-006] Retry logic with exponential backoff
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      
      console.log(`[ChatPanelG] 🔄 Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
  };

  // Simple, honest loading message
  const getInitialLoadingMessage = () => {
    return "Processing your request...";
  };

  // ✅ HYBRID APPROACH: SSE for messages, mutation for generation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isGenerating) return;

    const trimmedMessage = message.trim();
    
    // 🚨 NEW: Get image and video URLs from uploaded media
    const imageUrls = uploadedImages
      .filter(img => img.status === 'uploaded' && img.url && img.type !== 'video')
      .map(img => img.url!);
    
    const videoUrls = uploadedImages
      .filter(img => img.status === 'uploaded' && img.url && img.type === 'video')
      .map(img => img.url!);
    
    if (imageUrls.length > 0) {
      console.log('[ChatPanelG] 🖼️ Including images in chat submission:', imageUrls);
    }
    
    if (videoUrls.length > 0) {
      console.log('[ChatPanelG] 🎥 Including videos in chat submission:', videoUrls);
    }
    
    // Show user message immediately
    addUserMessage(projectId, trimmedMessage, imageUrls.length > 0 ? imageUrls : undefined);
    
    // Clear input immediately for better UX
    setMessage("");
    setUploadedImages([]);
    setIsGenerating(true);
    setGenerationPhase('thinking'); // Start in thinking phase
    
    // Immediately scroll to bottom after adding messages
    setTimeout(() => {
      scrollToBottom();
    }, 50);
    
    // Let SSE handle DB sync in background
    generateSSE(trimmedMessage, imageUrls, videoUrls, selectedModel);
  };

  // Handle keyboard events for textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!message.trim() || isGenerating) return;
      
      // Trigger form submission directly
      const form = e.currentTarget.closest('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    }
  }, [message, isGenerating]);

  // Handle message input change
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  // ✅ NEW: Handle edit scene plan - copy prompt to input
  const handleEditScenePlan = useCallback((prompt: string) => {
    setMessage(prompt);
    // Focus the textarea after setting the message
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }
    }, 50);
  }, []);

  // 🚨 NEW: Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '20px'; // Reset to smaller initial height
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 10; // Smaller minimum height
      const lineHeight = 24; // Approximate line height
      const maxLines = 20;
      const maxHeight = lineHeight * maxLines;
      
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  // Auto-resize when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);


  // Create media upload handlers
  const imageHandlers = createMediaUploadHandlers(
    uploadedImages,
    setUploadedImages,
    projectId
  );

  // Wrap drag handlers to manage isDragOver state
  const handleDragOver = useCallback((e: React.DragEvent) => {
    imageHandlers.handleDragOver(e);
    setIsDragOver(true);
  }, [imageHandlers]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    imageHandlers.handleDragLeave(e);
    setIsDragOver(false);
  }, [imageHandlers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    imageHandlers.handleDrop(e);
    setIsDragOver(false);
  }, [imageHandlers]);

  // Handle audio extraction from video
  const handleAudioExtract = useCallback(async (videoMedia: UploadedMedia) => {
    if (!videoMedia.url) {
      toast.error('Video not ready for audio extraction');
      return;
    }
    
    console.log('[ChatPanelG] Extracting audio from video:', videoMedia.file.name);
    
    // Create an audio track using the video URL (Remotion can extract audio from video)
    const audioTrack = {
      id: nanoid(),
      url: videoMedia.url, // Same URL - Remotion will handle audio extraction
      name: videoMedia.file.name.replace(/\.(mp4|mov|webm|avi|mkv)$/i, '') + ' (Audio)',
      duration: 30, // Default duration - will be updated when loaded
      startTime: 0,
      endTime: 30,
      volume: 0.7, // Default volume
      fadeInDuration: 0.5, // Nice default fade
      fadeOutDuration: 0.5,
      playbackRate: 1
    };
    
    // Update project audio state
    updateProjectAudio(projectId, audioTrack);
    
    toast.success(`Audio extracted from ${videoMedia.file.name}`);
  }, [updateProjectAudio, projectId]);

  // Reset component state when projectId changes (for new projects)
  useEffect(() => {
    setMessage("");
    setIsGenerating(false);
    setGenerationPhase('thinking');
    setGenerationComplete(false);
    setUploadedImages([]); // 🚨 NEW: Clear uploaded images when switching projects
    
    console.log('[ChatPanelG] Reset state for new project:', projectId);
  }, [projectId]);

  // Auto-mark first scene plan as generating and poll for completion
  useEffect(() => {
    const scenePlanMessages = componentMessages.filter(msg => 
      msg.kind === 'scene_plan' && !msg.isUser
    );
    
    if (scenePlanMessages.length > 0) {
      const firstScenePlan = scenePlanMessages[0];
      
      // Auto-generate Scene 1 with a small delay
      const timeoutId = setTimeout(() => {
        if (firstScenePlan?.id && projectId) {
          console.log('[ChatPanelG] Auto-marking first scene as generating:', firstScenePlan.id);
          setSceneGenerating(projectId, firstScenePlan.id, true);
          
          // Poll for completion by checking message updates
          let pollCount = 0;
          const maxPolls = 30; // 30 seconds max
          
          const pollInterval = setInterval(async () => {
            pollCount++;
            
            try {
              // Refetch messages to check if scene was created
              await utils.chat.getMessages.invalidate({ projectId });
              
              // Check if the message has been updated to show completion
              const currentMessages = await utils.chat.getMessages.fetch({ projectId });
              const updatedMessage = currentMessages.find(msg => msg.id === firstScenePlan.id);
              
              if (updatedMessage && (
                updatedMessage.content.includes('created successfully') ||
                updatedMessage.kind === 'status'
              )) {
                // Scene created successfully
                console.log('[ChatPanelG] Scene creation completed for:', firstScenePlan.id);
                setSceneGenerating(projectId, firstScenePlan.id, false);
                clearInterval(pollInterval);
              } else if (updatedMessage && (
                updatedMessage.content.includes('Failed')
              )) {
                // Scene creation failed
                console.log('[ChatPanelG] Scene creation failed for:', firstScenePlan.id);
                setSceneGenerating(projectId, firstScenePlan.id, false);
                clearInterval(pollInterval);
              } else if (pollCount >= maxPolls) {
                // Timeout - stop polling
                console.log('[ChatPanelG] Scene creation timeout for:', firstScenePlan.id);
                setSceneGenerating(projectId, firstScenePlan.id, false);
                clearInterval(pollInterval);
              }
            } catch (error) {
              console.error('[ChatPanelG] Error polling for scene creation:', error);
              setSceneGenerating(projectId, firstScenePlan.id, false);
              clearInterval(pollInterval);
            }
          }, 1000); // Poll every second
          
          // Store interval ID for cleanup
          return () => {
            clearInterval(pollInterval);
          };
        }
      }, 500);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [componentMessages, projectId, setSceneGenerating, utils]);



  // Check if content has multiple lines
  const hasMultipleLines = message.split('\n').length > 1 || message.includes('\n');

  // NOTE: useAutoFix moved to top of component to ensure consistent hook order

  // No need for pendingMessageRef - data will come from SSE
  
  // Handle revert action
  const [isReverting, setIsReverting] = useState(false);
  const revertMutation = api.generation.revertToIteration.useMutation();
  
  const handleRevert = useCallback(async (messageId: string) => {
    // No confirmation needed - ChatMessage component handles the two-click confirmation
    setIsReverting(true);
    
    try {
      // Get iterations for this message
      const iterations = await utils.generation.getMessageIterations.fetch({ 
        messageId 
      });
      
      if (iterations.length === 0) {
        toast.error('No scene changes found for this message');
        return;
      }
      
      console.log('[ChatPanelG] Found iterations:', iterations);
      
      // For now, revert all iterations linked to this message
      for (const iteration of iterations) {
        const result = await revertMutation.mutateAsync({
          projectId,
          iterationId: iteration.id,
          messageId,
        });
        
        console.log('[ChatPanelG] Revert result:', result);
        
        // Handle the reverted scene based on operation
        const responseData = result as any;
        const revertedScene = responseData.data;
        const operation = responseData.meta?.operation;
        
        if (revertedScene) {
          if (operation === 'scene.create') {
            // Scene was restored (was deleted)
            const currentScenes = getCurrentProps()?.scenes || [];
            const lastScene = currentScenes[currentScenes.length - 1];
            const startTime = lastScene ? (lastScene.start + lastScene.duration) : 0;
            
            const transformedScene = {
              id: revertedScene.id,
              type: 'custom' as const,
              start: startTime,
              duration: revertedScene.duration || 150,
              data: {
                code: revertedScene.tsxCode,
                name: revertedScene.name || 'Restored Scene',
                componentId: revertedScene.id,
                props: revertedScene.props || {}
              }
            };
            
            const updatedScenes = [...currentScenes, transformedScene];
            const currentPropsData = getCurrentProps();
            
            if (currentPropsData) {
              const updatedProps = {
                ...currentPropsData,
                scenes: updatedScenes,
                meta: {
                  ...currentPropsData.meta,
                  duration: updatedScenes.reduce((sum: number, s: any) => sum + s.duration, 0),
                }
              };
              
              replace(projectId, updatedProps);
            }
          } else {
            // Scene was updated
            updateScene(projectId, revertedScene.id, revertedScene);
          }
        }
      }
      
      // Refresh and show success
      await updateAndRefresh(projectId, (props) => props);
      toast.success('Successfully reverted to previous version');
      
    } catch (error) {
      console.error('[ChatPanelG] Revert error:', error);
      toast.error('Failed to revert changes');
    } finally {
      setIsReverting(false);
    }
  }, [projectId, revertMutation, utils, getCurrentProps, replace, updateScene, updateAndRefresh]);

  // Enhance prompt mutation
  const enhancePromptMutation = api.generation.enhancePrompt.useMutation({
    onSuccess: (result) => {
      setMessage(result.enhancedPrompt);
      // Auto-resize the textarea after setting enhanced prompt
      setTimeout(() => {
        adjustTextareaHeight();
        if (textareaRef.current) {
          textareaRef.current.focus();
          // Move cursor to end
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 50);
    },
    onError: (error) => {
      console.error('Failed to enhance prompt:', error);
      toast.error('Failed to enhance prompt');
    }
  });

  // Handle enhance prompt
  const handleEnhancePrompt = useCallback(async () => {
    if (!message.trim() || isEnhancing || isGenerating) return;
    
    setIsEnhancing(true);
    
    try {
      const currentProps = getCurrentProps();
      await enhancePromptMutation.mutateAsync({
        prompt: message.trim(),
        videoFormat: {
          format: currentProps?.meta?.format || 'landscape',
          width: currentProps?.meta?.width || 1920,
          height: currentProps?.meta?.height || 1080
        }
      });
      
      toast.success('Prompt enhanced!', {
        description: 'Your prompt has been expanded with more detail',
        duration: 2000
      });
    } finally {
      setIsEnhancing(false);
    }
  }, [message, isEnhancing, isGenerating, enhancePromptMutation]);

  // Use SSE generation hook
  const { generate: generateSSE, cleanup: cancelSSE } = useSSEGeneration({
    projectId,
    onMessageCreated: async (messageId, data) => {
      console.log('[ChatPanelG] ✅ SSE ready with data:', data);
      // messageId is undefined when creating new assistant message
      
      // Now trigger the actual generation using data from SSE
      if (data?.userMessage) {
        const { userMessage, imageUrls = [], videoUrls = [], modelOverride } = data;
        
        // Switch to generating phase when SSE is ready and we start the mutation
        setGenerationPhase('generating');
        
        try {
          const result = await generateSceneMutation.mutateAsync({
            projectId,
            userMessage,
            userContext: {
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
              modelOverride: modelOverride,
            },
            // Don't pass assistantMessageId - let mutation create it
            metadata: {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          });
          
          console.log('[ChatPanelG] ✅ Generation completed:', result);
          
          // The result contains the actual response
          const responseData = result as any;
          
          // Check if the response indicates an error (success: false)
          if (responseData?.meta?.success === false || responseData?.error) {
            const errorMessage = responseData?.error?.message || '';
            console.log('[ChatPanelG] Generation failed with error:', errorMessage);
            
            // Check if this is a rate limit error
            if (errorMessage.includes('Daily limit reached') || 
                errorMessage.includes('Buy more prompts') ||
                errorMessage.includes('prompt limit') ||
                responseData?.error?.code === 'RATE_LIMITED') {
              console.log('[ChatPanelG] Rate limit reached, showing purchase modal');
              setIsPurchaseModalOpen(true);
              toast.error('You\'ve reached your daily prompt limit. Please purchase more prompts to continue.');
              return;
            } else {
              // Show other error messages
              toast.error(errorMessage || 'Failed to generate scene');
              return;
            }
          }
          
          // Get the assistant message ID from the response
          const assistantMessageId = responseData.assistantMessageId;
          
          // ✅ NEW: Get additional message IDs from scene planner
          const additionalMessageIds = responseData.additionalMessageIds || [];
          
          if (assistantMessageId) {
            // First, add the assistant message to VideoState since it doesn't exist yet
            const aiResponse = responseData.context?.chatResponse || 
                              responseData.chatResponse || 
                              responseData.message || 
                              'Scene generated successfully.';
            
            // Add the assistant message to VideoState
            addAssistantMessage(projectId, assistantMessageId, aiResponse);
            
            // Then update its status to success
            updateMessage(projectId, assistantMessageId, {
              status: 'success'
            });
            
            // Hide the pulsating message immediately when we have the real message
            setIsGenerating(false);
            setGenerationPhase('thinking'); // Reset phase
          }
          
          // ✅ NEW: Add scene plan messages to VideoState immediately
          if (additionalMessageIds.length > 0) {
            console.log(`[ChatPanelG] ✅ SCENE PLANNER: Adding ${additionalMessageIds.length} scene plan messages to VideoState:`, additionalMessageIds);
            
            // Force a re-fetch of messages to get the scene plan content from database
            await utils.chat.getMessages.invalidate({ projectId });
            
            // Note: We don't manually add these messages to VideoState because:
            // 1. They already exist in the database with proper content
            // 2. The invalidation above will trigger a refresh that includes them
            // 3. The syncDbMessages effect will automatically sync them to VideoState
          }
          
          // Check if this is a clarification response
          if (responseData.context?.needsClarification) {
            console.log('[ChatPanelG] ✅ Received clarification request:', responseData.context.chatResponse);
            // No scene to process, clarification message already added above
            // Early return to skip scene processing
            return;
          }
          
          // Process scene normally
          const actualScene = responseData.data;
          const operation = responseData.meta?.operation;
          
          if (actualScene) {
              // Get current scenes to calculate start time
              const currentScenes = getCurrentProps()?.scenes || [];
              
              if (operation === 'scene.delete') {
                // For delete operations, remove the scene from VideoState
                deleteScene(projectId, actualScene.id);
                
                console.log('[ChatPanelG] ✅ Deleted scene from VideoState:', {
                  sceneId: actualScene.id,
                  sceneName: actualScene.name
                });
                
                // Invalidate the scenes query to ensure fresh data
                await utils.generation.getProjectScenes.invalidate({ projectId });
                
              } else if (operation === 'scene.edit' || operation === 'scene.update') {
                // For edits, use the updateScene method from VideoState
                updateScene(projectId, actualScene.id, actualScene);
                
                console.log('[ChatPanelG] ✅ Updated scene via updateScene:', {
                  sceneId: actualScene.id,
                  operation
                });
                
                // Invalidate the scenes query to ensure fresh data
                await utils.generation.getProjectScenes.invalidate({ projectId });
                
                // Call the callback if provided
                if (onSceneGenerated) {
                  onSceneGenerated(actualScene.id);
                }
              } else if (operation === 'scene.create' || !operation) {
                // For create operations
                const lastScene = currentScenes[currentScenes.length - 1];
                const startTime = lastScene ? (lastScene.start + lastScene.duration) : 0;
                
                // Transform database format to InputProps format
                const transformedScene = {
                  id: actualScene.id,
                  type: 'custom' as const,
                  start: startTime,
                  duration: actualScene.duration || 180,
                  data: {
                    code: actualScene.tsxCode,
                    name: actualScene.name || 'Generated Scene',
                    componentId: actualScene.id,
                    props: actualScene.props || {}
                  }
                };
                
                // Check if this is a welcome project
                const isWelcomeProject = currentScenes.length === 1 && 
                  (currentScenes[0]?.data?.name === 'Welcome Scene' ||
                   currentScenes[0]?.data?.isWelcomeScene === true ||
                   currentScenes[0]?.type === 'welcome');
                
                // If welcome project, replace the welcome scene; otherwise append
                const updatedScenes = isWelcomeProject 
                  ? [transformedScene]
                  : [...currentScenes, transformedScene];
                
                const currentPropsData = getCurrentProps();
                if (currentPropsData) {
                  const updatedProps = {
                    ...currentPropsData,
                    scenes: updatedScenes,
                    meta: {
                      ...currentPropsData.meta,
                      duration: updatedScenes.reduce((sum: number, s: any) => sum + s.duration, 0),
                      title: currentPropsData.meta?.title || 'New Project'
                    }
                  };
                  
                  replace(projectId, updatedProps);
                  
                  console.log('[ChatPanelG] ✅ Added scene to VideoState:', {
                    sceneId: transformedScene.id,
                    totalScenes: updatedScenes.length,
                    replacedWelcome: isWelcomeProject
                  });
                  
                  // Invalidate the scenes query to ensure fresh data
                  await utils.generation.getProjectScenes.invalidate({ projectId });
                  
                  // Call the callback if provided
                  if (onSceneGenerated) {
                    onSceneGenerated(transformedScene.id);
                  }
                }
              }
            }
          
        } catch (error: any) {
          console.error('[ChatPanelG] Generation failed:', error);
          console.log('[ChatPanelG] Error structure:', {
            message: error?.message,
            code: error?.code,
            cause: error?.data?.cause,
            data: error?.data,
            shape: error?.shape,
            fullError: JSON.stringify(error, null, 2)
          });
          
          // Check if this is a rate limit error from the mutation
          // In the catch block, we only have the error object
          const errorMessage = error?.message || '';
          
          const isRateLimitError = 
            errorMessage.includes('Daily limit reached') ||
            errorMessage.includes('Buy more prompts') ||
            errorMessage.includes('prompt limit') ||
            error?.data?.cause?.code === 'RATE_LIMITED';
            
          console.log('[ChatPanelG] Error message:', errorMessage);
          console.log('[ChatPanelG] Is rate limit error?', isRateLimitError);
          
          if (isRateLimitError) {
            console.log('[ChatPanelG] Rate limit error caught, showing purchase modal');
            setIsPurchaseModalOpen(true);
            // Also show a toast to confirm
            toast.error('You\'ve reached your daily prompt limit. Please purchase more prompts to continue.');
          } else {
            // Show generic error message
            toast.error(errorMessage || 'Failed to generate scene');
          }
          
          // No optimistic messages to clean up
        } finally {
          setIsGenerating(false);
          setGenerationPhase('thinking'); // Reset to thinking phase
          setGenerationComplete(true);
          
          // Always invalidate scenes to ensure UI is in sync with database
          await utils.generation.getProjectScenes.invalidate({ projectId });
        }
      }
    },
    onComplete: () => {
      console.log('[ChatPanelG] SSE completed');
    },
    onError: (error: string) => {
      console.error('[ChatPanelG] SSE error:', error);
      
      // Check if this is a rate limit error
      if (error.includes('RATE_LIMITED') || error.includes('Daily prompt limit reached')) {
        console.log('[ChatPanelG] Rate limit error from SSE, showing purchase modal');
        setIsPurchaseModalOpen(true);
      } else {
        toast.error(error);
      }
      
      setIsGenerating(false);
      setGenerationPhase('thinking'); // Reset to thinking phase
    }
  });

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      cancelSSE();
    };
  }, [cancelSSE]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4" onScroll={handleScroll}>
        <div className="space-y-4">
          {componentMessages.map((msg, index) => {
          // Find all scene plan messages
          const scenePlanMessages = componentMessages.filter(m => m.kind === 'scene_plan');
          const isFirstScenePlan = msg.kind === 'scene_plan' && scenePlanMessages[0]?.id === msg.id;
          const totalScenePlans = scenePlanMessages.length;
          
          return (
            <ChatMessage
              key={msg.id}
              message={{
                id: msg.id,
                message: msg.content,
                isUser: msg.isUser,
                timestamp: msg.timestamp.getTime(),
                status: msg.status,
                kind: msg.kind,
                imageUrls: msg.imageUrls,
              }}
              onImageClick={(imageUrl) => {
                // TODO: Implement image click handler
                console.log('Image clicked:', imageUrl);
              }}
              projectId={projectId}
              userId={userId}
              onRevert={isReverting ? undefined : handleRevert}
              onEditScenePlan={handleEditScenePlan}
              hasIterations={messageIterations?.[msg.id] ? messageIterations[msg.id]!.length > 0 : false}
              isFirstScenePlan={isFirstScenePlan}
              totalScenePlans={totalScenePlans}
            />
          );
          })}
          
          {/* Show pulsating message UI when generating */}
          {isGenerating && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 max-w-[80%]">
                <GeneratingMessage phase={generationPhase} />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="p-4">


        {/* Media upload preview area */}
        <MediaUpload
          uploadedMedia={uploadedImages}
          onMediaChange={setUploadedImages}
          projectId={projectId}
          onAudioExtract={handleAudioExtract}
        />

        {/* Current operation indicator removed to prevent duplicate "Analyzing your request..." messages */}
        
        <form onSubmit={handleSubmit} className="flex items-end" autoComplete="off">
          <div 
            className={cn(
              "flex-1 relative rounded-2xl border border-gray-300 bg-white shadow-sm",
              "focus-within:border-gray-400 focus-within:shadow-md transition-all",
              isDragOver && "border-blue-500 bg-blue-50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Text area container with fixed height that stops before icons */}
            <div className="flex flex-col w-full">
              <div className="relative">
                <textarea
                  key="chat-input"
                  ref={textareaRef}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                  placeholder={!message ? "Describe what you want to create" : ""}
                  className={cn(
                    "w-full resize-none bg-transparent border-none",
                    "px-3 py-1 text-sm leading-6",
                    "focus:outline-none focus:ring-0",
                    "rounded-t-2xl"
                  )}
                  style={{
                    height: '32px',
                    maxHeight: '480px',
                    overflowY: "auto"
                  }}
                />
              </div>

              {/* Icon row at bottom - completely separate from text area */}
              <div className="flex items-center justify-between px-3 py-1">
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Upload images"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>

                  <VoiceInput 
                    onTranscription={(text) => {
                      setMessage(prevMessage => {
                        const newMessage = prevMessage.trim() 
                          ? `${prevMessage} ${text}` 
                          : text;
                      return newMessage;
                    });
                  }}
                  />
                </div>

                <div className="flex gap-2 items-center">
                  {/* Enhance Prompt Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleEnhancePrompt}
                          disabled={!message.trim() || isEnhancing || isGenerating}
                          className={cn(
                            "p-1 rounded-full transition-all duration-200",
                            message.trim() && !isEnhancing && !isGenerating
                              ? "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              : "text-gray-400 cursor-not-allowed"
                          )}
                          aria-label="Enhance prompt"
                        >
                          {isEnhancing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Enhance Prompt</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    type="submit"
                    disabled={!message.trim() || isGenerating}
                    className={cn(
                      "w-8 h-8 rounded-full bg-black hover:bg-gray-800 p-0",
                      isGenerating && "opacity-60"
                    )}
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            onChange={imageHandlers.handleFileSelect}
            className="hidden"
          />
        </form>
      </div>
      
      {/* Purchase Modal */}
      <PurchaseModal 
        isOpen={isPurchaseModalOpen} 
        onClose={() => setIsPurchaseModalOpen(false)} 
      />
    </div>
  );
}