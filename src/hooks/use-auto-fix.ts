"use client";

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from "~/trpc/react";
import { useVideoState } from '~/stores/videoState';
import type { ErrorDetails } from '~/components/chat/AutoFixErrorBanner';

interface Scene {
  id: string;
  [key: string]: any;
}

export function useAutoFix(projectId: string, scenes: Scene[]) {
  const [sceneErrors, setSceneErrors] = useState<Map<string, ErrorDetails>>(new Map());
  const generateSceneMutation = api.generation.generateScene.useMutation();
  const utils = api.useUtils();
  const { refetch: refetchScenes } = api.generation.getProjectScenes.useQuery({ projectId });
  
  const { 
    getCurrentProps, 
    updateAndRefresh, 
    addUserMessage, 
    addAssistantMessage, 
    updateMessage 
  } = useVideoState();

  // Helper function to convert database scenes to InputProps format
  const convertDbScenesToInputProps = useCallback((dbScenes: any[]) => {
    let currentStart = 0;
    const currentProps = getCurrentProps();
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
  }, [getCurrentProps]);

  const handleAutoFix = useCallback(async (sceneId: string) => {
    const errorDetails = sceneErrors.get(sceneId);
    if (!errorDetails) {
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: No error details for scene:', sceneId);
      return;
    }
    
    // Check if scene still exists
    const sceneStillExists = scenes.some(s => s.id === sceneId);
    if (!sceneStillExists) {
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Scene no longer exists:', sceneId);
      // Clean up the error
      setSceneErrors(prev => {
        const next = new Map(prev);
        next.delete(sceneId);
        return next;
      });
      return;
    }
    
    // More explicit prompt for brain orchestrator
    const fixPrompt = `🔧 FIX BROKEN SCENE: Scene "${errorDetails.sceneName}" (ID: ${sceneId}) has a compilation error. The error message is: "${errorDetails.errorMessage}". This scene needs to be fixed using the fixBrokenScene tool. The broken code is in the scene with ID ${sceneId}.`;
    
    console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Starting autofix flow:', {
      sceneId: sceneId,
      sceneName: errorDetails.sceneName,
      errorMessage: errorDetails.errorMessage,
      fixPrompt: fixPrompt
    });
    
    // ✅ IMMEDIATE: Add user message to chat right away (like normal chat)
    addUserMessage(projectId, fixPrompt);
    
    // ✅ IMMEDIATE: Add assistant loading message
    const assistantMessageId = `assistant-fix-${Date.now()}`;
    addAssistantMessage(projectId, assistantMessageId, '🔧 Analyzing and fixing scene error...');
    
    console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Sending fix request to backend...');
    
    try {
      const result = await generateSceneMutation.mutateAsync({
        projectId,
        userMessage: fixPrompt,
        userContext: {
          imageUrls: undefined
        }
      });

      // ✅ CRITICAL: Force complete state refresh after successful fix
      const responseData = result as any;
      if (responseData.data || responseData.meta?.success) {
        console.log('[useAutoFix] 🔧 Auto-fix successful, force refreshing all state...');
        
        // ✅ STEP 1: Invalidate tRPC cache FIRST
        console.log('[useAutoFix] ♻️ Auto-fix: Invalidating tRPC cache...');
        await utils.generation.getProjectScenes.invalidate({ projectId });
        
        // ✅ STEP 2: Fetch latest scene data
        console.log('[useAutoFix] 🔄 Auto-fix: Fetching fresh scenes...');
        const updatedScenes = await refetchScenes();
        
        if (updatedScenes.data && updatedScenes.data.length > 0) {
          // ✅ STEP 3: Convert and update with guaranteed refresh
          const updatedProps = convertDbScenesToInputProps(updatedScenes.data);
          
          console.log('[useAutoFix] 🚀 Auto-fix: Using updateAndRefresh for guaranteed sync...');
          updateAndRefresh(projectId, () => updatedProps);
          
          console.log('[useAutoFix] ✅ Auto-fix complete - preview should show fixed scene');
        }
      }
      
      // Update assistant message with success
      updateMessage(projectId, assistantMessageId, {
        content: `✅ Scene error fixed successfully!`,
        status: 'success'
      });
      
    } catch (error) {
      console.error('Auto-fix failed:', error);
      
      // Update assistant message with error
      updateMessage(projectId, assistantMessageId, {
        content: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error'
      });
    } finally {
      // Clean up the error for this scene after successful fix
      setSceneErrors(prev => {
        const next = new Map(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }, [sceneErrors, scenes, projectId, generateSceneMutation, utils, refetchScenes, convertDbScenesToInputProps, updateAndRefresh, addUserMessage, addAssistantMessage, updateMessage]);

  // Listen for preview panel errors
  useEffect(() => {
    const handlePreviewError = (event: CustomEvent) => {
      const { sceneId, sceneName, error } = event.detail;
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Preview error detected:', { 
        sceneId, 
        sceneName, 
        error: error?.message || String(error),
        errorType: typeof error,
        fullEvent: event.detail 
      });
      
      // Track scene error with Map
      setSceneErrors(prev => {
        const next = new Map(prev);
        next.set(sceneId, {
          sceneName,
          errorMessage: error?.message || String(error),
          timestamp: Date.now()
        });
        return next;
      });

      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Error state updated for scene:', sceneId);
      
      // Also show a toast notification for immediate feedback
      toast.error(`Scene "${sceneName}" has an error - AutoFix available!`, {
        duration: 5000,
        action: {
          label: "Auto-Fix",
          onClick: () => {
            console.log('[useAutoFix] 🔧 AUTOFIX: Toast action clicked for scene:', sceneId);
            handleAutoFix(sceneId);
          }
        }
      });
    };

    // Also listen for direct autofix triggers from error boundaries
    const handleDirectAutoFix = (event: CustomEvent) => {
      const { sceneId, sceneName, error } = event.detail;
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Direct autofix trigger received:', { 
        sceneId, 
        sceneName, 
        error 
      });
      
      // Set error state and immediately trigger autofix
      setSceneErrors(prev => {
        const next = new Map(prev);
        next.set(sceneId, {
          sceneName,
          errorMessage: error?.message || String(error),
          timestamp: Date.now()
        });
        return next;
      });
      
      // Immediately trigger autofix without waiting for button click
      setTimeout(() => {
        handleAutoFix(sceneId);
      }, 100);
    };

    // Clean up stale errors when scenes are removed
    const handleSceneDeleted = (event: CustomEvent) => {
      const { sceneId } = event.detail;
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Scene deleted, cleaning up error state:', sceneId);
      
      setSceneErrors(prev => {
        if (!prev.has(sceneId)) return prev;
        const next = new Map(prev);
        next.delete(sceneId);
        return next;
      });
    };

    console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Setting up preview-scene-error listener');
    window.addEventListener('preview-scene-error', handlePreviewError as EventListener);
    window.addEventListener('trigger-autofix', handleDirectAutoFix as EventListener);
    window.addEventListener('scene-deleted', handleSceneDeleted as EventListener);
    
    return () => {
      console.log('[useAutoFix] 🔧 AUTOFIX DEBUG: Removing preview-scene-error listener');
      window.removeEventListener('preview-scene-error', handlePreviewError as EventListener);
      window.removeEventListener('trigger-autofix', handleDirectAutoFix as EventListener);
      window.removeEventListener('scene-deleted', handleSceneDeleted as EventListener);
    };
  }, [handleAutoFix, scenes]);

  return {
    sceneErrors,
    handleAutoFix
  };
}