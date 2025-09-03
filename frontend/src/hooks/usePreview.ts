import { useState, useEffect, useRef } from 'react';
import { NDIApi } from '@/lib/api';

export const usePreview = () => {
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load current preview source on mount
  useEffect(() => {
    const loadCurrentSource = async () => {
      try {
        const source = await NDIApi.getPreviewSource();
        if (source) {
          setCurrentSource(source);
          startImagePolling();
        }
      } catch (error) {
        console.error('Failed to load current preview source:', error);
      }
    };

    loadCurrentSource();
  }, []);

  const startImagePolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(async () => {
      try {
        const image = await NDIApi.getPreviewImage();
        if (image && image !== 'FRAME_DATA_PLACEHOLDER') {
          setPreviewImage(image);
        }
      } catch (error) {
        console.error('Failed to get preview image:', error);
      }
    }, 100); // Poll every 100ms for smooth preview
  };

  const stopImagePolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const setPreviewSource = async (sourceName: string) => {
    try {
      setIsLoading(true);
      await NDIApi.setPreviewSource(sourceName);
      setCurrentSource(sourceName);
      setPreviewImage(null);
      startImagePolling();
    } catch (error) {
      console.error('Failed to set preview source:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPreview = async () => {
    try {
      await NDIApi.clearPreview();
      setCurrentSource(null);
      setPreviewImage(null);
      stopImagePolling();
    } catch (error) {
      console.error('Failed to clear preview:', error);
      throw error;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopImagePolling();
    };
  }, []);

  return {
    currentSource,
    previewImage,
    isLoading,
    setPreviewSource,
    clearPreview
  };
};