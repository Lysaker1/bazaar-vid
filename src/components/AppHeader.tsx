"use client";
// src/components/AppHeader.tsx
import Image from "next/image";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DownloadIcon, LogOutIcon, CheckIcon, XIcon, ShareIcon, Copy, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { PromptUsageDropdown } from "~/components/usage/PromptUsageDropdown";
import { generateCleanFilename } from "~/lib/utils/filename";
import React from "react";

// Function to generate a consistent color based on the user's name
function stringToColor(string: string) {
  let hash = 0;
  for (let i = 0; i <string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}

// Avatar component that displays the first letter of the user's name
function UserAvatar({ name }: { name: string }) {
  const firstLetter = name.charAt(0).toUpperCase();
  const color = stringToColor(name);
  
  return (
    <div 
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-gray-200/60 transition-all shadow-sm"
      style={{ backgroundColor: color }}
    >
      {firstLetter}
    </div>
  );
}

interface AppHeaderProps {
  projectTitle?: string;
  onRename?: (newName: string) => void;
  isRenaming?: boolean;
  onRender?: () => void;
  isRendering?: boolean;
  user?: { name: string; email?: string };
  projectId?: string;
}

export default function AppHeader({
  projectTitle,
  onRename,
  isRenaming = false,
  onRender,
  isRendering = false,
  user,
  projectId,
}: AppHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newTitle, setNewTitle] = useState(projectTitle || "");
  const [isSharing, setIsSharing] = useState(false);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // Create share mutation
  const createShare = api.share.createShare.useMutation({
    onSuccess: async (data) => {
      // Try to copy to clipboard with fallback for Safari
      try {
        // Check if we're in a secure context and have clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(data.shareUrl);
          toast.success("Share link copied to clipboard!");
        } else {
          // Fallback method using execCommand
          const textArea = document.createElement("textarea");
          textArea.value = data.shareUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              toast.success("Share link copied to clipboard!");
            } else {
              // Show the URL in a toast with a copy button for Safari
              toast.info(
                <div className="flex flex-col gap-2">
                  <p>Share link created!</p>
                  <div className="flex items-center gap-2">
                    <input 
                      value={data.shareUrl} 
                      readOnly 
                      className="text-xs bg-gray-100 px-2 py-1 rounded flex-1"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button 
                      onClick={() => {
                        const input = document.querySelector<HTMLInputElement>('.sonner-toast input');
                        if (input) {
                          input.select();
                          document.execCommand('copy');
                          toast.success("Copied!");
                        }
                      }}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>,
                { duration: 10000 }
              );
            }
          } catch (err) {
            console.error("execCommand copy failed:", err);
            // Show URL in toast as final fallback
            toast.info(`Share link: ${data.shareUrl}`, { duration: 10000 });
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        // Show URL in toast as fallback
        toast.info(`Share link: ${data.shareUrl}`, { duration: 10000 });
      }
      setIsSharing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create share link");
      setIsSharing(false);
    },
  });

  // Export/render mutations
  const startRender = api.render.startRender.useMutation({
    onSuccess: (data) => {
      setRenderId(data.renderId);
      toast.info("Render started! This may take a few minutes...");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { data: renderStatus } = api.render.getRenderStatus.useQuery(
    { renderId: renderId! },
    {
      enabled: !!renderId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        return 1000;
      },
    }
  );

  // Handle export completion - auto-download
  React.useEffect(() => {
    if (renderStatus?.status === 'completed' && renderId && renderStatus.outputUrl && !hasDownloaded) {
      setHasDownloaded(true);
      toast.success('Render complete! Starting download...');
      
      // Auto-download after a short delay
      setTimeout(async () => {
        try {
          const response = await fetch(renderStatus.outputUrl!);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = generateCleanFilename(projectTitle || "video", "1080p", "mp4");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          
          // Reset state after successful download
          setTimeout(() => {
            setRenderId(null);
            setHasDownloaded(false);
          }, 1500);
        } catch (error) {
          console.error('Download failed:', error);
          toast.error('Download failed');
        }
      }, 1000);
    }
  }, [renderStatus, renderId, hasDownloaded, projectTitle]);

  const handleShare = () => {
    if (!projectId) return;
    
    setIsSharing(true);
    createShare.mutate({
      projectId,
      title: projectTitle,
    });
  };

  const handleDownload = () => {
    if (!projectId || startRender.isPending) return;
    
    // Trigger MP4 export at 1080p (high quality)
    startRender.mutate({
      projectId,
      format: "mp4",
      quality: "high", // 1080p maps to "high"
    });
  };

  const handleRenameClick = () => {
    if (onRename && newTitle.trim()) {
      onRename(newTitle);
    }
    setIsEditingName(false);
  };
  
  // Handle user logout
  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 w-full bg-background z-10" style={{ height: 68 }}>
      {/* Left: Logo only */}
      <div className="flex items-center min-w-[64px]">
        <a href="/?view" className="flex items-center" aria-label="Go to homepage">
          <Image src="/bazaar-logo.png" alt="Bazaar" width={79} height={30} className="object-contain" priority />
        </a>
      </div>

      {/* Center: Project Title - Hidden as requested */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center">
        {projectTitle ? (
          <div className="relative w-[280px] flex justify-center">
            {isEditingName ? (
              <div className="flex items-center w-full">
                <Input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-[240px] h-8 text-sm font-medium rounded-[15px] shadow-sm"
                  autoFocus
                  disabled={isRenaming}
                />
                <div className="flex items-center ml-2">
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="default" 
                    className="w-6 h-6 bg-green-500 hover:bg-green-600 mr-1 rounded-[8px] shadow-sm"
                    onClick={handleRenameClick} 
                    disabled={isRenaming}
                  >
                    <CheckIcon className="h-3 w-3 text-white" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="w-6 h-6 rounded-[8px] shadow-sm"
                    onClick={() => {
                      setNewTitle(projectTitle || "");
                      setIsEditingName(false);
                    }}
                    disabled={isRenaming}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <h1
                className="text-sm font-medium cursor-pointer hover:text-primary px-2 text-center"
                onClick={() => {
                  setNewTitle(projectTitle);
                  setIsEditingName(true);
                }}
              >
                {projectTitle}
              </h1>
            )}
          </div>
        ) : null}
      </div>

      {/* Right: Share button and User info */}
      <div className="flex items-center gap-2 min-w-[180px] justify-end">
        {/* Share button - simplified auto-copy functionality */}
        {projectId && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-[15px] shadow-sm border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? <Copy className="h-4 w-4 animate-pulse" /> : <ShareIcon className="h-4 w-4" />}
              {isSharing ? "Copied!" : "Share"}
            </Button>
            
            {/* Download button - MP4 1080p */}
            <Button
              variant="default"
              size="sm"
              className="gap-2 rounded-[15px] shadow-sm bg-black hover:bg-gray-800 text-white"
              onClick={handleDownload}
              disabled={startRender.isPending || !!renderId}
            >
              {startRender.isPending || !!renderId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
              {startRender.isPending || !!renderId ? "Rendering..." : "Download"}
            </Button>
          </>
        )}
        
        {user && (
          <div className="ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="outline-none">
                  <UserAvatar name={user.name || user.email || 'U'} />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-[15px] shadow-sm border-gray-100 overflow-hidden">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <PromptUsageDropdown />
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
