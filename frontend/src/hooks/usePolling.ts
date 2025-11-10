import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../utils/logger';

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
  const pollFunctionRef = useRef(pollFunction);

  // Update ref when pollFunction changes
  pollFunctionRef.current = pollFunction;

  const poll = useCallback(async () => {
    logger.log('[usePolling] poll() called, loading:', loading);
    
    if (loading) {
      logger.log('[usePolling] Already loading, skipping poll');
      return;
    }

    logger.log('[usePolling] Starting poll...');
    setLoading(true);
    setError(null);

    try {
      logger.log('[usePolling] Calling pollFunction...');
      const result = await pollFunctionRef.current();
      logger.log('[usePolling] pollFunction returned:', result);
      setData(result);
    } catch (err) {
      logger.error('[usePolling] pollFunction error:', err);
      const error = err instanceof Error ? err : new Error('Polling failed');
      setError(error);
      options.onError?.(error);
    } finally {
      logger.log('[usePolling] Poll completed, setting loading to false');
      setLoading(false);
    }
  }, [loading, options.onError]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    logger.log('[usePolling] useEffect triggered, enabled:', options.enabled, 'interval:', options.interval);
    
    if (options.enabled) {
      logger.log('[usePolling] Starting polling - calling poll() immediately');
      poll();
      logger.log('[usePolling] Setting up interval with', options.interval, 'ms');
      intervalRef.current = window.setInterval(() => {
        logger.log('[usePolling] Interval triggered, calling poll()');
        poll();
      }, options.interval);
    } else {
      logger.log('[usePolling] Polling disabled, stopping');
      stop();
    }

    return () => {
      logger.log('[usePolling] useEffect cleanup, stopping polling');
      stop();
    };
  }, [options.enabled, options.interval, poll, stop]);

  return { data, loading, error, poll, stop };
}
