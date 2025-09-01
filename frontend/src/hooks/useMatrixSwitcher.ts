import { useState, useEffect, useCallback } from 'react';
import { NDIApi } from '@/lib/api';
import { useServerConnection } from './useServerConnection';
import { 
  NDISource, 
  MatrixSourceSlot, 
  MatrixDestination, 
  MatrixRoute,
  AssignSourceToSlotRequest,
  CreateMatrixDestinationRequest,
  CreateMatrixRouteRequest,
  RemoveMatrixRouteRequest
} from '@/types/ndi';

export const useMatrixSwitcher = () => {
  const { isConnected } = useServerConnection();
  const [sources, setSources] = useState<NDISource[]>([]);
  const [sourceSlots, setSourceSlots] = useState<MatrixSourceSlot[]>([]);
  const [destinations, setDestinations] = useState<MatrixDestination[]>([]);
  const [routes, setRoutes] = useState<MatrixRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    if (!isConnected) {
      setSources([]);
      setSourceSlots([]);
      setDestinations([]);
      setRoutes([]);
      setError('Server not connected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const [sourcesData, sourceSlotsData, destinationsData, routesData] = await Promise.all([
        NDIApi.getSources(),
        NDIApi.getMatrixSourceSlots(),
        NDIApi.getMatrixDestinations(),
        NDIApi.getMatrixRoutes()
      ]);
      
      setSources(sourcesData);
      setSourceSlots(sourceSlotsData);
      setDestinations(destinationsData);
      setRoutes(routesData);
    } catch (err) {
      console.error('Failed to fetch matrix data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matrix data');
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Assign source to slot
  const assignSourceToSlot = useCallback(async (
    slotNumber: number, 
    ndiSourceName: string, 
    displayName?: string
  ) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      const request: AssignSourceToSlotRequest = {
        slotNumber,
        ndiSourceName,
        displayName
      };
      
      await NDIApi.assignSourceToSlot(request);
      
      // Update local state
      setSourceSlots(prev => prev.map(slot => 
        slot.slotNumber === slotNumber 
          ? { 
              ...slot, 
              assignedNdiSource: ndiSourceName, 
              displayName: displayName || `Slot ${slotNumber}`,
              isAssigned: true 
            }
          : slot
      ));
    } catch (err) {
      console.error('Failed to assign source to slot:', err);
      throw err;
    }
  }, [isConnected]);

  // Unassign source slot
  const unassignSourceSlot = useCallback(async (slotNumber: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      await NDIApi.unassignSourceSlot(slotNumber);
      
      // Force refresh all data to ensure consistency after unassignment
      // This ensures routes and destinations are properly updated
      await fetchAllData();
    } catch (err) {
      console.error('Failed to unassign source slot:', err);
      throw err;
    }
  }, [isConnected, fetchAllData]);

  // Create matrix destination
  const createMatrixDestination = useCallback(async (name: string, description?: string) => {
    try {
      const request: CreateMatrixDestinationRequest = {
        name,
        description
      };
      
      await NDIApi.createMatrixDestination(request);
      
      // Refresh destinations to get the new one with correct slot number
      const destinationsData = await NDIApi.getMatrixDestinations();
      setDestinations(destinationsData);
    } catch (err) {
      console.error('Failed to create matrix destination:', err);
      throw err;
    }
  }, [isConnected]);

  // Remove matrix destination
  const removeMatrixDestination = useCallback(async (slotNumber: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      await NDIApi.deleteMatrixDestination(slotNumber);
      
      // Update local state
      setDestinations(prev => prev.filter(dest => dest.slotNumber !== slotNumber));
      setRoutes(prev => prev.filter(route => route.destinationSlot !== slotNumber));
    } catch (err) {
      console.error('Failed to remove matrix destination:', err);
      throw err;
    }
  }, [isConnected]);

  // Create matrix route
  const createMatrixRoute = useCallback(async (sourceSlot: number, destinationSlot: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      const request: CreateMatrixRouteRequest = {
        sourceSlot,
        destinationSlot
      };
      
      await NDIApi.createMatrixRoute(request);
      
      // Refresh routes and destinations to get updated state
      const [routesData, destinationsData] = await Promise.all([
        NDIApi.getMatrixRoutes(),
        NDIApi.getMatrixDestinations()
      ]);
      setRoutes(routesData);
      setDestinations(destinationsData);
    } catch (err) {
      console.error('Failed to create matrix route:', err);
      throw err;
    }
  }, [isConnected]);

  // Remove matrix route
  const removeMatrixRoute = useCallback(async (sourceSlot: number, destinationSlot: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      const request: RemoveMatrixRouteRequest = {
        sourceSlot,
        destinationSlot
      };
      
      await NDIApi.removeMatrixRoute(request);
      
      // Force refresh all data to ensure consistency
      await fetchAllData();
    } catch (err) {
      console.error('Failed to remove matrix route:', err);
      throw err;
    }
  }, [isConnected, fetchAllData]);

  // Unassign destination
  const unassignDestination = useCallback(async (destinationSlot: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      await NDIApi.unassignDestination(destinationSlot);
      
      // Force refresh all data to ensure consistency
      await fetchAllData();
    } catch (err) {
      console.error('Failed to unassign destination:', err);
      throw err;
    }
  }, [isConnected, fetchAllData]);

  // Reset studio monitors
  const resetStudioMonitors = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      const result = await NDIApi.resetStudioMonitors();
      console.log(`Reset ${result.count} studio monitors to 'None'`);
    } catch (err) {
      console.error('Failed to reset studio monitors:', err);
      throw err;
    }
  }, [isConnected]);

  // Bulk routing operations
  const createMultipleRoutes = useCallback(async (sourceSlot: number, destinationSlots: number[]) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      await NDIApi.createMultipleRoutes(sourceSlot, destinationSlots);
      
      // Force refresh all data to ensure consistency
      await fetchAllData();
    } catch (err) {
      console.error('Failed to create multiple routes:', err);
      throw err;
    }
  }, [isConnected, fetchAllData]);

  const removeAllRoutesFromSource = useCallback(async (sourceSlot: number) => {
    if (!isConnected) {
      throw new Error('Server not connected');
    }

    try {
      await NDIApi.removeAllRoutesFromSource(sourceSlot);
      
      // Force refresh all data to ensure consistency
      await fetchAllData();
    } catch (err) {
      console.error('Failed to remove all routes from source:', err);
      throw err;
    }
  }, [isConnected, fetchAllData]);

  // Auto-refresh data every 5 seconds
  useEffect(() => {
    fetchAllData();
    
    const interval = setInterval(() => {
      fetchAllData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return {
    sources,
    sourceSlots,
    destinations,
    routes,
    loading,
    error,
    isConnected,
    assignSourceToSlot,
    unassignSourceSlot,
    createMatrixDestination,
    removeMatrixDestination,
    createMatrixRoute,
    removeMatrixRoute,
    unassignDestination,
    resetStudioMonitors,
    createMultipleRoutes,
    removeAllRoutesFromSource,
    refresh
  };
};