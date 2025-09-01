import React, { useState } from 'react';
import { ArrowRight, Play, Stop, Zap } from 'lucide-react';
import { NDISource, NDIDestination, CreateRouteRequest } from '@/types/ndi';

interface RoutingMatrixProps {
  sources: NDISource[];
  destinations: NDIDestination[];
  onCreateRoute: (request: CreateRouteRequest) => Promise<void>;
}

const RoutingMatrix: React.FC<RoutingMatrixProps> = ({ 
  sources, 
  destinations, 
  onCreateRoute 
}) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const handleCreateRoute = async () => {
    if (!selectedSource || !selectedDestination) return;

    try {
      setIsRouting(true);
      await onCreateRoute({
        source: selectedSource,
        destinationId: selectedDestination,
      });
      setSelectedSource(null);
      setSelectedDestination(null);
    } catch (error) {
      console.error('Failed to create route:', error);
    } finally {
      setIsRouting(false);
    }
  };

  const canCreateRoute = selectedSource && selectedDestination && !isRouting;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-6 flex items-center text-gray-800 dark:text-gray-200">
        <Zap className="mr-3 text-ndi-blue" size={24} />
        Route Sources to Destinations
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sources Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Select Source
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sources.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                No sources available
              </div>
            ) : (
              sources.map((source) => (
                <button
                  key={source.name}
                  onClick={() => setSelectedSource(source.name)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                    selectedSource === source.name
                      ? 'border-ndi-blue bg-blue-50 dark:bg-blue-900 shadow-md'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {source.name}
                      </div>
                      {source.url && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {source.url}
                        </div>
                      )}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${source.connected ? 'bg-ndi-green' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Arrow Column */}
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <ArrowRight 
              size={32} 
              className={`transition-colors duration-200 ${
                canCreateRoute ? 'text-ndi-blue' : 'text-gray-300 dark:text-gray-600'
              }`} 
            />
            <button
              onClick={handleCreateRoute}
              disabled={!canCreateRoute}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                canCreateRoute
                  ? 'bg-ndi-green text-white hover:bg-green-600 shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {isRouting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block mr-2"></div>
                  Routing...
                </>
              ) : (
                <>
                  <Play size={16} className="inline mr-2" />
                  Route
                </>
              )}
            </button>
          </div>
        </div>

        {/* Destinations Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Select Destination
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {destinations.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                No destinations available
              </div>
            ) : (
              destinations.map((destination) => (
                <button
                  key={destination.id}
                  onClick={() => setSelectedDestination(destination.id)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                    selectedDestination === destination.id
                      ? 'border-ndi-blue bg-blue-50 dark:bg-blue-900 shadow-md'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {destination.name}
                      </div>
                      {destination.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {destination.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {destination.currentSource ? `Current: ${destination.currentSource}` : 'No source'}
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${destination.currentSource ? 'bg-ndi-green' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Selected Items Display */}
      {(selectedSource || selectedDestination) && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Selected:</div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm ${
              selectedSource 
                ? 'bg-ndi-blue text-white' 
                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
            }`}>
              Source: {selectedSource || 'None'}
            </div>
            <ArrowRight size={16} className="text-gray-400 dark:text-gray-500" />
            <div className={`px-3 py-1 rounded-full text-sm ${
              selectedDestination 
                ? 'bg-ndi-green text-white' 
                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
            }`}>
              Destination: {selectedDestination ? destinations.find(d => d.id === selectedDestination)?.name || 'Unknown' : 'None'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutingMatrix;