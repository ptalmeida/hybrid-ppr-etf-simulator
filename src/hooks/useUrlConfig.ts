import { useCallback, useEffect, useState } from 'react';
import { parseConfig, serialiseConfig } from '../lib/url';
import { DEFAULT_CONFIG } from '../lib/defaults';
import type { SimConfig } from '../lib/types';

/**
 * The URL query string is the single source of truth for configuration, so
 * every result is shareable by link. State is mirrored into React so typing
 * stays responsive; the URL is replaced (never pushed) to keep the back
 * button useful.
 */
export function useUrlConfig() {
  const [config, setConfig] = useState<SimConfig>(() =>
    parseConfig(
      typeof window === 'undefined' ? '' : window.location.search.slice(1),
    ),
  );

  useEffect(() => {
    const query = serialiseConfig(config);
    const url = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [config]);

  useEffect(() => {
    const onPop = () => setConfig(parseConfig(window.location.search.slice(1)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback(
    (patch: Partial<SimConfig>) => setConfig((c) => ({ ...c, ...patch })),
    [],
  );

  const reset = useCallback(() => setConfig({ ...DEFAULT_CONFIG }), []);

  return { config, update, reset };
}
