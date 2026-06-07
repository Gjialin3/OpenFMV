import { TimelineMediaClip } from '@/app/_types';

import { clampTimelineMediaPlaybackRate } from './schema';

const MEDIA_CLOCK_EPSILON = 0.001;

export const getTimelineMediaPlaybackRate = (clip?: Pick<TimelineMediaClip, 'playbackRate'> | null) => {
  return clampTimelineMediaPlaybackRate(clip?.playbackRate);
};

export const getTimelineMediaSourceEnd = (clip?: Pick<TimelineMediaClip, 'sourceStart' | 'sourceDuration'> | null) => {
  const sourceDuration = Number(clip?.sourceDuration);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return null;
  return Math.max(0, Number(clip?.sourceStart) || 0) + sourceDuration;
};

export const getTimelineMediaElementTime = (clip: TimelineMediaClip, timelineTime: number) => {
  const playbackRate = getTimelineMediaPlaybackRate(clip);
  const sourceStart = Math.max(0, Number(clip.sourceStart) || 0);
  const sourceEnd = getTimelineMediaSourceEnd(clip);
  const freezeFrameTime = clip.type === 'video' && Number.isFinite(Number(clip.freezeFrameTime))
    ? Math.max(0, Number(clip.freezeFrameTime))
    : null;
  const unclampedLocalTime = Math.max(0, sourceStart + Math.max(0, timelineTime - clip.startTime) * playbackRate);

  return freezeFrameTime ?? (sourceEnd === null ? unclampedLocalTime : Math.min(unclampedLocalTime, sourceEnd));
};

export const getTimelineMediaSourceTimelineEnd = (clip?: TimelineMediaClip | null) => {
  const sourceDuration = Number(clip?.sourceDuration);
  if (!clip || !Number.isFinite(sourceDuration) || sourceDuration <= 0) return null;
  return clip.startTime + sourceDuration / getTimelineMediaPlaybackRate(clip);
};

export const hasTimelineMediaSourceEnded = (clip: TimelineMediaClip, timelineTime: number) => {
  const sourceTimelineEnd = getTimelineMediaSourceTimelineEnd(clip);
  return sourceTimelineEnd !== null && timelineTime >= sourceTimelineEnd - MEDIA_CLOCK_EPSILON;
};

export const shouldSyncTimelineToMediaElement = (clip?: TimelineMediaClip | null, timelineTime = 0) => {
  if (!clip || clip.type !== 'video') return false;
  if (Number.isFinite(Number(clip.freezeFrameTime))) return false;

  const sourceTimelineEnd = getTimelineMediaSourceTimelineEnd(clip);
  return sourceTimelineEnd === null || timelineTime < sourceTimelineEnd - MEDIA_CLOCK_EPSILON;
};
