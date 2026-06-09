import { useCallback, useState } from 'react';

import { DEFAULT_TIMELINE_ZOOM } from '../constants';
import { clampTimelineZoom } from '../zoom';

export const useTimelineZoom = (initialZoom?: number) => {
  const [zoom, setZoomState] = useState(() => clampTimelineZoom(initialZoom || DEFAULT_TIMELINE_ZOOM));

  const setZoom = useCallback((nextZoom: number | ((current: number) => number)) => {
    setZoomState((current) => {
      const nextValue = clampTimelineZoom(typeof nextZoom === 'function' ? nextZoom(current) : nextZoom);
      return Math.abs(current - nextValue) <= 0.001 ? current : nextValue;
    });
  }, []);

  const zoomIn = useCallback(() => setZoom((current) => current * 1.18), [setZoom]);
  const zoomOut = useCallback(() => setZoom((current) => current / 1.18), [setZoom]);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
  };
};
