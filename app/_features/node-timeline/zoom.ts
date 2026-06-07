import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from './constants';

export const clampTimelineZoom = (zoom: number) => {
  return Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, Number.isFinite(zoom) ? zoom : MIN_TIMELINE_ZOOM));
};

export const timelineSliderToZoom = (sliderPosition: number) => {
  const position = Math.max(0, Math.min(1, Number.isFinite(sliderPosition) ? sliderPosition : 0));
  return clampTimelineZoom(MIN_TIMELINE_ZOOM * (MAX_TIMELINE_ZOOM / MIN_TIMELINE_ZOOM) ** position);
};

export const timelineZoomToSlider = (zoom: number) => {
  const safeZoom = clampTimelineZoom(zoom);
  return Math.log(safeZoom / MIN_TIMELINE_ZOOM) / Math.log(MAX_TIMELINE_ZOOM / MIN_TIMELINE_ZOOM);
};

export const getFitTimelineZoom = ({
  duration,
  viewportWidth,
  padding = 160,
}: {
  duration: number;
  viewportWidth: number;
  padding?: number;
}) => {
  const safeDuration = Math.max(0.1, Number.isFinite(duration) ? duration : 0);
  const safeViewportWidth = Math.max(1, Number.isFinite(viewportWidth) ? viewportWidth : 0);
  const usableWidth = Math.max(1, safeViewportWidth - Math.max(0, padding));
  return clampTimelineZoom(usableWidth / safeDuration);
};
