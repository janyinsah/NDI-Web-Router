import React from 'react';
import { ArrowRight, Trash2, Play, Pause, Route } from 'lucide-react';
import { NDIRoute } from '@/types/ndi';

interface RouteListProps {
  routes: NDIRoute[];
  onDeleteRoute: (routeId: string) => void;
}

const RouteList: React.FC<RouteListProps> = ({ routes, onDeleteRoute }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <h2 className="text-xl font-bold mb-6 flex items-center text-gray-800">
        <Route className="mr-3 text-ndi-blue" size={24} />
        Active Routes
      </h2>
      
      {routes.length === 0 ? (
        <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-lg">
          <ArrowRight className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-lg font-medium">No active routes</p>
          <p className="text-sm">Create a route to start streaming</p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <div
              key={route.id}
              className="p-4 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${route.active ? 'bg-ndi-green text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {route.active ? <Play size={16} /> : <Pause size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-gray-900">{route.source}</span>
                      <ArrowRight className="text-gray-400" size={16} />
                      <span className="font-semibold text-gray-900">{route.destination}</span>
                    </div>
                    <div className={`text-sm mt-1 ${route.active ? 'text-ndi-green font-medium' : 'text-gray-500'}`}>
                      {route.active ? '● Active' : '● Inactive'}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => onDeleteRoute(route.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 hover:shadow-sm"
                  title="Delete route"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteList;