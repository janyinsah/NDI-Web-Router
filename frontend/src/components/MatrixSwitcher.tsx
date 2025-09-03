import React, { useState } from 'react';
import { Plus, Settings, Monitor, Video, Zap, Check, Eye, EyeOff } from 'lucide-react';
import { NDISource, MatrixSourceSlot, MatrixDestination, MatrixRoute } from '@/types/ndi';
import { useStudioMonitor } from '@/hooks/useStudioMonitor';
import { usePreview } from '@/hooks/usePreview';

interface MatrixSwitcherProps {
  sources: NDISource[];
  sourceSlots: MatrixSourceSlot[];
  destinations: MatrixDestination[];
  routes: MatrixRoute[];
  isConnected: boolean;
  onAssignSourceToSlot: (slotNumber: number, ndiSourceName: string, displayName?: string) => Promise<void>;
  onUnassignSourceSlot: (slotNumber: number) => Promise<void>;
  onCreateDestination: (name: string, description?: string) => Promise<void>;
  onRemoveDestination: (slotNumber: number) => Promise<void>;
  onCreateRoute: (sourceSlot: number, destinationSlot: number) => Promise<void>;
  onRemoveRoute: (sourceSlot: number, destinationSlot: number) => Promise<void>;
  onUnassignDestination: (destinationSlot: number) => Promise<void>;
  onResetStudioMonitors: () => Promise<void>;
  
  // New bulk routing operations
  onCreateMultipleRoutes?: (sourceSlot: number, destinationSlots: number[]) => Promise<void>;
  onRemoveAllRoutesFromSource?: (sourceSlot: number) => Promise<void>;
}

