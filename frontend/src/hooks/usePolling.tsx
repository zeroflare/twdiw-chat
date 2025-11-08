import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
  interval: number;
  enabled: boolean;
  onError?: (error: Error) => void;
}

export function usePolling<T>(
  pollFunction: () => Promise<T>,
  options: UsePollingOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);

  const poll = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await pollFunction();
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!options.enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, options.interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [options.enabled, options.interval]);

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return { data, loading, error, stop };
}
