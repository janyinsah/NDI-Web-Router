import { useState, useEffect, useCallback } from 'react';
import { NDISource, NDIRoute, NDIDestination, CreateRouteRequest, CreateDestinationRequest } from '@/types/ndi';
import { NDIApi } from '@/lib/api';

export const useNDI = () => {
  const [sources, setSources] = useState<NDISource[]>([]);
  const [destinations, setDestinations] = useState<NDIDestination[]>([]);
  const [routes, setRoutes] = useState<NDIRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newSources = await NDIApi.getSources();
      setSources(newSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sources');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDestinations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newDestinations = await NDIApi.getDestinations();
      setDestinations(newDestinations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch destinations');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newRoutes = await NDIApi.getRoutes();
      setRoutes(newRoutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDestination = useCallback(async (request: CreateDestinationRequest) => {
    try {
      setError(null);
      await NDIApi.createDestination(request);
      await refreshDestinations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create destination');
      throw err;
    }
  }, [refreshDestinations]);

  const deleteDestination = useCallback(async (destinationId: string) => {
    try {
      setError(null);
      await NDIApi.deleteDestination(destinationId);
      await Promise.all([refreshDestinations(), refreshRoutes()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete destination');
      throw err;
    }
  }, [refreshDestinations, refreshRoutes]);

  const createRoute = useCallback(async (request: CreateRouteRequest) => {
    try {
      setError(null);
      await NDIApi.createRoute(request);
      await Promise.all([refreshRoutes(), refreshDestinations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create route');
      throw err;
    }
  }, [refreshRoutes, refreshDestinations]);

  const deleteRoute = useCallback(async (routeId: string) => {
    try {
      setError(null);
      await NDIApi.deleteRoute(routeId);
      await Promise.all([refreshRoutes(), refreshDestinations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete route');
      throw err;
    }
  }, [refreshRoutes, refreshDestinations]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshSources(), refreshDestinations(), refreshRoutes()]);
  }, [refreshSources, refreshDestinations, refreshRoutes]);

  useEffect(() => {
    refresh();
    
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    sources,
    destinations,
    routes,
    loading,
    error,
    refreshSources,
    refreshDestinations,
    refreshRoutes,
    createDestination,
    deleteDestination,
    createRoute,
    deleteRoute,
    refresh,
  };
};