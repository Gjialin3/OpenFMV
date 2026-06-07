export interface TimelineEdgeScrollInput {
  pointerClientX: number;
  pointerClientY: number;
  viewportLeft: number;
  viewportTop: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  contentWidth?: number;
  edgeThreshold?: number;
  maxScrollSpeed?: number;
}

export interface TimelineEdgeScrollResult {
  scrollLeftDelta: number;
  scrollTopDelta: number;
  maxScrollLeft: number;
  maxScrollTop: number;
}

export const DEFAULT_TIMELINE_EDGE_SCROLL_THRESHOLD = 100;
export const DEFAULT_TIMELINE_EDGE_SCROLL_MAX_SPEED = 15;

const getAxisEdgeScrollDelta = ({
  pointerPosition,
  viewportSize,
  scrollPosition,
  maxScrollPosition,
  edgeThreshold,
  maxScrollSpeed,
}: {
  pointerPosition: number;
  viewportSize: number;
  scrollPosition: number;
  maxScrollPosition: number;
  edgeThreshold: number;
  maxScrollSpeed: number;
}) => {
  const axisThreshold = Math.max(1, Math.min(edgeThreshold, viewportSize / 2));

  if (pointerPosition < axisThreshold && scrollPosition > 0) {
    const edgeDistance = Math.max(0, pointerPosition);
    const intensity = Math.max(0, Math.min(1, 1 - edgeDistance / axisThreshold));
    return -maxScrollSpeed * intensity;
  }

  if (pointerPosition > viewportSize - axisThreshold && scrollPosition < maxScrollPosition) {
    const edgeDistance = Math.max(0, viewportSize - pointerPosition);
    const intensity = Math.max(0, Math.min(1, 1 - edgeDistance / axisThreshold));
    return maxScrollSpeed * intensity;
  }

  return 0;
};

export const getTimelineEdgeScroll = ({
  pointerClientX,
  pointerClientY,
  viewportLeft,
  viewportTop,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  scrollWidth,
  scrollHeight,
  contentWidth = scrollWidth,
  edgeThreshold = DEFAULT_TIMELINE_EDGE_SCROLL_THRESHOLD,
  maxScrollSpeed = DEFAULT_TIMELINE_EDGE_SCROLL_MAX_SPEED,
}: TimelineEdgeScrollInput): TimelineEdgeScrollResult => {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safeThreshold = Math.max(1, edgeThreshold);
  const safeMaxSpeed = Math.max(0, maxScrollSpeed);
  const maxScrollLeft = Math.max(0, Math.max(contentWidth, scrollWidth) - safeViewportWidth);
  const maxScrollTop = Math.max(0, scrollHeight - safeViewportHeight);

  return {
    scrollLeftDelta: getAxisEdgeScrollDelta({
      pointerPosition: pointerClientX - viewportLeft,
      viewportSize: safeViewportWidth,
      scrollPosition: scrollLeft,
      maxScrollPosition: maxScrollLeft,
      edgeThreshold: safeThreshold,
      maxScrollSpeed: safeMaxSpeed,
    }),
    scrollTopDelta: getAxisEdgeScrollDelta({
      pointerPosition: pointerClientY - viewportTop,
      viewportSize: safeViewportHeight,
      scrollPosition: scrollTop,
      maxScrollPosition: maxScrollTop,
      edgeThreshold: safeThreshold,
      maxScrollSpeed: safeMaxSpeed,
    }),
    maxScrollLeft,
    maxScrollTop,
  };
};
