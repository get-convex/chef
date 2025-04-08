import React from 'react';

interface ErrorDisplayProps {
  error: Error | unknown;
  resetErrorBoundary?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, resetErrorBoundary }) => {
  const isError = error instanceof Error;

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-red-800">An error occurred</h2>
        <div className="mt-2 text-red-700">{isError ? error.message : String(error)}</div>
      </div>

      {isError && error.stack && (
        <div className="mt-4">
          <h3 className="text-md font-semibold text-red-800">Stack trace:</h3>
          <pre className="mt-2 p-3 bg-gray-100 rounded overflow-auto text-xs text-gray-800 font-mono">
            {error.stack}
          </pre>
        </div>
      )}

      {resetErrorBoundary && (
        <button
          onClick={resetErrorBoundary}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
        >
          Try again
        </button>
      )}
    </div>
  );
};
