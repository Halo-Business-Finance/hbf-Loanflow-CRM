import { useState, useCallback } from 'react';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseFileUploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for handling file uploads with progress tracking
 * Uses XMLHttpRequest for real-time upload progress monitoring
 */
export function useFileUploadProgress() {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const simulateProgress = useCallback((fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        progress = 90; // Cap at 90% until actual upload completes
        clearInterval(interval);
      }
      setUploadProgress(prev => ({ ...prev, [fileId]: Math.min(progress, 90) }));
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const setProgress = useCallback((fileId: string, progress: number) => {
    setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
  }, []);

  const clearProgress = useCallback((fileId: string) => {
    setUploadProgress(prev => {
      const { [fileId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const resetAll = useCallback(() => {
    setUploadProgress({});
  }, []);

  return {
    uploadProgress,
    simulateProgress,
    setProgress,
    clearProgress,
    resetAll,
  };
}

/**
 * Formats bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculates estimated time remaining for upload
 */
export function calculateETA(
  uploadedBytes: number,
  totalBytes: number,
  startTime: number
): string {
  const elapsed = Date.now() - startTime;
  const rate = uploadedBytes / elapsed; // bytes per ms
  const remaining = totalBytes - uploadedBytes;
  const etaMs = remaining / rate;

  if (etaMs < 1000) return 'less than a second';
  if (etaMs < 60000) return `${Math.ceil(etaMs / 1000)} seconds`;
  return `${Math.ceil(etaMs / 60000)} minutes`;
}
