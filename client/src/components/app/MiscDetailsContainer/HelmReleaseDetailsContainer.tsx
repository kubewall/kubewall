import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { toast } from 'sonner';

const HelmReleaseDetailsContainer: React.FC = () => {


  const { details, error, loading } = useSelector((state: RootState) => state.helmReleaseDetails);

  useEffect(() => {
    if (error) {
      // Show toast notification for errors
      if (error.includes('timed out') || error.includes('timeout')) {
        toast.error("Request Timeout", {
          description: "The Helm release details request took too long to complete. Please try again.",
        });
      } else if (error.includes('Failed to fetch')) {
        toast.error("Network Error", {
          description: "Failed to connect to the server. Please check your connection and try again.",
        });
      } else {
        toast.error("Error Loading Helm Release", {
          description: error,
        });
      }
    }
  }, [error]);

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Helm release details...</p>
      </div>
    </div>;
  }

  if (error) {
    return <div className="p-8 text-center">
      <div className="text-red-500 mb-4">
        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">Failed to Load Helm Release</h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>;
  }

  if (!details) {
    return <div className="p-8 text-center">
      <div className="text-gray-500">
        <p>No Helm release details available.</p>
      </div>
    </div>;
  }

  return (
    <div>
      {/* Helm release details will be rendered by the parent KwDetails component */}
    </div>
  );
};

export default HelmReleaseDetailsContainer; 