const MatrixSwitcher: React.FC<MatrixSwitcherProps> = ({
  sources,
  sourceSlots,
  destinations,
  routes,
  isConnected,
  onAssignSourceToSlot,
  onUnassignSourceSlot,
  onCreateDestination,
  onRemoveDestination,
  onCreateRoute,
  onRemoveRoute,
  onUnassignDestination,
  onResetStudioMonitors,
  onCreateMultipleRoutes,
  onRemoveAllRoutesFromSource
}) => {
  const [selectedSourceSlot, setSelectedSourceSlot] = useState<number | null>(null);
  const [selectedDestinations, setSelectedDestinations] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showSourceAssignment, setShowSourceAssignment] = useState<number | null>(null);
  const [showDestinationDialog, setShowDestinationDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState<number | null>(null);
  const [newDestinationName, setNewDestinationName] = useState('');
  
  // Studio monitor and preview
  const { currentSource: studioMonitorSource, isVisible: studioMonitorVisible, setStudioMonitorSource, toggleVisibility } = useStudioMonitor();
  const { currentSource: previewSource, previewImage, isLoading: previewLoading, setPreviewSource, clearPreview } = usePreview();

  // Find active route for a destination
  const findActiveRoute = (destinationSlot: number): MatrixRoute | null => {
    return routes.find(route => route.destinationSlot === destinationSlot && route.active) || null;
  };

  // Handle source slot click - activates both preview and studio monitor
  const handleSourceSlotClick = async (slotNumber: number) => {
    const sourceSlot = sourceSlots.find(slot => slot.slotNumber === slotNumber);
    
    if (selectedSourceSlot === slotNumber) {
      setSelectedSourceSlot(null); // Deselect if already selected
      setIsMultiSelectMode(false);
      setSelectedDestinations(new Set());
      // Clear preview when deselecting
      clearPreview().catch(error => 
        console.error('Failed to clear preview:', error)
      );
    } else {
      setSelectedSourceSlot(slotNumber);
      setSelectedDestinations(new Set());
      
      // Set preview and studio monitor for assigned source
      if (sourceSlot?.isAssigned && sourceSlot.assignedNdiSource) {
        // Set preview and studio monitor without blocking UI
        Promise.all([
          setPreviewSource(sourceSlot.assignedNdiSource).catch(error => 
            console.error('Failed to set preview source:', error)
          ),
          setStudioMonitorSource(sourceSlot.assignedNdiSource).catch(error => 
            console.error('Failed to set studio monitor source:', error)
          )
        ]);
      }
      
      // Auto-enable multi-select mode if source has existing routes
      const existingDestinations = routes
        .filter(route => route.sourceSlot === slotNumber && route.active)
        .map(route => route.destinationSlot);
      
      if (existingDestinations.length > 0) {
        setIsMultiSelectMode(true);
        setSelectedDestinations(new Set(existingDestinations));
      } else {
        setIsMultiSelectMode(false);
      }
    }
  };

  // Handle destination click for routing
  const handleDestinationClick = async (destinationSlot: number, event?: React.MouseEvent) => {
    // Don't allow routing if no source is selected
    if (selectedSourceSlot === null) return;

    // Handle multi-select mode with Ctrl/Cmd key
    if (event && (event.ctrlKey || event.metaKey)) {
      setIsMultiSelectMode(true);
      const newSelectedDestinations = new Set(selectedDestinations);
      
      if (newSelectedDestinations.has(destinationSlot)) {
        newSelectedDestinations.delete(destinationSlot);
      } else {
        newSelectedDestinations.add(destinationSlot);
      }
      
      setSelectedDestinations(newSelectedDestinations);
      return;
    }

    // Single destination routing (existing behavior)
    if (!isMultiSelectMode) {
      const existingRoute = findActiveRoute(destinationSlot);
      
      if (existingRoute) {
        // Remove existing route first
        await onRemoveRoute(existingRoute.sourceSlot, destinationSlot);
      }

      // Create new route
      await onCreateRoute(selectedSourceSlot, destinationSlot);
      setSelectedSourceSlot(null); // Deselect after routing
    } else {
      // Multi-select mode: toggle destination selection
      const newSelectedDestinations = new Set(selectedDestinations);
      
      if (newSelectedDestinations.has(destinationSlot)) {
        newSelectedDestinations.delete(destinationSlot);
      } else {
        newSelectedDestinations.add(destinationSlot);
      }
      
      setSelectedDestinations(newSelectedDestinations);
    }
  };

  // Apply bulk routing
  const handleApplyBulkRouting = async () => {
    if (selectedSourceSlot === null || selectedDestinations.size === 0) return;

    try {
      // First remove all existing routes from this source if we have the function
      if (onRemoveAllRoutesFromSource) {
        await onRemoveAllRoutesFromSource(selectedSourceSlot);
      }

      // Then create multiple routes if we have the function
      if (onCreateMultipleRoutes && selectedDestinations.size > 0) {
        await onCreateMultipleRoutes(selectedSourceSlot, Array.from(selectedDestinations));
      } else {
        // Fallback to individual route creation
        for (const destSlot of selectedDestinations) {
          await onCreateRoute(selectedSourceSlot, destSlot);
        }
      }

      // Reset state
      setSelectedSourceSlot(null);
      setSelectedDestinations(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Failed to apply bulk routing:', error);
    }
  };

  // Cancel multi-select mode
  const handleCancelMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedDestinations(new Set());
  };

  // Toggle multi-select mode
  const handleToggleMultiSelectMode = () => {
    if (!isMultiSelectMode && selectedSourceSlot !== null) {
      // Enable multi-select and show current routes
      const existingDestinations = routes
        .filter(route => route.sourceSlot === selectedSourceSlot && route.active)
        .map(route => route.destinationSlot);
      
      setIsMultiSelectMode(true);
      setSelectedDestinations(new Set(existingDestinations));
    } else {
      setIsMultiSelectMode(false);
      setSelectedDestinations(new Set());
    }
  };

  // Handle source assignment
  const handleAssignSource = async (slotNumber: number, ndiSource: string) => {
    const sourceSlot = sourceSlots.find(slot => slot.slotNumber === slotNumber);
    const displayName = `${ndiSource.split('(')[0].trim()}`;
    
    await onAssignSourceToSlot(slotNumber, ndiSource, displayName);
    setShowSourceAssignment(null);
  };

  // Handle click outside to close assignment dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSourceAssignment !== null) {
        const target = event.target as Element;
        if (!target.closest('.source-assignment-dropdown')) {
          setShowSourceAssignment(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSourceAssignment]);

  // Handle destination creation
  const handleCreateDestination = async () => {
    if (!newDestinationName.trim()) return;
    
    await onCreateDestination(newDestinationName.trim(), `Matrix destination ${destinations.length + 1}`);
    setNewDestinationName('');
    setShowDestinationDialog(false);
  };

  // Handle destination double-click for unassign
  const handleDestinationDoubleClick = (destinationSlot: number) => {
    const activeRoute = findActiveRoute(destinationSlot);
    if (activeRoute) {
      setShowUnassignDialog(destinationSlot);
    }
  };

  // Handle destination unassign
  const handleUnassignDestination = async (destinationSlot: number) => {
    try {
      await onUnassignDestination(destinationSlot);
      await onResetStudioMonitors(); // Reset studio monitors to 'None'
      setShowUnassignDialog(null);
    } catch (error) {
      console.error('Failed to unassign destination:', error);
      // Keep dialog open on error
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-gray-300 dark:border-gray-700 space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="bg-black dark:bg-white p-2 rounded-md">
            <Monitor className="text-white dark:text-black" size={18} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-black dark:text-white">NDI Router</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-black dark:bg-white' : 'bg-gray-500'}`}></div>
            <span className={`font-mono text-xs ${isConnected ? 'text-black dark:text-white' : 'text-gray-500'}`}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          {/* Multi-select controls */}
          {selectedSourceSlot !== null && (
            <div className="flex items-center space-x-2">
              {!isMultiSelectMode ? (
                <button
                  onClick={handleToggleMultiSelectMode}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition-colors"
                >
                  Multi-Route
                </button>
              ) : (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedDestinations.size} selected
                  </span>
                  <button
                    onClick={handleApplyBulkRouting}
                    disabled={selectedDestinations.size === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md text-sm transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleCancelMultiSelect}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
          
          <button
            onClick={() => setShowDestinationDialog(true)}
            className="bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black px-3 py-1 rounded-md flex items-center justify-center space-x-1 text-sm transition-colors"
          >
            <Plus size={14} />
            <span>Add Output</span>
          </button>
        </div>
      </div>

      {/* Main responsive layout */}
      <div className="flex flex-col lg:flex-row p-4 sm:p-6 space-y-6 lg:space-y-0 lg:space-x-8">
        {/* Sources Section */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-3">
            <Video className="text-black dark:text-white" size={16} />
            <h3 className="text-lg font-bold text-black dark:text-white">Source</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sourceSlots.slice(0, 8).map((slot) => {
              const isSelected = selectedSourceSlot === slot.slotNumber;
              const isAssigned = slot.isAssigned;
              
              return (
                <div key={slot.slotNumber} className="relative">
                  <button
                    onClick={() => handleSourceSlotClick(slot.slotNumber)}
                    onDoubleClick={() => setShowSourceAssignment(slot.slotNumber)}
                    disabled={!isConnected}
                    className={`w-full aspect-square rounded-md border-2 transition-all duration-200 ${
                      !isConnected
                        ? 'border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-black dark:border-white bg-gray-300 dark:bg-gray-700'
                        : isAssigned
                        ? 'border-gray-400 dark:border-gray-500 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
                        : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="p-2 text-center">
                      <div className="text-xl font-mono font-bold text-black dark:text-white mb-1">
                        {slot.slotNumber}
                      </div>
                      {isAssigned ? (
                        <div className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate px-1">
                          {slot.displayName.split(' ')[0]}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">-</div>
                      )}
                    </div>
                  </button>
                  
                  {/* Source assignment dropdown */}
                  {showSourceAssignment === slot.slotNumber && (
                    <div className="source-assignment-dropdown absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl z-20 min-w-56">
                      <div className="p-3">
                        <h4 className="text-white font-medium mb-2 text-sm">Assign NDI Source</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {sources.map((source) => (
                            <button
                              key={source.name}
                              onClick={() => handleAssignSource(slot.slotNumber, source.name)}
                              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded"
                            >
                              {source.name}
                            </button>
                          ))}
                          {slot.isAssigned && (
                            <>
                              <hr className="border-gray-600 my-2" />
                              <button
                                onClick={async () => {
                                  try {
                                    await onUnassignSourceSlot(slot.slotNumber);
                                    setShowSourceAssignment(null);
                                  } catch (error) {
                                    console.error('Unassign failed:', error);
                                    alert(`Failed to unassign source: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded"
                              >
                                Unassign Source
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Studio Monitor Area */}
        <div className="w-full lg:w-80 flex flex-col items-center lg:order-none order-first">
          {/* Studio Monitor */}
          <div className="w-full aspect-video max-w-sm lg:max-w-none lg:h-48 bg-black rounded-md border border-gray-600 relative mb-4 overflow-hidden">
            {previewImage && previewImage !== "data:image/jpeg;base64,FRAME_DATA_PLACEHOLDER" ? (
              <img 
                src={previewImage} 
                alt="NDI Preview" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl font-bold text-gray-600 opacity-50">NDI</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {previewLoading ? 'Loading...' : 
                     previewSource ? 'Preview Active' : 
                     'Select Source for Preview'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Preview source indicator */}
            {previewSource && (
              <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                {previewSource.split(' ')[0]}
              </div>
            )}
            
            {/* Studio monitor controls */}
            <div className="absolute top-2 right-2 flex space-x-1">
              {studioMonitorSource ? (
                <button
                  onClick={toggleVisibility}
                  className={`text-white p-1 rounded ${
                    studioMonitorVisible 
                      ? 'bg-green-600/80 hover:bg-green-600' 
                      : 'bg-gray-600/80 hover:bg-gray-600'
                  }`}
                  title={studioMonitorVisible ? 'Hide studio monitor' : 'Show studio monitor'}
                >
                  {studioMonitorVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              ) : (
                <div className="bg-gray-800/80 text-gray-400 p-1 rounded">
                  <Eye size={14} />
                </div>
              )}
            </div>
          </div>
          
          {/* Studio Monitor Source Display */}
          <div className="w-full max-w-sm lg:max-w-none mb-4">
            <div className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-100 dark:bg-gray-800 text-black dark:text-white`}>
              {studioMonitorSource ? (
                <div className="flex items-center justify-between">
                  <span>{studioMonitorSource}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    studioMonitorVisible 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-500 text-white'
                  }`}>
                    {studioMonitorVisible ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              ) : (
                <span className="text-gray-500">Select source for preview</span>
              )}
            </div>
          </div>
          
        </div>

        {/* Destinations Section */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-3">
            <Monitor className="text-black dark:text-white" size={16} />
            <h3 className="text-lg font-bold text-black dark:text-white">Destination</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {destinations.map((destination) => {
              const activeRoute = findActiveRoute(destination.slotNumber);
              const sourceSlot = activeRoute ? sourceSlots.find(slot => slot.slotNumber === activeRoute.sourceSlot) : null;
              
              return (
                <button
                  key={destination.slotNumber}
                  onClick={(e) => isConnected && handleDestinationClick(destination.slotNumber, e)}
                  onDoubleClick={() => isConnected && handleDestinationDoubleClick(destination.slotNumber)}
                  disabled={!isConnected || (selectedSourceSlot === null && !activeRoute && !isMultiSelectMode)}
                  className={`aspect-square rounded-md border-2 transition-all duration-200 relative ${
                    !isConnected
                      ? 'border-gray-400 bg-gray-200 dark:border-gray-600 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                      : isMultiSelectMode && selectedDestinations.has(destination.slotNumber)
                      ? 'border-blue-500 bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700'
                      : activeRoute
                      ? 'border-black dark:border-white bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                      : selectedSourceSlot !== null
                      ? 'border-gray-400 dark:border-gray-500 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 cursor-pointer'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900'
                  }`}
                >
                  <div className="p-2 text-center">
                    <div className="text-xl font-mono font-bold text-black dark:text-white mb-1">
                      {destination.slotNumber}
                    </div>
                    <div className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate px-1 mb-1">
                      {destination.name.replace('NDI Output ', '')}
                    </div>
                    {activeRoute && sourceSlot ? (
                      <div className="text-xs text-black dark:text-white bg-gray-300 dark:bg-gray-700 rounded-md px-1">
                        ← {sourceSlot.slotNumber}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">-</div>
                    )}
                  </div>
                  
                  {activeRoute && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-black dark:bg-white rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Multi-select mode status bar */}
      {isMultiSelectMode && selectedSourceSlot !== null && (
        <div className="bg-blue-100 dark:bg-blue-900 border-t border-blue-300 dark:border-blue-700 px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Multi-Route Mode: Source {selectedSourceSlot} → {selectedDestinations.size} destination{selectedDestinations.size === 1 ? '' : 's'}
              </span>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-300">
              Click destinations to select • Ctrl+Click for multi-select • Click Apply when ready
            </div>
          </div>
        </div>
      )}

      {/* Create Destination Dialog */}
      {showDestinationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Create New Output Destination</h3>
            <input
              type="text"
              value={newDestinationName}
              onChange={(e) => setNewDestinationName(e.target.value)}
              placeholder="Destination name (e.g., 'Studio Monitor 1')"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white mb-4"
              autoFocus
            />
            <div className="flex space-x-3">
              <button
                onClick={handleCreateDestination}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowDestinationDialog(false);
                  setNewDestinationName('');
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Destination Dialog */}
      {showUnassignDialog !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-600 shadow-xl max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Unassign Destination</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to unassign destination {showUnassignDialog}? 
              This will also reset all studio monitors to show 'None'.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleUnassignDestination(showUnassignDialog)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex-1"
              >
                Unassign & Reset Monitors
              </button>
              <button
                onClick={() => setShowUnassignDialog(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixSwitcher;