// src/components/client/PlayerShell.tsx
"use client";

import React, { useEffect } from 'react';
import { Player } from '@remotion/player';
import { DynamicVideo } from '~/remotion/compositions/DynamicVideo';
import { useVideoState } from '~/stores/videoState';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';
import { useTimeline } from '~/components/client/Timeline/TimelineContext';
import type { InputProps } from '~/types/input-props';

export function PlayerShell({ 
  projectId, 
  initial 
}: { 
  projectId: string;
  initial?: InputProps;
}) {
  const { getCurrentProps, replace } = useVideoState();
  const inputProps = getCurrentProps();
  // Video/Timeline synchronization
  const { playerRef, isPlaying, currentFrame } = useVideoPlayer();
  const { setPlayerRef, setIsPlaying: setTimelinePlaying, setCurrentFrame: setTimelineFrame } = useTimeline();
  
  // Set initial project data when provided
  useEffect(() => {
    if (initial && !inputProps) {
      replace(projectId, initial);
    }
  }, [initial, inputProps, replace]);

  // Register playerRef with timeline context
  useEffect(() => {
    if (playerRef.current) {
      setPlayerRef(playerRef.current);
    }
  }, [playerRef, setPlayerRef]);

  // Propagate play/pause state to timeline
  useEffect(() => setTimelinePlaying(isPlaying), [isPlaying, setTimelinePlaying]);

  // Update timeline currentFrame from player
  useEffect(() => setTimelineFrame(currentFrame), [currentFrame, setTimelineFrame]);

  if (!inputProps) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-pulse text-xl">Loading video preview...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
      
      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
        <Player
          ref={playerRef}
          component={DynamicVideo}
          durationInFrames={inputProps.meta.duration}
          fps={30}
          compositionWidth={1280}
          compositionHeight={720}
          inputProps={inputProps}
          style={{ width: '100%', height: 'auto', aspectRatio: '16/9' }}
          controls
          autoPlay
          loop
        />
      </div>
    </div>
  );
} 