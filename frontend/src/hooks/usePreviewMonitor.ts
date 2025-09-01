import { useState, useEffect, useCallback, useRef } from 'react';
import { NDIApi } from '@/lib/api';
import { useServerConnection } from './useServerConnection';

export const usePreviewMonitor = () => {
  const { isConnected } = useServerConnection();
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Convert raw frame data to data URL for display
  const processFrameData = useCallback((frameData: ArrayBuffer): string | null => {
    if (!frameData || frameData.byteLength < 8) {
      return null;
    }

    try {
      const dataView = new DataView(frameData);
      const width = dataView.getUint32(0, true);  // little endian
      const height = dataView.getUint32(4, true);

      if (width <= 0 || height <= 0) {
        return null;
      }

      // Create canvas and draw RGB data
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return null;
      }

      const imageData = ctx.createImageData(width, height);
      const rgbData = new Uint8Array(frameData, 8); // Skip 8-byte header

      // Convert RGB to RGBA
      for (let i = 0; i < width * height; i++) {
        const srcIndex = i * 3;
        const dstIndex = i * 4;
        
        imageData.data[dstIndex + 0] = rgbData[srcIndex + 0]; // R
        imageData.data[dstIndex + 1] = rgbData[srcIndex + 1]; // G
        imageData.data[dstIndex + 2] = rgbData[srcIndex + 2]; // B
        imageData.data[dstIndex + 3] = 255; // A
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error processing frame data:', err);
      return null;
    }
  }, []);

  // Fetch current preview frame
  const captureFrame = useCallback(async () => {
    if (!isConnected || !currentSource) {
      return;
    }

    try {
      const frameData = await NDIApi.getPreviewFrame();
      if (frameData) {
        const imageUrl = processFrameData(frameData);
        if (imageUrl) {
          setPreviewImage(imageUrl);
        }
        // Don't clear preview image if frame processing fails - keep showing last good frame
      }
      // Don't clear preview image if no frame data - this is normal for test patterns and during connection
    } catch (err) {
      // Don't show errors for frame capture failures - they're normal during connection
      console.debug('Frame capture failed:', err);
      // Don't clear preview image on errors - keep showing last good frame
    }
  }, [isConnected, currentSource, processFrameData]);

  // Set preview source
  const setPreviewSource = useCallback(async (sourceName: string | null) => {
    if (!isConnected) {
      setError('Server not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (sourceName) {
        await NDIApi.setPreviewSource(sourceName);
        setCurrentSource(sourceName);
      } else {
        await NDIApi.clearPreviewSource();
        setCurrentSource(null);
        setPreviewImage(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set preview source';
      setError(message);
      console.error('Preview source error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Start/stop frame capture interval
  useEffect(() => {
    if (isConnected && currentSource) {
      // Capture frames at ~10 FPS for preview
      intervalRef.current = setInterval(captureFrame, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPreviewImage(null);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnected, currentSource, captureFrame]);

  // Load current preview source on mount
  useEffect(() => {
    const loadCurrentSource = async () => {
      if (!isConnected) {
        setCurrentSource(null);
        setPreviewImage(null);
        return;
      }

      try {
        const source = await NDIApi.getPreviewSource();
        if (source) {
          setCurrentSource(source);
        }
      } catch (err) {
        console.error('Failed to load current preview source:', err);
      }
    };

    loadCurrentSource();
  }, [isConnected]);

  return {
    currentSource,
    previewImage,
    isLoading,
    error,
    isConnected,
    setPreviewSource,
    captureFrame
  };
};