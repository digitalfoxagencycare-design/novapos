import { useEffect, useRef } from 'react';

const backHandlers: { id: symbol; close: () => void }[] = [];

/** Close the most recently opened panel before leaving its screen. */
export function closeTopPanel(): boolean {
  const handler = backHandlers.at(-1);
  if (!handler) return false;
  handler.close();
  return true;
}

export function useBackHandler(enabled: boolean, close: () => void) {
  const callback = useRef(close);
  callback.current = close;
  useEffect(() => {
    if (!enabled) return;
    const handler = { id: Symbol(), close: () => callback.current() };
    backHandlers.push(handler);
    return () => {
      const index = backHandlers.findIndex(item => item.id === handler.id);
      if (index !== -1) backHandlers.splice(index, 1);
    };
  }, [enabled]);
}
