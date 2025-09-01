import { useState, useEffect, useCallback, useRef } from 'react';
import { NDIApi } from '@/lib/api';

export const useServerConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastConnected, setLastConnected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setIsChecking(true);
      setError(null);
      
      const health = await NDIApi.healthCheck();
      
      if (health.status === 'ok') {
        setIsConnected(true);
        setLastConnected(health.timestamp);
      } else {
        setIsConnected(false);
        setError('Server returned invalid status');
      }
    } catch (err) {
      setIsConnected(false);
      setLastConnected(null);
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      console.warn('Server connection failed:', message);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Start connection monitoring
  useEffect(() => {
    // Initial check
    checkConnection();
    
    // Check every 5 seconds
    intervalRef.current = setInterval(checkConnection, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkConnection]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    isConnected,
    isChecking,
    lastConnected,
    error,
    reconnect
  };
};