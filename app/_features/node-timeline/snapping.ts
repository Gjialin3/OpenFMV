import { NodeTimeline, TimelineClip } from '@/app/_types';

import { ensureNodeTimeline, getClipEndTime, roundTimelineTime } from './schema';

export type TimelineSnapPointType = 'clip-start' | 'clip-end' | 'playhead' | 'bookmark' | 'boundary';

export interface TimelineSnapPoint {
  id: string;
  type: TimelineSnapPointType;
  time: number;
  clipId?: string;
}

export interface TimelineSnapResult {
  snappedTime: number;
  snapPoint: TimelineSnapPoint | null;
  snapDistance: number;
}

export type TimelineEditPointDirection = 'previous' | 'next';

export const buildTimelineSnapPoints = ({
  timeline,
  playheadTime,
  excludeClipId,
  excludeClipIds,
}: {
  timeline?: NodeTimeline | null;
  playheadTime?: number;
  excludeClipId?: string | null;
  excludeClipIds?: string[];
}): TimelineSnapPoint[] => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const excludedClipIds = new Set([...(excludeClipIds || []), ...(excludeClipId ? [excludeClipId] : [])]);
  const snapPoints: TimelineSnapPoint[] = [
    { id: 'timeline-start', type: 'boundary', time: 0 },
    { id: 'timeline-end', type: 'boundary', time: ensuredTimeline.duration },
  ];

  if (Number.isFinite(playheadTime)) {
    snapPoints.push({ id: 'playhead', type: 'playhead', time: roundTimelineTime(Number(playheadTime)) });
  }

  for (const bookmark of ensuredTimeline.bookmarks) {
    snapPoints.push({ id: `bookmark:${bookmark.id}`, type: 'bookmark', time: bookmark.time });
  }

  for (const track of ensuredTimeline.tracks) {
    for (const clip of track.clips) {
      if (excludedClipIds.has(clip.id)) continue;
      snapPoints.push({ id: `${clip.id}:start`, type: 'clip-start', clipId: clip.id, time: clip.startTime });
      snapPoints.push({ id: `${clip.id}:end`, type: 'clip-end', clipId: clip.id, time: getClipEndTime(clip) });
    }
  }

  return snapPoints;
};

export const resolveTimelineSnap = ({
  targetTime,
  snapPoints,
  maxSnapDistance = 0.12,
}: {
  targetTime: number;
  snapPoints: TimelineSnapPoint[];
  maxSnapDistance?: number;
}): TimelineSnapResult => {
  let closestSnapPoint: TimelineSnapPoint | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const snapPoint of snapPoints) {
    const distance = Math.abs(targetTime - snapPoint.time);
    if (distance <= maxSnapDistance && distance < closestDistance) {
      closestDistance = distance;
      closestSnapPoint = snapPoint;
    }
  }

  return {
    snappedTime: closestSnapPoint ? closestSnapPoint.time : targetTime,
    snapPoint: closestSnapPoint,
    snapDistance: closestDistance,
  };
};

export const getSnapAdjustedClipStart = ({
  clip,
  targetStartTime,
  snapPoints,
  maxSnapDistance,
}: {
  clip: TimelineClip;
  targetStartTime: number;
  snapPoints: TimelineSnapPoint[];
  maxSnapDistance?: number;
}) => {
  const startSnap = resolveTimelineSnap({ targetTime: targetStartTime, snapPoints, maxSnapDistance });
  if (startSnap.snapPoint) return startSnap.snappedTime;

  const endSnap = resolveTimelineSnap({ targetTime: targetStartTime + clip.duration, snapPoints, maxSnapDistance });
  if (endSnap.snapPoint) return roundTimelineTime(endSnap.snappedTime - clip.duration);

  return targetStartTime;
};

export const getAdjacentTimelineEditPoint = ({
  timeline,
  time,
  direction,
  epsilon = 0.001,
}: {
  timeline?: NodeTimeline | null;
  time: number;
  direction: TimelineEditPointDirection;
  epsilon?: number;
}) => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const currentTime = roundTimelineTime(Math.max(0, Math.min(ensuredTimeline.duration, Number(time) || 0)));
  const editPointTimes = Array.from(
    new Set(buildTimelineSnapPoints({ timeline: ensuredTimeline }).map((point) => roundTimelineTime(point.time)))
  ).sort((first, second) => first - second);

  if (direction === 'next') {
    return editPointTimes.find((editPointTime) => editPointTime > currentTime + epsilon) ?? null;
  }

  return [...editPointTimes].reverse().find((editPointTime) => editPointTime < currentTime - epsilon) ?? null;
};
