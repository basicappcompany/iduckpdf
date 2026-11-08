import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Window width that is safe for pre-rendered (static) pages.
 * The server and the first client render both see 1200, so React can hydrate without
 * mismatches; the real width is used from the second render on.
 */
export function useWidth(): number {
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? width : 1200;
}
