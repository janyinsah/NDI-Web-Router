import React from 'react';
import { RefreshCw, AlertCircle, Wifi, Activity, Moon, Sun } from 'lucide-react';
import { useMatrixSwitcher } from '@/hooks/useMatrixSwitcher';
import { useTheme } from '@/contexts/ThemeContext';
import MatrixSwitcher from '@/components/MatrixSwitcher';

function App() {
  const { 
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
  } = useMatrixSwitcher();
  
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-200">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <header className="mb-6 sm:mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-2">
                NDI Web Router
              </h1>
              <p className="text-gray-800 dark:text-gray-200 text-base sm:text-lg">
                Discover and re-route NDI devices remotely!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900 px-3 sm:px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700">
                <Activity className="text-black dark:text-white flex-shrink-0" size={18} />
                <span className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  <span className="hidden sm:inline">{sources.length} NDI Sources • {sourceSlots.filter(slot => slot.isAssigned).length}/{sourceSlots.length} Slots • {destinations.length} Outputs • {routes.length} Routes</span>
                  <span className="sm:hidden">{sources.length} Sources • {routes.length} Routes</span>
                </span>
              </div>
              
              <div className="flex space-x-2 sm:space-x-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 sm:p-3 bg-gray-100 dark:bg-gray-900 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-300 dark:border-gray-700"
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? (
                    <Moon className="text-black" size={18} />
                  ) : (
                    <Sun className="text-white" size={18} />
                  )}
                </button>
                
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900 px-4 sm:px-6 py-2 sm:py-3 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 border border-gray-300 dark:border-gray-700"
                >
                  <RefreshCw className={`${loading ? 'animate-spin' : ''} text-black dark:text-white`} size={18} />
                  <span className="font-medium text-black dark:text-white text-sm sm:text-base">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 bg-gray-100 dark:bg-gray-900 border-l-4 border-black dark:border-white p-6 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="text-black dark:text-white mr-3 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-black dark:text-white font-semibold">Connection Error</h3>
                <p className="text-gray-800 dark:text-gray-200 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <MatrixSwitcher
            sources={sources}
            sourceSlots={sourceSlots}
            destinations={destinations}
            routes={routes}
            isConnected={isConnected}
            onAssignSourceToSlot={assignSourceToSlot}
            onUnassignSourceSlot={unassignSourceSlot}
            onCreateDestination={createMatrixDestination}
            onRemoveDestination={removeMatrixDestination}
            onCreateRoute={createMatrixRoute}
            onRemoveRoute={removeMatrixRoute}
            onUnassignDestination={unassignDestination}
            onResetStudioMonitors={resetStudioMonitors}
            onCreateMultipleRoutes={createMultipleRoutes}
            onRemoveAllRoutesFromSource={removeAllRoutesFromSource}
          />
        </div>

        <footer className="mt-16 text-center">
          <div className="bg-gray-100 dark:bg-gray-900 rounded-md p-6 border border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-2 text-gray-800 dark:text-gray-200">
              <Wifi size={20} />
              <span className="font-medium">NDI Web Router</span>
              <span>•</span>
              <span>Created by Josiah Anyinsah-Bondzie</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;