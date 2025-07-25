"use client";

import React, { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { Loader2, XCircleIcon } from 'lucide-react';

export interface UploadedImage {
  id: string;
  file: File;
  status: 'uploading' | 'uploaded' | 'error';
  url?: string;
  error?: string;
  isLoaded?: boolean; // Track if the actual image has loaded
}

interface ImageUploadProps {
  uploadedImages: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  projectId: string;
  disabled?: boolean;
}

export function ImageUpload({
  uploadedImages,
  onImagesChange,
  projectId,
  disabled = false
}: ImageUploadProps) {
  // Image compression and AVIF conversion utility
  const compressImage = async (file: File): Promise<File> => {
    // Always convert AVIF to JPEG (since Anthropic API doesn't support AVIF)
    const isAVIF = file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
    const needsCompression = file.size >= 1024 * 1024; // 1MB+
    
    // Only process if it's AVIF or needs compression
    if (!isAVIF && !needsCompression) return file;
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Max 1920px width/height
          let { width, height } = img;
          const maxSize = 1920;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              // Fix filename extension for AVIF conversions
              const finalFileName = isAVIF 
                ? file.name.replace(/\.avif$/i, '.jpg')
                : file.name;
              
              console.log(`[ImageUpload] ${isAVIF ? '🔄 AVIF→JPEG conversion: ' : '📦 Compression: '}${file.name} → ${finalFileName}`);
              
              resolve(new File([blob!], finalFileName, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.85 // 85% quality
          );
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = useCallback(async (files: File[]) => {
    const newImages: UploadedImage[] = files.map(file => ({
      id: nanoid(),
      file,
      status: 'uploading' as const
    }));

    // Add new images to the list
    const updatedImages = [...uploadedImages, ...newImages];
    onImagesChange(updatedImages);

    // Upload each image to R2
    for (const image of newImages) {
      try {
        const fileToUpload = await compressImage(image.file);
        
        console.log(`[ImageUpload] 🖼️ Image compressed: ${image.file.size} → ${fileToUpload.size} bytes`);
        
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('projectId', projectId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Update the specific image with the URL
        onImagesChange(
          updatedImages.map(img => 
            img.id === image.id 
              ? { ...img, status: 'uploaded' as const, url: result.url, isLoaded: false }
              : img
          )
        );
      } catch (error) {
        console.error('Image upload failed:', error);
        // Update the specific image with error
        onImagesChange(
          updatedImages.map(img => 
            img.id === image.id 
              ? { ...img, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
              : img
          )
        );
      }
    }
  }, [uploadedImages, onImagesChange, projectId]);

  const handleDeleteImage = useCallback((imageId: string) => {
    onImagesChange(uploadedImages.filter(img => img.id !== imageId));
  }, [uploadedImages, onImagesChange]);

  const handleImageLoad = useCallback((imageId: string) => {
    onImagesChange(
      uploadedImages.map(img => 
        img.id === imageId 
          ? { ...img, isLoaded: true }
          : img
      )
    );
  }, [uploadedImages, onImagesChange]);

  if (uploadedImages.length === 0) return null;

  return (
    <div className="mb-3 flex gap-2 flex-wrap">
      {uploadedImages.map((image) => (
        <div key={image.id} className="relative border bg-gray-50 flex items-center justify-center group" style={{ borderRadius: '15px' }}>
          {/* Show loading spinner until image is fully loaded */}
          {(image.status === 'uploading' || (image.status === 'uploaded' && (!image.url || !image.isLoaded))) && (
            <div className="w-24 h-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
          {image.status === 'error' && (
            <div className="w-24 h-24 flex items-center justify-center">
              <XCircleIcon className="h-6 w-6 text-red-500" />
            </div>
          )}
          {/* Only show image when fully loaded */}
          {image.url && image.status === 'uploaded' && image.isLoaded && (
            <img 
              src={image.url} 
              alt="Upload preview" 
              className="max-w-32 max-h-32 w-auto h-auto"
              style={{ borderRadius: '15px' }}
            />
          )}
          {/* Hidden preloader to trigger onLoad without affecting layout */}
          {image.url && image.status === 'uploaded' && !image.isLoaded && (
            <img 
              src={image.url} 
              alt="" 
              className="absolute opacity-0 pointer-events-none"
              style={{ left: '-9999px' }}
              onLoad={() => handleImageLoad(image.id)}
            />
          )}
          {/* Delete button - always visible for uploaded images, hidden for uploading */}
          {image.status !== 'uploading' && (
            <button
              onClick={() => handleDeleteImage(image.id)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-colors opacity-40 hover:opacity-100"
              aria-label="Delete image"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Export utility functions for parent component to use
export const createImageUploadHandlers = (
  uploadedImages: UploadedImage[],
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>,
  projectId: string
) => {
  // Image compression utility (DEPRECATED - use main compressImage function above)
  const compressImage = async (file: File): Promise<File> => {
    // Always convert AVIF to JPEG (since Anthropic API doesn't support AVIF)
    const isAVIF = file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
    const needsCompression = file.size >= 1024 * 1024; // 1MB+
    
    // Only process if it's AVIF or needs compression
    if (!isAVIF && !needsCompression) return file;
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Max 1920px width/height
          let { width, height } = img;
          const maxSize = 1920;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              // Fix filename extension for AVIF conversions
              const finalFileName = isAVIF 
                ? file.name.replace(/\.avif$/i, '.jpg')
                : file.name;
              
              console.log(`[ImageUpload] ${isAVIF ? '🔄 AVIF→JPEG conversion: ' : '📦 Compression: '}${file.name} → ${finalFileName}`);
              
              resolve(new File([blob!], finalFileName, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.85 // 85% quality
          );
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (files: File[]) => {
    const newImages: UploadedImage[] = files.map(file => ({
      id: nanoid(),
      file,
      status: 'uploading' as const
    }));

    setUploadedImages([...uploadedImages, ...newImages]);

    // Upload each image to R2
    for (const image of newImages) {
      try {
        const fileToUpload = await compressImage(image.file);
        
        console.log(`[ImageUpload] 🖼️ Image compressed: ${image.file.size} → ${fileToUpload.size} bytes`);
        
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('projectId', projectId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        setUploadedImages(prev =>
          prev.map(img => 
            img.id === image.id 
              ? { ...img, status: 'uploaded' as const, url: result.url, isLoaded: false }
              : img
          )
        );
      } catch (error) {
        console.error('Image upload failed:', error);
        setUploadedImages(prev =>
          prev.map(img => 
            img.id === image.id 
              ? { ...img, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
              : img
          )
        );
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleImageUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleImageUpload(files);
    }
  };

  return {
    handleImageUpload,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
};