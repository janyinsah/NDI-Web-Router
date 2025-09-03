import { useState, useEffect } from 'react';
import { NDIApi } from '@/lib/api';

export const useStudioMonitor = () => {
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Load current source on mount
  useEffect(() => {
    const loadCurrentSource = async () => {
      try {
        const source = await NDIApi.getStudioMonitorSource();
        setCurrentSource(source);
        setIsVisible(!!source);
      } catch (error) {
        console.error('Failed to load current studio monitor source:', error);
      }
    };

    loadCurrentSource();
  }, []);

  const setStudioMonitorSource = async (sourceName: string) => {
    try {
      await NDIApi.setStudioMonitorSource(sourceName);
      setCurrentSource(sourceName);
      setIsVisible(true);
    } catch (error) {
      console.error('Failed to set studio monitor source:', error);
      throw error;
    }
  };

  const toggleVisibility = async () => {
    try {
      if (isVisible && currentSource) {
        // Hide by resetting studio monitors
        await NDIApi.resetStudioMonitors();
        setIsVisible(false);
      } else if (currentSource) {
        // Show by setting the source again
        await NDIApi.setStudioMonitorSource(currentSource);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to toggle studio monitor visibility:', error);
      throw error;
    }
  };

  const clearSource = async () => {
    try {
      await NDIApi.resetStudioMonitors();
      setCurrentSource(null);
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to clear studio monitor source:', error);
      throw error;
    }
  };

  return {
    currentSource,
    isVisible,
    setStudioMonitorSource,
    toggleVisibility,
    clearSource
  };
};