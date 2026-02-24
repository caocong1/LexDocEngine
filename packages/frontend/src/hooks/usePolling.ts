import { createSignal, onCleanup } from 'solid-js';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: {
    intervalMs?: number;
    shouldContinue: (data: T) => boolean;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
  },
) {
  const [isPolling, setIsPolling] = createSignal(false);
  let timerId: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = undefined;
    }
    setIsPolling(false);
  };

  const poll = async () => {
    try {
      const data = await fetcher();
      options.onData?.(data);

      if (!options.shouldContinue(data)) {
        stop();
      }
    } catch (err: any) {
      options.onError?.(err);
    }
  };

  const start = () => {
    if (isPolling()) return;
    setIsPolling(true);

    // Poll immediately, then on interval
    poll();
    timerId = setInterval(poll, options.intervalMs || 2000);
  };

  onCleanup(stop);

  return { isPolling, start, stop };
}
