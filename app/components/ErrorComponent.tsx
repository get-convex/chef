import React from 'react';

interface ErrorDisplayProps {
  error: Error | unknown;
  resetErrorBoundary?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, resetErrorBoundary }) => {
  const isError = error instanceof Error;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-red-800">An error occurred</h2>
        <div className="mt-2 text-red-700">{isError ? error.message : String(error)}</div>
      </div>

      {isError && error.stack && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-red-800">Stack trace:</h3>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-800">
            {error.stack}
          </pre>
        </div>
      )}

      {resetErrorBoundary && (
        <button
          onClick={resetErrorBoundary}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50"
        >
          Try again
        </button>
      )}
    </div>
  );
};
