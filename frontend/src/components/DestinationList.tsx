import React, { useState } from 'react';
import { Monitor, Trash2, Plus, Edit3, Tv, Circle } from 'lucide-react';
import { NDIDestination, CreateDestinationRequest } from '@/types/ndi';

interface DestinationListProps {
  destinations: NDIDestination[];
  onCreateDestination: (request: CreateDestinationRequest) => Promise<void>;
  onDeleteDestination: (destinationId: string) => void;
}

const DestinationList: React.FC<DestinationListProps> = ({ 
  destinations, 
  onCreateDestination, 
  onDeleteDestination 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newDestination, setNewDestination] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestination.name.trim()) return;

    try {
      setLoading(true);
      await onCreateDestination({
        name: newDestination.name.trim(),
        description: newDestination.description.trim() || undefined,
      });
      setNewDestination({ name: '', description: '' });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create destination:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center text-gray-800 dark:text-gray-200">
          <Tv className="mr-3 text-ndi-blue" size={24} />
          NDI Destinations
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">(Visible on Network)</span>
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 bg-ndi-blue text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          <span>Add Destination</span>
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-ndi-blue">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination Name
              </label>
              <input
                type="text"
                value={newDestination.name}
                onChange={(e) => setNewDestination(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-ndi-blue focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 'Program Output 1'"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (optional)
              </label>
              <input
                type="text"
                value={newDestination.description}
                onChange={(e) => setNewDestination(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-ndi-blue focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 'Main program output for live stream'"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !newDestination.name.trim()}
                className="flex items-center space-x-2 bg-ndi-green text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Create</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewDestination({ name: '', description: '' });
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      
      {destinations.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400 text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Tv className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={48} />
          <p className="text-lg font-medium">No NDI destinations created</p>
          <p className="text-sm">Create NDI destinations that will appear in Studio Monitor and other NDI receivers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {destinations.map((destination) => (
            <div
              key={destination.id}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${destination.currentSource ? 'bg-ndi-green' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <Circle 
                      size={12} 
                      className={`${destination.currentSource ? 'text-white fill-current' : 'text-gray-600 dark:text-gray-400'}`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{destination.name}</h3>
                    {destination.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{destination.description}</p>
                    )}
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={`text-xs font-medium ${destination.currentSource ? 'text-ndi-green' : 'text-gray-500 dark:text-gray-400'}`}>
                        {destination.currentSource ? `● ${destination.currentSource}` : '● No source'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${destination.enabled 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {destination.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onDeleteDestination(destination.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors duration-200"
                    title="Delete destination"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DestinationList;