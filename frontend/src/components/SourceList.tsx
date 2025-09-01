import React from 'react';
import { Monitor, Wifi, WifiOff } from 'lucide-react';
import { NDISource } from '@/types/ndi';

interface SourceListProps {
  sources: NDISource[];
}

const SourceList: React.FC<SourceListProps> = ({ sources }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-6 flex items-center text-gray-800 dark:text-gray-200">
        <Monitor className="mr-3 text-ndi-blue" size={24} />
        NDI Sources
      </h2>
      
      {sources.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400 text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Monitor className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={48} />
          <p className="text-lg font-medium">No NDI sources found</p>
          <p className="text-sm">Make sure NDI sources are running on your network</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{source.name}</h3>
                  {source.url && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{source.url}</p>
                  )}
                </div>
                <div className="flex items-center ml-4">
                  {source.connected ? (
                    <div className="flex items-center text-ndi-green">
                      <Wifi size={20} />
                      <span className="ml-1 text-xs font-medium">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-400 dark:text-gray-500">
                      <WifiOff size={20} />
                      <span className="ml-1 text-xs font-medium">Offline</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceList;