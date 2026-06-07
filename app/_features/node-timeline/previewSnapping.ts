import type { OverlayRect } from '@/app/_types';

export type PreviewSnapLineOrientation = 'vertical' | 'horizontal';
export type PreviewResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface PreviewSnapLine {
  orientation: PreviewSnapLineOrientation;
  position: number;
}

export interface PreviewSnapTarget {
  orientation: PreviewSnapLineOrientation;
  position: number;
}

export interface OverlaySnapResult {
  rect: OverlayRect;
  lines: PreviewSnapLine[];
}

const DEFAULT_PREVIEW_SNAP_THRESHOLD = 0.015;
const DEFAULT_PREVIEW_SNAP_TARGETS: PreviewSnapTarget[] = [
  { orientation: 'vertical', position: 0 },
  { orientation: 'vertical', position: 0.07 },
  { orientation: 'vertical', position: 0.5 },
  { orientation: 'vertical', position: 0.93 },
  { orientation: 'vertical', position: 1 },
  { orientation: 'horizontal', position: 0 },
  { orientation: 'horizontal', position: 0.07 },
  { orientation: 'horizontal', position: 0.5 },
  { orientation: 'horizontal', position: 0.93 },
  { orientation: 'horizontal', position: 1 },
];

const clampRect = (rect: OverlayRect): OverlayRect => {
  const width = Math.max(0.04, Math.min(1, Number(rect.width) || 0.2));
  const height = Math.max(0.04, Math.min(1, Number(rect.height) || 0.12));
  return {
    x: Math.max(0, Math.min(1 - width, Number(rect.x) || 0)),
    y: Math.max(0, Math.min(1 - height, Number(rect.y) || 0)),
    width,
    height,
  };
};

const uniqueTargets = (targets: PreviewSnapTarget[]) => {
  const seen = new Set<string>();
  const result: PreviewSnapTarget[] = [];

  for (const target of targets) {
    const normalizedTarget = {
      ...target,
      position: Number(target.position.toFixed(3)),
    };
    const key = `${normalizedTarget.orientation}:${normalizedTarget.position.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalizedTarget);
  }

  return result;
};

const getBestSnap = (values: number[], targets: PreviewSnapTarget[], orientation: PreviewSnapLineOrientation, threshold: number) => {
  let best: { delta: number; position: number; distance: number } | null = null;

  for (const value of values) {
    for (const target of targets) {
      if (target.orientation !== orientation) continue;
      const delta = target.position - value;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) best = { delta, position: target.position, distance };
    }
  }

  return best;
};

const resizeRectToSnap = (rect: OverlayRect, handle: PreviewResizeHandle, verticalSnap: ReturnType<typeof getBestSnap>, horizontalSnap: ReturnType<typeof getBestSnap>) => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  let nextRect = rect;

  if (verticalSnap) {
    if (handle.includes('w')) {
      nextRect = clampRect({
        ...nextRect,
        x: verticalSnap.position,
        width: right - verticalSnap.position,
      });
    } else {
      nextRect = clampRect({
        ...nextRect,
        width: verticalSnap.position - nextRect.x,
      });
    }
  }

  if (horizontalSnap) {
    if (handle.includes('n')) {
      nextRect = clampRect({
        ...nextRect,
        y: horizontalSnap.position,
        height: bottom - horizontalSnap.position,
      });
    } else {
      nextRect = clampRect({
        ...nextRect,
        height: horizontalSnap.position - nextRect.y,
      });
    }
  }

  return nextRect;
};

export const buildPreviewSnapTargets = (rects: OverlayRect[] = []): PreviewSnapTarget[] => {
  const rectTargets = rects.flatMap((rect) => {
    const safeRect = clampRect(rect);
    return [
      { orientation: 'vertical' as const, position: safeRect.x },
      { orientation: 'vertical' as const, position: safeRect.x + safeRect.width / 2 },
      { orientation: 'vertical' as const, position: safeRect.x + safeRect.width },
      { orientation: 'horizontal' as const, position: safeRect.y },
      { orientation: 'horizontal' as const, position: safeRect.y + safeRect.height / 2 },
      { orientation: 'horizontal' as const, position: safeRect.y + safeRect.height },
    ];
  });

  return uniqueTargets([...DEFAULT_PREVIEW_SNAP_TARGETS, ...rectTargets]);
};

export const snapOverlayRect = ({
  rect,
  resizeHandle,
  targets = buildPreviewSnapTargets(),
  threshold = DEFAULT_PREVIEW_SNAP_THRESHOLD,
}: {
  rect: OverlayRect;
  resizeHandle?: PreviewResizeHandle;
  targets?: PreviewSnapTarget[];
  threshold?: number;
}): OverlaySnapResult => {
  const safeRect = clampRect(rect);
  const lines: PreviewSnapLine[] = [];
  let nextRect = safeRect;

  const verticalValues = resizeHandle
    ? [resizeHandle.includes('w') ? nextRect.x : nextRect.x + nextRect.width]
    : [nextRect.x, nextRect.x + nextRect.width / 2, nextRect.x + nextRect.width];
  const verticalSnap = getBestSnap(verticalValues, targets, 'vertical', threshold);
  if (verticalSnap && !resizeHandle) {
    nextRect = clampRect({ ...nextRect, x: nextRect.x + verticalSnap.delta });
    lines.push({ orientation: 'vertical', position: verticalSnap.position });
  } else if (verticalSnap) {
    lines.push({ orientation: 'vertical', position: verticalSnap.position });
  }

  const horizontalValues = resizeHandle
    ? [resizeHandle.includes('n') ? nextRect.y : nextRect.y + nextRect.height]
    : [nextRect.y, nextRect.y + nextRect.height / 2, nextRect.y + nextRect.height];
  const horizontalSnap = getBestSnap(horizontalValues, targets, 'horizontal', threshold);
  if (horizontalSnap && !resizeHandle) {
    nextRect = clampRect({ ...nextRect, y: nextRect.y + horizontalSnap.delta });
    lines.push({ orientation: 'horizontal', position: horizontalSnap.position });
  } else if (horizontalSnap) {
    lines.push({ orientation: 'horizontal', position: horizontalSnap.position });
  }

  return {
    rect: resizeHandle ? resizeRectToSnap(safeRect, resizeHandle, verticalSnap, horizontalSnap) : nextRect,
    lines,
  };
};
