import { useEffect, useRef } from 'react';

type Dependencies = Record<string, unknown>;

/**
 * A debug hook that logs which properties in an object changed between renders
 * @param dependencies An object containing values to track between renders
 * @param name Optional name to identify this usage in logs
 */
export function useWhatChanged(dependencies: Dependencies, name?: string) {
  const prevDeps = useRef<Dependencies>();

  useEffect(() => {
    if (prevDeps.current) {
      const changedDeps = Object.entries(dependencies).filter(([key, value]) => prevDeps.current![key] !== value);

      if (changedDeps.length > 0) {
        const prefix = name ? `[${name}] ` : '';
        console.log(
          `${prefix}Dependencies changed:`,
          changedDeps.reduce(
            (acc, [key, value]) => {
              acc[key] = {
                from: prevDeps.current![key],
                to: value,
              };
              return acc;
            },
            {} as Record<string, { from: unknown; to: unknown }>,
          ),
        );
      }
    }

    prevDeps.current = { ...dependencies };
  });
}
