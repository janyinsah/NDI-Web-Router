import axios from 'axios';
import { 
  NDISource, 
  NDIRoute, 
  NDIDestination, 
  CreateRouteRequest, 
  CreateDestinationRequest,
  MatrixSourceSlot,
  MatrixDestination,
  MatrixRoute,
  AssignSourceToSlotRequest,
  CreateMatrixDestinationRequest,
  CreateMatrixRouteRequest,
  RemoveMatrixRouteRequest
} from '@/types/ndi';

// Dynamic API URL - use same host as frontend, port 8080 for backend
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development/production, use the same hostname as the frontend but port 8080
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8080`;
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple error handling
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  return Promise.reject(error);
});

export class NDIApi {
  static async healthCheck(): Promise<{ status: string, timestamp: number }> {
    try {
      const response = await api.get('/api/health');
      return response.data;
    } catch (error) {
      throw new Error('Server is not responding');
    }
  }

  static async getSources(): Promise<NDISource[]> {
    try {
      console.log('Fetching NDI sources...');
      const response = await api.get('/api/sources');
      console.log('NDI sources response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      throw new Error('Failed to fetch NDI sources');
    }
  }

  static async getRoutes(): Promise<NDIRoute[]> {
    try {
      const response = await api.get('/api/routes');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch routes:', error);
      throw new Error('Failed to fetch active routes');
    }
  }

  static async getDestinations(): Promise<NDIDestination[]> {
    try {
      const response = await api.get('/api/destinations');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch destinations:', error);
      throw new Error('Failed to fetch destinations');
    }
  }

  static async createDestination(request: CreateDestinationRequest): Promise<void> {
    try {
      await api.post('/api/destinations', request);
    } catch (error) {
      console.error('Failed to create destination:', error);
      throw new Error('Failed to create destination');
    }
  }

  static async deleteDestination(destinationId: string): Promise<void> {
    try {
      await api.delete(`/api/destinations/${destinationId}`);
    } catch (error) {
      console.error('Failed to delete destination:', error);
      throw new Error('Failed to delete destination');
    }
  }

  static async createRoute(request: CreateRouteRequest): Promise<void> {
    try {
      await api.post('/api/routes', request);
    } catch (error) {
      console.error('Failed to create route:', error);
      throw new Error('Failed to create route');
    }
  }

  static async deleteRoute(routeId: string): Promise<void> {
    try {
      await api.delete(`/api/routes/${routeId}`);
    } catch (error) {
      console.error('Failed to delete route:', error);
      throw new Error('Failed to delete route');
    }
  }

  // Matrix Switcher API Methods
  static async getMatrixSourceSlots(): Promise<MatrixSourceSlot[]> {
    try {
      const response = await api.get('/api/matrix/source-slots');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch matrix source slots:', error);
      throw new Error('Failed to fetch matrix source slots');
    }
  }

  static async getMatrixDestinations(): Promise<MatrixDestination[]> {
    try {
      const response = await api.get('/api/matrix/destinations');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch matrix destinations:', error);
      throw new Error('Failed to fetch matrix destinations');
    }
  }

  static async getMatrixRoutes(): Promise<MatrixRoute[]> {
    try {
      const response = await api.get('/api/matrix/routes');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch matrix routes:', error);
      throw new Error('Failed to fetch matrix routes');
    }
  }

  static async assignSourceToSlot(request: AssignSourceToSlotRequest): Promise<void> {
    try {
      await api.post('/api/matrix/source-slots/assign', request);
    } catch (error) {
      console.error('Failed to assign source to slot:', error);
      throw new Error('Failed to assign source to slot');
    }
  }

  static async unassignSourceSlot(slotNumber: number): Promise<void> {
    try {
      console.log(`Making unassign source slot request for slot ${slotNumber}`);
      const response = await api.delete(`/api/matrix/source-slots/${slotNumber}`);
      console.log('Unassign source slot response:', response.data);
    } catch (error) {
      console.error('Failed to unassign source slot:', error);
      throw new Error('Failed to unassign source slot');
    }
  }

  static async createMatrixDestination(request: CreateMatrixDestinationRequest): Promise<void> {
    try {
      await api.post('/api/matrix/destinations', request);
    } catch (error) {
      console.error('Failed to create matrix destination:', error);
      throw new Error('Failed to create matrix destination');
    }
  }

  static async deleteMatrixDestination(slotNumber: number): Promise<void> {
    try {
      await api.delete(`/api/matrix/destinations/${slotNumber}`);
    } catch (error) {
      console.error('Failed to delete matrix destination:', error);
      throw new Error('Failed to delete matrix destination');
    }
  }

  static async createMatrixRoute(request: CreateMatrixRouteRequest): Promise<void> {
    try {
      await api.post('/api/matrix/routes', request);
    } catch (error) {
      console.error('Failed to create matrix route:', error);
      throw new Error('Failed to create matrix route');
    }
  }

  static async removeMatrixRoute(request: RemoveMatrixRouteRequest): Promise<void> {
    try {
      await api.delete('/api/matrix/routes', { data: request });
    } catch (error) {
      console.error('Failed to remove matrix route:', error);
      throw new Error('Failed to remove matrix route');
    }
  }

  static async unassignDestination(destinationSlot: number): Promise<void> {
    try {
      console.log(`Making unassign request for destination slot ${destinationSlot}`);
      const response = await api.post(`/api/matrix/destinations/${destinationSlot}/unassign`);
      console.log('Unassign response:', response.data);
    } catch (error) {
      console.error('Failed to unassign destination:', error);
      throw new Error('Failed to unassign destination');
    }
  }

  // Bulk routing operations
  static async createMultipleRoutes(sourceSlot: number, destinationSlots: number[]): Promise<void> {
    try {
      await api.post('/api/matrix/routes/multiple', {
        sourceSlot,
        destinationSlots
      });
    } catch (error) {
      console.error('Failed to create multiple routes:', error);
      throw new Error('Failed to create multiple routes');
    }
  }

  static async removeAllRoutesFromSource(sourceSlot: number): Promise<void> {
    try {
      await api.delete(`/api/matrix/routes/source/${sourceSlot}`);
    } catch (error) {
      console.error('Failed to remove all routes from source:', error);
      throw new Error('Failed to remove all routes from source');
    }
  }

  static async getDestinationsForSource(sourceSlot: number): Promise<number[]> {
    try {
      const response = await api.get(`/api/matrix/routes/source/${sourceSlot}`);
      return response.data.destinations;
    } catch (error) {
      console.error('Failed to get destinations for source:', error);
      throw new Error('Failed to get destinations for source');
    }
  }

  static async getStudioMonitors(): Promise<NDISource[]> {
    try {
      const response = await api.get('/api/studio-monitors');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch studio monitors:', error);
      throw new Error('Failed to fetch studio monitors');
    }
  }

  static async resetStudioMonitors(): Promise<{ success: boolean, message: string, monitors: string[], count: number }> {
    try {
      const response = await api.post('/api/studio-monitors/reset');
      return response.data;
    } catch (error) {
      console.error('Failed to reset studio monitors:', error);
      throw new Error('Failed to reset studio monitors');
    }
  }

  // Studio Monitor Source Control API Methods
  static async setStudioMonitorSource(sourceName: string): Promise<void> {
    try {
      await api.post('/api/studio-monitors/set-source', { sourceName });
    } catch (error) {
      console.error('Failed to set studio monitor source:', error);
      throw new Error('Failed to set studio monitor source');
    }
  }

  static async getStudioMonitorSource(): Promise<string | null> {
    try {
      const response = await api.get('/api/studio-monitors/current-source');
      return response.data.source;
    } catch (error) {
      console.error('Failed to get studio monitor source:', error);
      throw new Error('Failed to get studio monitor source');
    }
  }
  
  // Preview API Methods
  static async setPreviewSource(sourceName: string): Promise<void> {
    try {
      await api.post('/api/preview/set-source', { sourceName });
    } catch (error) {
      console.error('Failed to set preview source:', error);
      throw new Error('Failed to set preview source');
    }
  }

  static async getPreviewSource(): Promise<string | null> {
    try {
      const response = await api.get('/api/preview/current-source');
      return response.data.source;
    } catch (error) {
      console.error('Failed to get preview source:', error);
      throw new Error('Failed to get preview source');
    }
  }

  static async getPreviewImage(): Promise<string | null> {
    try {
      const response = await api.get('/api/preview/image');
      return response.data.image;
    } catch (error) {
      console.error('Failed to get preview image:', error);
      throw new Error('Failed to get preview image');
    }
  }

  static async clearPreview(): Promise<void> {
    try {
      await api.post('/api/preview/clear');
    } catch (error) {
      console.error('Failed to clear preview:', error);
      throw new Error('Failed to clear preview');
    }
  }
}