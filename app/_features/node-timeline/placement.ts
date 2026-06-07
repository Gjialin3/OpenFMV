import { NodeTimeline, TimelineClip, TimelineTrack, TimelineTrackType } from '@/app/_types';

import {
  createEmptyTimelineTrack,
  ensureNodeTimeline,
  getClipEndTime,
  getClipMediaTrackRole,
  getClipTrackType,
  getDefaultMediaTrackName,
  getDefaultTrackIdForType,
  getTrackMediaRole,
} from './schema';

export interface TimelinePlacementResult {
  trackId: string;
  tracks: TimelineTrack[];
  createdTrack: boolean;
}

export interface TimelinePlacementTimeSpan {
  startTime: number;
  duration: number;
  excludeClipId?: string | null;
}

export type TimelinePlacementStrategy =
  | { type: 'preferred' }
  | { type: 'aboveSource'; sourceTrackId?: string | null };

const canPlaceClipOnTrack = (clip: TimelineClip, track: TimelineTrack, allowLockedTracks: boolean) => {
  if (getClipTrackType(clip) !== track.type || (!allowLockedTracks && track.locked)) return false;
  if (track.type !== 'media') return true;
  const targetRole = getClipMediaTrackRole(clip);
  const trackRole = getTrackMediaRole(track);
  if (targetRole === 'audio') return trackRole === 'audio';
  return trackRole !== 'audio';
};

const hasTrackOverlap = ({
  track,
  timeSpans,
}: {
  track: TimelineTrack;
  timeSpans: TimelinePlacementTimeSpan[];
}) => {
  return timeSpans.some((timeSpan) => {
    const spanEnd = timeSpan.startTime + timeSpan.duration;
    return track.clips.some((existingClip) => {
      if (existingClip.id === timeSpan.excludeClipId) return false;
      const existingStart = existingClip.startTime;
      const existingEnd = getClipEndTime(existingClip);
      return timeSpan.startTime < existingEnd && spanEnd > existingStart;
    });
  });
};

const getGeneratedTrackInsertIndex = (tracks: TimelineTrack[], type: TimelineTrackType, preferredIndex?: number | null) => {
  if (preferredIndex !== undefined && preferredIndex !== null && Number.isFinite(preferredIndex)) {
    return Math.max(0, Math.min(tracks.length, Math.round(preferredIndex)));
  }

  if (type === 'media') {
    const lastMediaIndex = tracks.reduce((index, track, currentIndex) => (track.type === 'media' ? currentIndex : index), -1);
    return lastMediaIndex >= 0 ? lastMediaIndex + 1 : 0;
  }

  const lastSameTypeIndex = tracks.reduce((index, track, currentIndex) => (track.type === type ? currentIndex : index), -1);
  return lastSameTypeIndex >= 0 ? lastSameTypeIndex + 1 : tracks.length;
};

const createGeneratedTrack = (tracks: TimelineTrack[], clip: TimelineClip) => {
  const type = getClipTrackType(clip);
  const mediaRole = type === 'media' ? getClipMediaTrackRole(clip) : undefined;
  const sameTypeCount = tracks.filter((track) => track.type === type).length;
  const sameRoleCount = type === 'media'
    ? tracks.filter((track) => track.type === 'media' && getTrackMediaRole(track) === mediaRole).length
    : sameTypeCount;
  const baseTrackId = getDefaultTrackIdForType(type);
  let nextIndex = sameTypeCount + 1;
  let nextTrackId = `${baseTrackId}-${nextIndex}`;
  while (tracks.some((track) => track.id === nextTrackId)) {
    nextIndex += 1;
    nextTrackId = `${baseTrackId}-${nextIndex}`;
  }
  const nameIndex = sameRoleCount + 1;
  const name = type === 'media'
    ? `${getDefaultMediaTrackName(mediaRole)}${nameIndex > 1 ? ` ${nameIndex}` : ''}`
    : undefined;

  return createEmptyTimelineTrack(type, nextTrackId, { mediaRole, name });
};

export const resolveClipPlacement = ({
  timeline,
  clip,
  preferredTrackId,
  startTime = clip.startTime,
  excludeClipId,
  allowNewTrack = true,
  allowLockedTracks = false,
  forceNewTrack = false,
  newTrackInsertIndex,
  timeSpans,
  strategy = { type: 'preferred' },
}: {
  timeline?: NodeTimeline | null;
  clip: TimelineClip;
  preferredTrackId?: string | null;
  startTime?: number;
  excludeClipId?: string | null;
  allowNewTrack?: boolean;
  allowLockedTracks?: boolean;
  forceNewTrack?: boolean;
  newTrackInsertIndex?: number | null;
  timeSpans?: TimelinePlacementTimeSpan[];
  strategy?: TimelinePlacementStrategy;
}): TimelinePlacementResult => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const tracks = [...ensuredTimeline.tracks];
  const targetType = getClipTrackType(clip);
  const preferredTrack = preferredTrackId ? tracks.find((track) => track.id === preferredTrackId) : null;
  const placementTimeSpans = timeSpans?.length ? timeSpans : [{ startTime, duration: clip.duration, excludeClipId }];
  const canUseTrack = (track: TimelineTrack) => (
    canPlaceClipOnTrack(clip, track, allowLockedTracks) &&
    !hasTrackOverlap({ track, timeSpans: placementTimeSpans })
  );

  if (forceNewTrack && allowNewTrack) {
    const newTrack = createGeneratedTrack(tracks, clip);
    const nextTracks = [...tracks];
    nextTracks.splice(getGeneratedTrackInsertIndex(nextTracks, targetType, newTrackInsertIndex), 0, newTrack);
    return {
      trackId: newTrack.id,
      tracks: nextTracks,
      createdTrack: true,
    };
  }

  if (strategy.type === 'aboveSource' && strategy.sourceTrackId) {
    const sourceTrackIndex = tracks.findIndex((track) => track.id === strategy.sourceTrackId);
    const aboveTrack = sourceTrackIndex > 0 ? tracks[sourceTrackIndex - 1] : null;
    if (aboveTrack && canUseTrack(aboveTrack)) return { trackId: aboveTrack.id, tracks, createdTrack: false };
  }

  if (strategy.type !== 'aboveSource' && preferredTrack && canUseTrack(preferredTrack)) {
    return { trackId: preferredTrack.id, tracks, createdTrack: false };
  }

  const compatibleTrack = tracks.find(canUseTrack);
  if (compatibleTrack) return { trackId: compatibleTrack.id, tracks, createdTrack: false };

  if (!allowNewTrack) {
    const fallbackTrack = (
      preferredTrack && canPlaceClipOnTrack(clip, preferredTrack, allowLockedTracks)
        ? preferredTrack
        : tracks.find((track) => canPlaceClipOnTrack(clip, track, allowLockedTracks)) ?? createGeneratedTrack(tracks, clip)
    );
    if (!tracks.some((track) => track.id === fallbackTrack.id)) {
      tracks.splice(getGeneratedTrackInsertIndex(tracks, targetType, newTrackInsertIndex), 0, fallbackTrack);
    }
    return { trackId: fallbackTrack.id, tracks, createdTrack: !ensuredTimeline.tracks.some((track) => track.id === fallbackTrack.id) };
  }

  const newTrack = createGeneratedTrack(tracks, clip);
  const nextTracks = [...tracks];
  nextTracks.splice(getGeneratedTrackInsertIndex(nextTracks, targetType, newTrackInsertIndex), 0, newTrack);
  return {
    trackId: newTrack.id,
    tracks: nextTracks,
    createdTrack: true,
  };
};
