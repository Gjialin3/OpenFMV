import { NodeTimeline, TimelineClip, TimelineClipKeyframe, TimelineKeyframeInterpolation, TimelineKeyframeProperty, TimelineMediaClip, TimelineTrack } from '@/app/_types';

import { canDeleteTimelineTrack, canTimelineClipBeHidden, canTimelineClipHaveAudio, canTimelineTrackBeHidden, canTimelineTrackHaveAudio, isDefaultTimelineTrackId, MIN_TIMELINE_CLIP_DURATION } from './constants';
import { resolveClipPlacement } from './placement';
import {
  clampTimelineTime,
  clampOverlayRect,
  clampTimelineKeyframeValue,
  clampTimelineMediaPlaybackRate,
  createEmptyTimelineTrack,
  createTimelineId,
  ensureNodeTimeline,
  getClipEndTime,
  getTimelineClipLocalTime,
  isTimelineKeyframeInterpolation,
  isTimelineKeyframeProperty,
  getClipMediaTrackRole,
  getClipTrackType,
  getDefaultMediaTrackName,
  getDefaultTrackIdForType,
  getDefaultTrackName,
  getTrackMediaRole,
  isVisualMediaClip,
  resolveTimelineClipKeyframes,
  roundTimelineTime,
} from './schema';
import { clampTimelineZoom } from './zoom';

const BOOKMARK_TIME_EPSILON = 0.01;

const areTimelineRectsEqual = (first: TimelineMediaClip['rect'], second: TimelineMediaClip['rect']) => {
  if (!first || !second) return first === second;
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
};

const getClipSourcePlaybackRate = (clip: TimelineClip) => (
  clip.type === 'video' || clip.type === 'audio' ? clampTimelineMediaPlaybackRate(clip.playbackRate) : 1
);

const getClipSourceDelta = (clip: TimelineClip, timelineDelta: number) => {
  return roundTimelineTime(timelineDelta * getClipSourcePlaybackRate(clip));
};

const getAdjustedSourceStart = (clip: TimelineClip, timelineDelta: number) => {
  if (clip.sourceStart === undefined) return undefined;
  return Math.max(0, roundTimelineTime((Number(clip.sourceStart) || 0) + getClipSourceDelta(clip, timelineDelta)));
};

const getAdjustedSourceDuration = (clip: TimelineClip, timelineDelta: number) => {
  if (clip.sourceDuration === undefined) return undefined;
  return Math.max(0, roundTimelineTime((Number(clip.sourceDuration) || 0) + getClipSourceDelta(clip, timelineDelta)));
};

const getSplitSourceDuration = (clip: TimelineClip, timelineDuration: number) => {
  if (clip.sourceDuration === undefined) return undefined;
  return Math.min(Number(clip.sourceDuration) || 0, Math.max(0, getClipSourceDelta(clip, timelineDuration)));
};

const getRemainingSourceDuration = (clip: TimelineClip, consumedSourceDuration: number | undefined) => {
  if (clip.sourceDuration === undefined || consumedSourceDuration === undefined) return undefined;
  return Math.max(0, roundTimelineTime((Number(clip.sourceDuration) || 0) - consumedSourceDuration));
};

const getUnchangedTimeline = (timeline: NodeTimeline | null | undefined, ensuredTimeline: NodeTimeline): NodeTimeline => (
  timeline?.version === 2 && Array.isArray(timeline.tracks) ? timeline : ensuredTimeline
);

const withSortedTracks = (timeline: NodeTimeline, options: { pruneEmptyTracks?: boolean } = {}): NodeTimeline => ({
  ...timeline,
  duration: Math.max(timeline.duration, ...timeline.tracks.flatMap((track) => track.clips.map(getClipEndTime)), MIN_TIMELINE_CLIP_DURATION),
  tracks: timeline.tracks
    .filter((track) => !options.pruneEmptyTracks || isDefaultTimelineTrackId(track.id) || track.clips.length > 0)
    .map((track) => ({
      ...track,
      clips: [...track.clips].sort((first, second) => first.startTime - second.startTime),
    })),
});

export const pruneEmptyTimelineTracks = (timeline?: NodeTimeline | null): NodeTimeline => {
  return withSortedTracks(ensureNodeTimeline(timeline), { pruneEmptyTracks: true });
};

const mapTracks = (timeline: NodeTimeline, mapper: (track: TimelineTrack) => TimelineTrack, options: { pruneEmptyTracks?: boolean } = {}): NodeTimeline => {
  return withSortedTracks({
    ...timeline,
    tracks: timeline.tracks.map(mapper),
  }, options);
};

export interface TimelineClipboardItem {
  clip: TimelineClip;
  trackId?: string | null;
}

export const insertTimelineClip = ({
  timeline,
  clip,
  trackId,
  forceNewTrack = false,
  newTrackInsertIndex,
}: {
  timeline?: NodeTimeline | null;
  clip: TimelineClip;
  trackId?: string | null;
  forceNewTrack?: boolean;
  newTrackInsertIndex?: number | null;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const placement = resolveClipPlacement({
    timeline: ensuredTimeline,
    clip,
    preferredTrackId: trackId,
    forceNewTrack,
    newTrackInsertIndex,
  });
  const tracks = placement.tracks.map((track) => (
    track.id === placement.trackId
      ? { ...track, clips: [...track.clips, clip] }
      : track
  ));

  return withSortedTracks({
    ...ensuredTimeline,
    tracks,
  });
};

export const updateTimelineClip = ({
  timeline,
  clipId,
  update,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  update: (clip: TimelineClip) => TimelineClip;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  return mapTracks(ensuredTimeline, (track) => ({
    ...track,
    clips: track.clips.map((clip) => (clip.id === clipId ? update(clip) : clip)),
  }));
};

export const updateTimelineClipRect = ({
  timeline,
  clipId,
  rect,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  rect: TimelineMediaClip['rect'];
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  if (!rect) return unchangedTimeline;
  const safeRect = clampOverlayRect(rect);
  let didChange = false;

  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        if (clip.type === 'button') {
          if (areTimelineRectsEqual(clip.rect, safeRect)) return clip;
          didChange = true;
          return { ...clip, rect: safeRect };
        }
        if ((clip.type === 'video' || clip.type === 'image') && isVisualMediaClip(clip)) {
          if (areTimelineRectsEqual(clip.rect, safeRect)) return clip;
          didChange = true;
          return { ...clip, rect: safeRect };
        }
        return clip;
      }),
    };
  });
  return didChange ? nextTimeline : unchangedTimeline;
};

const canClipUseTimelineKeyframeProperty = (clip: TimelineClip, property: TimelineKeyframeProperty) => {
  if (property === 'volume') return clip.type === 'video' || clip.type === 'audio';
  if (property === 'x' || property === 'y' || property === 'width' || property === 'height') {
    return clip.type === 'video' || clip.type === 'image' || clip.type === 'button';
  }
  return true;
};

const getTimelineClipKeyframePropertyValue = (clip: TimelineClip, property: TimelineKeyframeProperty) => {
  if (property === 'opacity') return clip.opacity ?? 1;
  if (property === 'rotation') return clip.rotation ?? 0;
  if (property === 'volume' && (clip.type === 'video' || clip.type === 'audio')) return clip.volume ?? 1;
  if ((property === 'x' || property === 'y' || property === 'width' || property === 'height') && 'rect' in clip) {
    const rect = clip.rect ?? (clip.type === 'video' || clip.type === 'image' ? { x: 0, y: 0, width: 1, height: 1 } : undefined);
    return rect?.[property] ?? (property === 'width' || property === 'height' ? 1 : 0);
  }
  return 0;
};

const setTimelineClipKeyframedBaseValue = (clip: TimelineClip, property: TimelineKeyframeProperty, value: number): TimelineClip => {
  const safeValue = clampTimelineKeyframeValue(property, value);
  if (property === 'opacity') return { ...clip, opacity: safeValue } as TimelineClip;
  if (property === 'rotation') return { ...clip, rotation: safeValue } as TimelineClip;
  if (property === 'volume' && (clip.type === 'video' || clip.type === 'audio')) {
    return { ...clip, volume: safeValue } as TimelineClip;
  }
  if ((property === 'x' || property === 'y' || property === 'width' || property === 'height') && 'rect' in clip) {
    const rect = clip.rect ?? (clip.type === 'video' || clip.type === 'image' ? { x: 0, y: 0, width: 1, height: 1 } : undefined);
    if (!rect) return clip;
    return {
      ...clip,
      rect: clampOverlayRect({
        ...rect,
        [property]: safeValue,
      }),
    } as TimelineClip;
  }
  return clip;
};

export interface TimelineKeyframeClipboardItem {
  property: TimelineKeyframeProperty;
  timeOffset: number;
  value: number;
  interpolation?: TimelineKeyframeInterpolation;
}

export const createTimelineKeyframeClipboardItems = (keyframes: TimelineClipKeyframe[]): TimelineKeyframeClipboardItem[] => {
  const validKeyframes = keyframes
    .filter((keyframe) => isTimelineKeyframeProperty(keyframe.property))
    .sort((first, second) => first.time - second.time || first.property.localeCompare(second.property));
  if (validKeyframes.length === 0) return [];

  const baseTime = Math.min(...validKeyframes.map((keyframe) => keyframe.time));
  return validKeyframes.map((keyframe) => ({
    property: keyframe.property,
    timeOffset: roundTimelineTime(keyframe.time - baseTime),
    value: keyframe.value,
    ...(keyframe.interpolation ? { interpolation: keyframe.interpolation } : {}),
  }));
};

export const pasteTimelineClipKeyframes = ({
  timeline,
  clipId,
  items,
  time,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  items: TimelineKeyframeClipboardItem[];
  time: number;
}): { timeline: NodeTimeline; keyframeIds: string[] } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  if (items.length === 0) return { timeline: unchangedTimeline, keyframeIds: [] };

  let pastedKeyframeIds: string[] = [];
  let didChange = false;
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const baseTime = getTimelineClipLocalTime(clip, time);
        const nextKeyframes = [...(clip.keyframes || [])];

        for (const item of items) {
          if (!isTimelineKeyframeProperty(item.property) || !canClipUseTimelineKeyframeProperty(clip, item.property)) continue;
          const keyframeTime = roundTimelineTime(Math.max(0, Math.min(clip.duration, baseTime + item.timeOffset)));
          const keyframe: TimelineClipKeyframe = {
            id: createTimelineId(),
            property: item.property,
            time: keyframeTime,
            value: clampTimelineKeyframeValue(item.property, item.value),
            ...(item.interpolation ? { interpolation: item.interpolation } : {}),
          };
          const existingIndex = nextKeyframes.findIndex((candidate) => (
            candidate.property === keyframe.property &&
            Math.abs(candidate.time - keyframe.time) <= BOOKMARK_TIME_EPSILON
          ));
          if (existingIndex >= 0) {
            nextKeyframes[existingIndex] = keyframe;
          } else {
            nextKeyframes.push(keyframe);
          }
          pastedKeyframeIds = [...pastedKeyframeIds, keyframe.id];
          didChange = true;
        }

        if (!didChange) return clip;
        return {
          ...clip,
          keyframes: nextKeyframes.sort((first, second) => first.time - second.time || first.property.localeCompare(second.property)),
        } as TimelineClip;
      }),
    };
  });

  return {
    timeline: didChange ? nextTimeline : unchangedTimeline,
    keyframeIds: didChange ? pastedKeyframeIds : [],
  };
};

export const upsertTimelineClipKeyframe = ({
  timeline,
  clipId,
  property,
  time,
  value,
  interpolation,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  property: TimelineKeyframeProperty;
  time: number;
  value: number;
  interpolation?: TimelineKeyframeInterpolation;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  if (!isTimelineKeyframeProperty(property)) return unchangedTimeline;
  const safeInterpolation = isTimelineKeyframeInterpolation(interpolation) ? interpolation : undefined;

  let didChange = false;
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId || !canClipUseTimelineKeyframeProperty(clip, property)) return clip;
        const keyframeTime = getTimelineClipLocalTime(clip, time);
        const keyframeValue = clampTimelineKeyframeValue(property, value);
        const keyframes = [...(clip.keyframes || [])];
        const existingIndex = keyframes.findIndex((keyframe) => keyframe.property === property && Math.abs(keyframe.time - keyframeTime) <= BOOKMARK_TIME_EPSILON);
        if (existingIndex >= 0) {
          const existing = keyframes[existingIndex];
          if (existing.value === keyframeValue && existing.time === keyframeTime && (safeInterpolation === undefined || existing.interpolation === safeInterpolation)) return clip;
          keyframes[existingIndex] = { ...existing, time: keyframeTime, value: keyframeValue, interpolation: safeInterpolation ?? existing.interpolation };
        } else {
          keyframes.push({ id: createTimelineId(), property, time: keyframeTime, value: keyframeValue, interpolation: safeInterpolation });
        }
        didChange = true;
        return {
          ...clip,
          keyframes: keyframes.sort((first, second) => first.time - second.time || first.property.localeCompare(second.property)),
        } as TimelineClip;
      }),
    };
  });

  return didChange ? nextTimeline : unchangedTimeline;
};

export const setTimelineClipKeyframesInterpolation = ({
  timeline,
  clipId,
  keyframeIds,
  interpolation,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  keyframeIds: string[];
  interpolation: TimelineKeyframeInterpolation;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  if (!isTimelineKeyframeInterpolation(interpolation)) return unchangedTimeline;
  const keyframeIdSet = new Set(keyframeIds);
  if (keyframeIdSet.size === 0) return unchangedTimeline;

  let didChange = false;
  const nextInterpolation = interpolation === 'linear' ? undefined : interpolation;
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId || !clip.keyframes?.length) return clip;
        const nextKeyframes = clip.keyframes.map((keyframe) => {
          if (!keyframeIdSet.has(keyframe.id) || keyframe.interpolation === nextInterpolation) return keyframe;
          didChange = true;
          return { ...keyframe, interpolation: nextInterpolation };
        });
        return didChange ? ({ ...clip, keyframes: nextKeyframes } as TimelineClip) : clip;
      }),
    };
  });

  return didChange ? nextTimeline : unchangedTimeline;
};

export const moveTimelineClipKeyframes = ({
  timeline,
  clipId,
  keyframeIds,
  deltaTime,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  keyframeIds: string[];
  deltaTime: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const keyframeIdSet = new Set(keyframeIds);
  if (keyframeIdSet.size === 0 || Math.abs(deltaTime) <= 0.0001) return unchangedTimeline;

  let didChange = false;
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId || !clip.keyframes?.length) return clip;
        const movingKeyframes = clip.keyframes.filter((keyframe) => keyframeIdSet.has(keyframe.id));
        if (movingKeyframes.length === 0) return clip;

        const minDelta = Math.max(...movingKeyframes.map((keyframe) => -keyframe.time));
        const maxDelta = Math.min(...movingKeyframes.map((keyframe) => clip.duration - keyframe.time));
        const boundedDelta = Math.max(minDelta, Math.min(maxDelta, deltaTime));
        if (Math.abs(boundedDelta) <= 0.0001) return clip;

        const nextKeyframes = clip.keyframes.filter((keyframe) => !keyframeIdSet.has(keyframe.id));
        for (const keyframe of movingKeyframes) {
          const movedKeyframe: TimelineClipKeyframe = {
            ...keyframe,
            time: roundTimelineTime(Math.max(0, Math.min(clip.duration, keyframe.time + boundedDelta))),
          };
          const existingIndex = nextKeyframes.findIndex((candidate) => (
            candidate.property === movedKeyframe.property &&
            Math.abs(candidate.time - movedKeyframe.time) <= BOOKMARK_TIME_EPSILON
          ));
          if (existingIndex >= 0) {
            nextKeyframes[existingIndex] = movedKeyframe;
          } else {
            nextKeyframes.push(movedKeyframe);
          }
        }

        didChange = true;
        return {
          ...clip,
          keyframes: nextKeyframes.sort((first, second) => first.time - second.time || first.property.localeCompare(second.property)),
        } as TimelineClip;
      }),
    };
  });

  return didChange ? nextTimeline : unchangedTimeline;
};

export const removeTimelineClipKeyframes = ({
  timeline,
  clipId,
  keyframeIds,
  valueAtTime,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  keyframeIds: string[];
  valueAtTime?: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const keyframeIdSet = new Set(keyframeIds);
  if (keyframeIdSet.size === 0) return unchangedTimeline;

  let didChange = false;
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId || !clip.keyframes?.length) return clip;
        const removedKeyframes = clip.keyframes.filter((keyframe) => keyframeIdSet.has(keyframe.id));
        if (removedKeyframes.length === 0) return clip;

        const nextKeyframes = clip.keyframes.filter((keyframe) => !keyframeIdSet.has(keyframe.id));
        const removedProperties = Array.from(new Set(removedKeyframes.map((keyframe) => keyframe.property)));
        const resolvedClip = valueAtTime === undefined ? clip : resolveTimelineClipKeyframes(clip, valueAtTime);
        let nextClip: TimelineClip = {
          ...clip,
          keyframes: nextKeyframes.length > 0 ? nextKeyframes : undefined,
        } as TimelineClip;

        for (const property of removedProperties) {
          if (nextKeyframes.some((keyframe) => keyframe.property === property)) continue;
          nextClip = setTimelineClipKeyframedBaseValue(nextClip, property, getTimelineClipKeyframePropertyValue(resolvedClip, property));
        }

        didChange = true;
        return nextClip;
      }),
    };
  });

  return didChange ? nextTimeline : unchangedTimeline;
};

export const setTimelineClipsEnabled = ({
  timeline,
  clipIds,
  enabled,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  enabled: boolean;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return ensuredTimeline;

  return mapTracks(ensuredTimeline, (track) => (
    track.locked
      ? track
      : {
          ...track,
          clips: track.clips.map((clip) => (clipIdSet.has(clip.id) ? ({ ...clip, enabled } as TimelineClip) : clip)),
        }
  ));
};

export const setTimelineClipsHidden = ({
  timeline,
  clipIds,
  hidden,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  hidden: boolean;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return ensuredTimeline;

  return mapTracks(ensuredTimeline, (track) => (
    track.locked
      ? track
      : {
          ...track,
          clips: track.clips.map((clip) => (
            clipIdSet.has(clip.id) && canTimelineClipBeHidden(clip)
              ? ({ ...clip, hidden } as TimelineClip)
              : clip
          )),
        }
  ));
};

export const setTimelineClipsMuted = ({
  timeline,
  clipIds,
  muted,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  muted: boolean;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return ensuredTimeline;

  return mapTracks(ensuredTimeline, (track) => (
    track.locked
      ? track
      : {
          ...track,
          clips: track.clips.map((clip) => (
            clipIdSet.has(clip.id) && canTimelineClipHaveAudio(clip)
              ? ({ ...clip, muted } as TimelineClip)
              : clip
          )),
        }
  ));
};

export const isTimelineSourceAudioSeparated = (clip?: TimelineClip | null): clip is TimelineMediaClip & { type: 'video'; sourceAudioEnabled: false } => {
  return clip?.type === 'video' && clip.sourceAudioEnabled === false;
};

export const canToggleTimelineSourceAudio = (clip?: TimelineClip | null): clip is TimelineMediaClip & { type: 'video' } => {
  return clip?.type === 'video';
};

const createSeparatedAudioClip = (sourceClip: TimelineMediaClip & { type: 'video' }, linkGroupId: string): TimelineMediaClip => ({
  id: createTimelineId(),
  type: 'audio',
  src: sourceClip.src,
  name: sourceClip.name ? `${sourceClip.name} audio` : 'Extracted audio',
  assetId: sourceClip.assetId,
  startTime: sourceClip.startTime,
  duration: sourceClip.duration,
  sourceStart: sourceClip.sourceStart,
  sourceDuration: sourceClip.sourceDuration,
  enabled: sourceClip.enabled,
  hidden: sourceClip.hidden,
  opacity: sourceClip.opacity,
  muted: sourceClip.muted,
  volume: sourceClip.volume ?? 1,
  playbackRate: sourceClip.playbackRate ?? 1,
  preservePitch: sourceClip.preservePitch !== false,
  sourceVideoClipId: sourceClip.id,
  linkGroupId,
});

export const toggleTimelineSourceAudioSeparation = ({
  timeline,
  clipId,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
}): { timeline: NodeTimeline; audioClipId: string | null; separated: boolean } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipRef = findTimelineClip(ensuredTimeline, clipId);
  if (!clipRef || clipRef.track.locked || !canToggleTimelineSourceAudio(clipRef.clip)) {
    return { timeline: ensuredTimeline, audioClipId: null, separated: false };
  }

  if (isTimelineSourceAudioSeparated(clipRef.clip)) {
    const nextTimeline = mapTracks(ensuredTimeline, (track) => {
      if (track.locked) return track;
      return {
        ...track,
        clips: track.clips
          .filter((clip) => !(clip.type === 'audio' && clip.sourceVideoClipId === clipId))
          .map((clip) => (
            clip.id === clipId
              ? ({ ...clip, sourceAudioEnabled: undefined } as TimelineClip)
              : clip
          )),
      };
    }, { pruneEmptyTracks: true });

    return { timeline: nextTimeline, audioClipId: null, separated: false };
  }

  const linkGroupId = clipRef.clip.linkGroupId || createTimelineId();
  const audioClip = createSeparatedAudioClip(clipRef.clip, linkGroupId);
  const nextTimeline = mapTracks(ensuredTimeline, (track) => {
    if (track.locked) return track;
    return {
      ...track,
      clips: track.clips.map((clip) => (
        clip.id === clipId
          ? ({ ...clip, sourceAudioEnabled: false, linkGroupId } as TimelineClip)
          : clip
      )),
    };
  });

  return {
    timeline: insertTimelineClip({ timeline: nextTimeline, clip: audioClip }),
    audioClipId: audioClip.id,
    separated: true,
  };
};

export const linkTimelineClips = ({
  timeline,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
}): { timeline: NodeTimeline; linkGroupId: string | null } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size < 2) return { timeline: ensuredTimeline, linkGroupId: null };

  const editableLinkedClipIds = ensuredTimeline.tracks.flatMap((track) => (
    track.locked ? [] : track.clips.filter((clip) => clipIdSet.has(clip.id)).map((clip) => clip.id)
  ));
  if (editableLinkedClipIds.length < 2) return { timeline: ensuredTimeline, linkGroupId: null };

  const linkGroupId = createTimelineId();
  const editableClipIdSet = new Set(editableLinkedClipIds);
  return {
    linkGroupId,
    timeline: mapTracks(ensuredTimeline, (track) => (
      track.locked
        ? track
        : {
            ...track,
            clips: track.clips.map((clip) => (editableClipIdSet.has(clip.id) ? ({ ...clip, linkGroupId } as TimelineClip) : clip)),
          }
    )),
  };
};

export const unlinkTimelineClips = ({
  timeline,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const selectedClipIdSet = new Set(clipIds);
  if (selectedClipIdSet.size === 0) return ensuredTimeline;

  const linkGroupIds = new Set(
    ensuredTimeline.tracks.flatMap((track) => (
      track.locked
        ? []
        : track.clips
            .filter((clip) => selectedClipIdSet.has(clip.id) && clip.linkGroupId)
            .map((clip) => clip.linkGroupId as string)
    ))
  );
  if (linkGroupIds.size === 0) return ensuredTimeline;

  return mapTracks(ensuredTimeline, (track) => (
    track.locked
      ? track
      : {
          ...track,
          clips: track.clips.map((clip) => (clip.linkGroupId && linkGroupIds.has(clip.linkGroupId) ? ({ ...clip, linkGroupId: undefined } as TimelineClip) : clip)),
        }
  ));
};

export const getLinkedTimelineClipIds = ({
  timeline,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
}): string[] => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return [];

  const linkGroupIds = new Set(
    ensuredTimeline.tracks.flatMap((track) => (
      track.clips
        .filter((clip) => clipIdSet.has(clip.id) && clip.linkGroupId)
        .map((clip) => clip.linkGroupId as string)
    ))
  );
  if (linkGroupIds.size === 0) return Array.from(clipIdSet);

  return ensuredTimeline.tracks.flatMap((track) => (
    track.clips
      .filter((clip) => clipIdSet.has(clip.id) || Boolean(clip.linkGroupId && linkGroupIds.has(clip.linkGroupId)))
      .map((clip) => clip.id)
  ));
};

export const deleteTimelineClip = ({
  timeline,
  clipId,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  return mapTracks(ensuredTimeline, (track) => ({
    ...track,
    clips: track.clips.filter((clip) => clip.id !== clipId),
  }), { pruneEmptyTracks: true });
};

export const deleteTimelineClips = ({
  timeline,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return ensuredTimeline;

  return mapTracks(ensuredTimeline, (track) => (
    track.locked
      ? track
      : { ...track, clips: track.clips.filter((clip) => !clipIdSet.has(clip.id)) }
  ), { pruneEmptyTracks: true });
};

const getDeletedTimeRangesByTrack = (timeline: NodeTimeline, clipIdSet: Set<string>) => {
  return timeline.tracks
    .filter((track) => !track.locked)
    .map((track) => ({
      trackId: track.id,
      ranges: track.clips
        .filter((clip) => clipIdSet.has(clip.id))
        .map((clip) => ({ startTime: clip.startTime, endTime: getClipEndTime(clip) }))
        .sort((first, second) => first.startTime - second.startTime),
    }))
    .filter((item) => item.ranges.length > 0);
};

const getRippleOffsetAtTime = (ranges: Array<{ startTime: number; endTime: number }>, time: number) => {
  return ranges.reduce((offset, range) => (
    time >= range.endTime ? offset + Math.max(0, range.endTime - range.startTime) : offset
  ), 0);
};

export const deleteTimelineClipsWithRipple = ({
  timeline,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0) return ensuredTimeline;

  const rangesByTrack = getDeletedTimeRangesByTrack(ensuredTimeline, clipIdSet);
  if (rangesByTrack.length === 0) return ensuredTimeline;
  const rangesByTrackId = new Map(rangesByTrack.map((item) => [item.trackId, item.ranges]));

  return withSortedTracks({
    ...ensuredTimeline,
    tracks: ensuredTimeline.tracks.map((track) => {
      if (track.locked) return track;
      const ranges = rangesByTrackId.get(track.id) || [];
      return {
        ...track,
        clips: track.clips
          .filter((clip) => !clipIdSet.has(clip.id))
          .map((clip) => {
            const offset = getRippleOffsetAtTime(ranges, clip.startTime);
            return offset > 0 ? ({ ...clip, startTime: roundTimelineTime(Math.max(0, clip.startTime - offset)) } as TimelineClip) : clip;
          }),
      };
    }),
  }, { pruneEmptyTracks: true });
};

export const cloneTimelineClip = ({
  clip,
  startTime,
  nameSuffix,
  preserveLinkFields = false,
}: {
  clip: TimelineClip;
  startTime?: number;
  nameSuffix?: string;
  preserveLinkFields?: boolean;
}): TimelineClip => {
  const nextClip = JSON.parse(JSON.stringify(clip)) as TimelineClip;
  const clonedClip = {
    ...nextClip,
    id: createTimelineId(),
    startTime: Math.max(0, roundTimelineTime(startTime ?? nextClip.startTime)),
    name: nextClip.name && nameSuffix ? `${nextClip.name}${nameSuffix}` : nextClip.name,
    linkGroupId: preserveLinkFields ? nextClip.linkGroupId : undefined,
  } as TimelineClip;
  if (!preserveLinkFields && clonedClip.type === 'video') clonedClip.sourceAudioEnabled = undefined;
  if (!preserveLinkFields && clonedClip.type === 'audio') clonedClip.sourceVideoClipId = undefined;
  return clonedClip;
};

export const pasteTimelineClip = ({
  timeline,
  clip,
  startTime,
  trackId,
}: {
  timeline?: NodeTimeline | null;
  clip: TimelineClip;
  startTime: number;
  trackId?: string | null;
}): { timeline: NodeTimeline; clip: TimelineClip } => {
  const nextClip = cloneTimelineClip({ clip, startTime });
  return {
    timeline: insertTimelineClip({ timeline, clip: nextClip, trackId }),
    clip: nextClip,
  };
};

export const pasteTimelineClips = ({
  timeline,
  items,
  startTime,
  nameSuffix,
}: {
  timeline?: NodeTimeline | null;
  items: TimelineClipboardItem[];
  startTime: number;
  nameSuffix?: string;
}): { timeline: NodeTimeline; clips: TimelineClip[] } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const validItems = items.filter((item) => item.clip);
  if (validItems.length === 0) return { timeline: ensuredTimeline, clips: [] };

  const anchorStart = Math.min(...validItems.map((item) => item.clip.startTime));
  let nextTimeline = ensuredTimeline;
  const clips: TimelineClip[] = [];
  const linkGroupItemCounts = new Map<string, number>();

  for (const item of validItems) {
    if (!item.clip.linkGroupId) continue;
    linkGroupItemCounts.set(item.clip.linkGroupId, (linkGroupItemCounts.get(item.clip.linkGroupId) ?? 0) + 1);
  }

  const sortedItems = [...validItems].sort((first, second) => first.clip.startTime - second.clip.startTime);
  const clonedItems = sortedItems.map((item) => {
    const shouldPreserveLinkFields = item.clip.linkGroupId ? (linkGroupItemCounts.get(item.clip.linkGroupId) ?? 0) > 1 : false;
    return {
      sourceItem: item,
      clip: cloneTimelineClip({
        clip: item.clip,
        startTime: roundTimelineTime(startTime + item.clip.startTime - anchorStart),
        nameSuffix,
        preserveLinkFields: shouldPreserveLinkFields,
      }),
    };
  });
  const clonedClipIdBySourceId = new Map(clonedItems.map((item) => [item.sourceItem.clip.id, item.clip.id]));
  const clonedLinkGroupIdBySourceId = new Map<string, string>();

  for (const item of clonedItems) {
    const sourceClip = item.sourceItem.clip;
    const sourceLinkGroupId = sourceClip.linkGroupId;
    if (sourceLinkGroupId && (linkGroupItemCounts.get(sourceLinkGroupId) ?? 0) > 1) {
      const nextLinkGroupId = clonedLinkGroupIdBySourceId.get(sourceLinkGroupId) ?? createTimelineId();
      clonedLinkGroupIdBySourceId.set(sourceLinkGroupId, nextLinkGroupId);
      item.clip.linkGroupId = nextLinkGroupId;
    } else {
      item.clip.linkGroupId = undefined;
    }

    if (item.clip.type === 'audio' && sourceClip.type === 'audio') {
      item.clip.sourceVideoClipId = sourceClip.sourceVideoClipId ? clonedClipIdBySourceId.get(sourceClip.sourceVideoClipId) : undefined;
    }

    if (item.clip.type === 'video' && sourceClip.type === 'video' && sourceClip.sourceAudioEnabled === false) {
      const hasSourceAudioClone = clonedItems.some((candidate) => (
        candidate.sourceItem.clip.type === 'audio' &&
        candidate.sourceItem.clip.sourceVideoClipId === sourceClip.id
      ));
      item.clip.sourceAudioEnabled = hasSourceAudioClone ? false : undefined;
    }
  }

  const itemsByTrackId = new Map<string, typeof clonedItems>();

  for (const item of clonedItems) {
    const groupKey = item.sourceItem.trackId || item.sourceItem.clip.id;
    itemsByTrackId.set(groupKey, [...(itemsByTrackId.get(groupKey) ?? []), item]);
  }

  for (const groupItems of Array.from(itemsByTrackId.values())) {
    const nextClips = groupItems.map((item) => item.clip);
    const anchorClip = nextClips[0];
    if (!anchorClip) continue;
    const sourceTrackId = groupItems[0].sourceItem.trackId;

    const placement = resolveClipPlacement({
      timeline: nextTimeline,
      clip: anchorClip,
      preferredTrackId: sourceTrackId,
      startTime: anchorClip.startTime,
      strategy: { type: 'aboveSource', sourceTrackId },
      timeSpans: nextClips.map((clip) => ({ startTime: clip.startTime, duration: clip.duration })),
    });

    nextTimeline = { ...nextTimeline, tracks: placement.tracks };
    for (const clip of nextClips) {
      nextTimeline = insertTimelineClip({ timeline: nextTimeline, clip, trackId: placement.trackId });
      clips.push(clip);
    }
  }

  return { timeline: nextTimeline, clips };
};

export const duplicateTimelineClip = ({
  timeline,
  clipId,
  startTime,
  trackId,
  nameSuffix = ' copy',
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  startTime?: number;
  trackId?: string | null;
  nameSuffix?: string;
}): { timeline: NodeTimeline; clip: TimelineClip | null } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipRef = findTimelineClip(ensuredTimeline, clipId);
  if (!clipRef || clipRef.track.locked) return { timeline: ensuredTimeline, clip: null };

  const nextClip = cloneTimelineClip({
    clip: clipRef.clip,
    startTime: startTime ?? getClipEndTime(clipRef.clip),
    nameSuffix,
  });
  return {
    timeline: insertTimelineClip({ timeline: ensuredTimeline, clip: nextClip, trackId: trackId ?? clipRef.track.id }),
    clip: nextClip,
  };
};

export const duplicateTimelineClips = ({
  timeline,
  clipIds,
  startTime,
  nameSuffix = ' copy',
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  startTime?: number;
  nameSuffix?: string;
}): { timeline: NodeTimeline; clips: TimelineClip[] } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipIdSet = new Set(clipIds);
  const items = ensuredTimeline.tracks.flatMap((track) => (
    track.locked
      ? []
      : track.clips
          .filter((clip) => clipIdSet.has(clip.id))
          .map((clip) => ({ clip, trackId: track.id }))
  ));
  if (items.length === 0) return { timeline: ensuredTimeline, clips: [] };

  const duplicateStart = startTime ?? Math.max(...items.map((item) => getClipEndTime(item.clip)));
  return pasteTimelineClips({
    timeline: ensuredTimeline,
    items,
    startTime: duplicateStart,
    nameSuffix,
  });
};

export type SplitTimelineRetainSide = 'both' | 'left' | 'right';

export const getTimelineSplitTargetClipIds = ({
  timeline,
  time,
  clipIds,
}: {
  timeline?: NodeTimeline | null;
  time: number;
  clipIds?: string[] | null;
}) => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const splitTime = roundTimelineTime(time);
  const uniqueClipIds = clipIds?.length ? Array.from(new Set(clipIds)) : null;
  const candidateRefs = uniqueClipIds
    ? uniqueClipIds
        .map((clipId) => findTimelineClip(ensuredTimeline, clipId))
        .filter((clipRef): clipRef is NonNullable<ReturnType<typeof findTimelineClip>> => Boolean(clipRef))
    : ensuredTimeline.tracks.flatMap((track) => (
      track.locked
        ? []
        : track.clips.map((clip) => ({ track, clip }))
    ));

  return candidateRefs
    .filter(({ track }) => !track.locked)
    .filter(({ clip }) => (
      splitTime > clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
      splitTime < getClipEndTime(clip) - MIN_TIMELINE_CLIP_DURATION
    ))
    .map(({ clip }) => clip.id);
};

export const splitTimelineClip = ({
  timeline,
  clipId,
  time,
  retainSide = 'both',
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  time: number;
  retainSide?: SplitTimelineRetainSide;
}): { timeline: NodeTimeline; clipIds: string[] } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipRef = findTimelineClip(ensuredTimeline, clipId);
  if (!clipRef || clipRef.track.locked) return { timeline: ensuredTimeline, clipIds: [] };

  const splitTime = roundTimelineTime(time);
  const clipEndTime = getClipEndTime(clipRef.clip);
  const canSplitAtTime = (
    splitTime > clipRef.clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
    splitTime < clipEndTime - MIN_TIMELINE_CLIP_DURATION
  );
  if (!canSplitAtTime) return { timeline: ensuredTimeline, clipIds: [] };

  const leftDuration = roundTimelineTime(splitTime - clipRef.clip.startTime);
  const rightDuration = roundTimelineTime(clipEndTime - splitTime);
  const leftSourceDuration = getSplitSourceDuration(clipRef.clip, leftDuration);
  const rightClip = {
    ...clipRef.clip,
    id: createTimelineId(),
    startTime: splitTime,
    duration: rightDuration,
    sourceStart: getAdjustedSourceStart(clipRef.clip, leftDuration),
    sourceDuration: getRemainingSourceDuration(clipRef.clip, leftSourceDuration),
  } as TimelineClip;

  if (retainSide === 'right') {
    const withoutOriginal = {
      ...ensuredTimeline,
      tracks: ensuredTimeline.tracks.map((track) => (
        track.id === clipRef.track.id
          ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipRef.clip.id) }
          : track
      )),
    };
    return {
      timeline: insertTimelineClip({ timeline: withoutOriginal, clip: rightClip, trackId: clipRef.track.id }),
      clipIds: [rightClip.id],
    };
  }

  const leftTimeline = updateTimelineClip({
    timeline: ensuredTimeline,
    clipId: clipRef.clip.id,
    update: (clip) => ({ ...clip, duration: leftDuration, sourceDuration: leftSourceDuration }),
  });

  if (retainSide === 'left') {
    return { timeline: leftTimeline, clipIds: [clipRef.clip.id] };
  }

  return {
    timeline: insertTimelineClip({ timeline: leftTimeline, clip: rightClip, trackId: clipRef.track.id }),
    clipIds: [rightClip.id],
  };
};

export const splitTimelineClips = ({
  timeline,
  clipIds,
  time,
  retainSide = 'both',
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  time: number;
  retainSide?: SplitTimelineRetainSide;
}): { timeline: NodeTimeline; clipIds: string[] } => {
  const uniqueClipIds = Array.from(new Set(clipIds));
  let nextTimeline = ensureNodeTimeline(timeline);
  const resultClipIds: string[] = [];

  for (const clipId of uniqueClipIds) {
    const result = splitTimelineClip({
      timeline: nextTimeline,
      clipId,
      time,
      retainSide,
    });
    nextTimeline = result.timeline;
    resultClipIds.push(...result.clipIds);
  }

  return {
    timeline: nextTimeline,
    clipIds: resultClipIds,
  };
};

export const freezeTimelineVideoClipAtTime = ({
  timeline,
  clipId,
  time,
  duration = 2,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  time: number;
  duration?: number;
}): { timeline: NodeTimeline; clip: TimelineMediaClip | null } => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const clipRef = findTimelineClip(ensuredTimeline, clipId);
  if (!clipRef || clipRef.track.locked || clipRef.clip.type !== 'video') return { timeline: ensuredTimeline, clip: null };

  const splitTime = roundTimelineTime(time);
  const clipEndTime = getClipEndTime(clipRef.clip);
  const canFreezeAtTime = (
    splitTime > clipRef.clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
    splitTime < clipEndTime - MIN_TIMELINE_CLIP_DURATION
  );
  if (!canFreezeAtTime) return { timeline: ensuredTimeline, clip: null };

  const freezeDuration = Math.max(MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(duration));
  const leftDuration = roundTimelineTime(splitTime - clipRef.clip.startTime);
  const rightDuration = roundTimelineTime(clipEndTime - splitTime);
  const playbackRate = clampTimelineMediaPlaybackRate(clipRef.clip.playbackRate);
  const sourceStart = Number(clipRef.clip.sourceStart) || 0;
  const freezeFrameTime = roundTimelineTime(Number.isFinite(Number(clipRef.clip.freezeFrameTime))
    ? Number(clipRef.clip.freezeFrameTime)
    : sourceStart + leftDuration * playbackRate);
  const rightStartTime = roundTimelineTime(splitTime + freezeDuration);
  const leftSourceDuration = getSplitSourceDuration(clipRef.clip, leftDuration);

  const freezeClip: TimelineMediaClip = {
    ...clipRef.clip,
    id: createTimelineId(),
    name: clipRef.clip.name ? `${clipRef.clip.name} freeze` : 'Freeze frame',
    startTime: splitTime,
    duration: freezeDuration,
    sourceStart: freezeFrameTime,
    sourceDuration: undefined,
    muted: true,
    sourceAudioEnabled: false,
    freezeFrameTime,
    linkGroupId: undefined,
  };
  const rightClip: TimelineMediaClip = {
    ...clipRef.clip,
    id: createTimelineId(),
    startTime: rightStartTime,
    duration: rightDuration,
    sourceStart: freezeFrameTime,
    sourceDuration: getRemainingSourceDuration(clipRef.clip, leftSourceDuration),
    freezeFrameTime: undefined,
  };

  const nextTimeline = withSortedTracks({
    ...ensuredTimeline,
    tracks: ensuredTimeline.tracks.map((track) => {
      if (track.id !== clipRef.track.id) return track;
      const nextClips = track.clips.flatMap((clip) => {
        if (clip.id === clipRef.clip.id) {
          return [
            { ...clipRef.clip, duration: leftDuration, sourceDuration: leftSourceDuration, freezeFrameTime: undefined } as TimelineClip,
            freezeClip,
            rightClip,
          ];
        }
        if (clip.startTime >= splitTime) {
          return [{ ...clip, startTime: roundTimelineTime(clip.startTime + freezeDuration) } as TimelineClip];
        }
        return [clip];
      });
      return { ...track, clips: nextClips };
    }),
  }, { pruneEmptyTracks: true });

  return { timeline: nextTimeline, clip: freezeClip };
};

export const moveTimelineClip = ({
  timeline,
  clipId,
  startTime,
  trackId,
  forceNewTrack = false,
  newTrackInsertIndex,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  startTime: number;
  trackId?: string | null;
  forceNewTrack?: boolean;
  newTrackInsertIndex?: number | null;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const sourceTrack = ensuredTimeline.tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
  const sourceClip = sourceTrack?.clips.find((clip) => clip.id === clipId);
  if (!sourceTrack || !sourceClip) return unchangedTimeline;

  const safeStart = Math.max(0, roundTimelineTime(startTime));
  const movedClip = { ...sourceClip, startTime: safeStart };
  const placement = resolveClipPlacement({
    timeline: ensuredTimeline,
    clip: movedClip,
    preferredTrackId: trackId || sourceTrack.id,
    startTime: safeStart,
    excludeClipId: clipId,
    forceNewTrack,
    newTrackInsertIndex,
  });
  if (placement.trackId === sourceTrack.id && safeStart === sourceClip.startTime) return unchangedTimeline;

  const tracks = placement.tracks.map((track) => {
    const withoutClip = track.clips.filter((clip) => clip.id !== clipId);
    if (track.id !== placement.trackId) return { ...track, clips: withoutClip };
    return { ...track, clips: [...withoutClip, movedClip] };
  });

  return withSortedTracks({ ...ensuredTimeline, tracks }, { pruneEmptyTracks: true });
};

export const moveTimelineClipsByDelta = ({
  timeline,
  clipIds,
  deltaTime,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  deltaTime: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const clipIdSet = new Set(clipIds);
  if (clipIdSet.size === 0 || !Number.isFinite(deltaTime)) return unchangedTimeline;

  const items = ensuredTimeline.tracks.flatMap((track) => (
    track.locked
      ? []
      : track.clips
          .filter((clip) => clipIdSet.has(clip.id))
          .map((clip) => ({ clip, trackId: track.id }))
  ));
  if (items.length === 0) return unchangedTimeline;

  const minStartTime = Math.min(...items.map((item) => item.clip.startTime));
  const safeDelta = roundTimelineTime(Math.max(-minStartTime, deltaTime));
  if (safeDelta === 0) return unchangedTimeline;

  const strippedTimeline = {
    ...ensuredTimeline,
    tracks: ensuredTimeline.tracks.map((track) => (
      track.locked
        ? track
        : { ...track, clips: track.clips.filter((clip) => !clipIdSet.has(clip.id)) }
    )),
  };

  let nextTimeline = strippedTimeline;
  for (const item of items) {
    nextTimeline = insertTimelineClip({
      timeline: nextTimeline,
      trackId: item.trackId,
      clip: {
        ...item.clip,
        startTime: roundTimelineTime(item.clip.startTime + safeDelta),
      } as TimelineClip,
    });
  }

  return withSortedTracks(nextTimeline, { pruneEmptyTracks: true });
};

export const moveLinkedTimelineClipsByDelta = ({
  timeline,
  clipIds,
  deltaTime,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  deltaTime: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const linkedClipIds = getLinkedTimelineClipIds({ timeline: ensuredTimeline, clipIds });
  return moveTimelineClipsByDelta({ timeline: ensuredTimeline, clipIds: linkedClipIds, deltaTime });
};

const createAdditionalTrack = (tracks: TimelineTrack[], type: TimelineTrack['type']) => {
  const baseTrackId = getDefaultTrackIdForType(type);
  let nextIndex = tracks.filter((track) => track.type === type).length + 1;
  let nextTrackId = `${baseTrackId}-${nextIndex}`;
  while (tracks.some((track) => track.id === nextTrackId)) {
    nextIndex += 1;
    nextTrackId = `${baseTrackId}-${nextIndex}`;
  }
  return {
    ...createEmptyTimelineTrack(type, nextTrackId),
    name: `${getDefaultTrackName(type)} ${nextIndex}`,
  };
};

const ensureTrackAtTypeIndex = (tracks: TimelineTrack[], type: TimelineTrack['type'], typeIndex: number) => {
  const nextTracks = [...tracks];
  while (nextTracks.filter((track) => track.type === type).length <= typeIndex) {
    nextTracks.push(createAdditionalTrack(nextTracks, type));
  }
  return nextTracks;
};

export const moveTimelineClipGroup = ({
  timeline,
  clipIds,
  anchorClipId,
  startTime,
  trackId,
  forceNewTrack = false,
  newTrackInsertIndex,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  anchorClipId: string;
  startTime: number;
  trackId?: string | null;
  forceNewTrack?: boolean;
  newTrackInsertIndex?: number | null;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const uniqueClipIds = Array.from(new Set(clipIds));
  const anchorRef = findTimelineClip(ensuredTimeline, anchorClipId);
  if (!anchorRef || anchorRef.track.locked) return unchangedTimeline;

  const items = ensuredTimeline.tracks.flatMap((track) => (
    track.locked
      ? []
      : track.clips
          .filter((clip) => uniqueClipIds.includes(clip.id))
          .map((clip) => ({ clip, track }))
  ));
  if (items.length === 0) return unchangedTimeline;

  const minStartTime = Math.min(...items.map((item) => item.clip.startTime));
  const safeDelta = roundTimelineTime(Math.max(-minStartTime, startTime - anchorRef.clip.startTime));
  const sameTrackType = items.every((item) => item.track.type === anchorRef.track.type);
  const targetTrack = trackId ? ensuredTimeline.tracks.find((track) => track.id === trackId) : null;

  if (forceNewTrack) {
    let nextTimeline = {
      ...ensuredTimeline,
      tracks: ensuredTimeline.tracks.map((track) => (
        track.locked
          ? track
          : { ...track, clips: track.clips.filter((clip) => !uniqueClipIds.includes(clip.id)) }
      )),
    };
    const destinationTrackBySource = new Map<string, string>();
    let nextNewTrackInsertIndex = newTrackInsertIndex;

    for (const item of items) {
      const movedClip = {
        ...item.clip,
        startTime: roundTimelineTime(item.clip.startTime + safeDelta),
      } as TimelineClip;
      const destinationTrackId = destinationTrackBySource.get(item.track.id);
      nextTimeline = insertTimelineClip({
        timeline: nextTimeline,
        clip: movedClip,
        trackId: destinationTrackId,
        forceNewTrack: !destinationTrackId,
        newTrackInsertIndex: destinationTrackId ? undefined : nextNewTrackInsertIndex,
      });
      const movedClipRef = findTimelineClip(nextTimeline, item.clip.id);
      if (movedClipRef) {
        if (!destinationTrackBySource.has(item.track.id)) {
          nextNewTrackInsertIndex = nextTimeline.tracks.findIndex((track) => track.id === movedClipRef.track.id) + 1;
        }
        destinationTrackBySource.set(item.track.id, movedClipRef.track.id);
      }
    }

    return withSortedTracks(nextTimeline, { pruneEmptyTracks: true });
  }

  if (!sameTrackType || !targetTrack || targetTrack.locked || targetTrack.type !== anchorRef.track.type) {
    const movedTimeline = moveTimelineClipsByDelta({ timeline: ensuredTimeline, clipIds: uniqueClipIds, deltaTime: safeDelta });
    return movedTimeline === ensuredTimeline ? unchangedTimeline : movedTimeline;
  }

  const typeTracks = ensuredTimeline.tracks.filter((track) => track.type === anchorRef.track.type);
  const anchorTypeIndex = typeTracks.findIndex((track) => track.id === anchorRef.track.id);
  const targetTypeIndex = typeTracks.findIndex((track) => track.id === targetTrack.id);
  if (anchorTypeIndex < 0 || targetTypeIndex < 0) {
    const movedTimeline = moveTimelineClipsByDelta({ timeline: ensuredTimeline, clipIds: uniqueClipIds, deltaTime: safeDelta });
    return movedTimeline === ensuredTimeline ? unchangedTimeline : movedTimeline;
  }

  const trackIndexDelta = targetTypeIndex - anchorTypeIndex;
  if (safeDelta === 0 && trackIndexDelta === 0) return unchangedTimeline;
  let nextTracks = ensuredTimeline.tracks.map((track) => (
    track.locked
      ? track
      : { ...track, clips: track.clips.filter((clip) => !uniqueClipIds.includes(clip.id)) }
  ));

  for (const item of items) {
    const itemTypeTracks = ensuredTimeline.tracks.filter((track) => track.type === item.track.type);
    const sourceTypeIndex = itemTypeTracks.findIndex((track) => track.id === item.track.id);
    const nextTypeIndex = Math.max(0, sourceTypeIndex + trackIndexDelta);
    nextTracks = ensureTrackAtTypeIndex(nextTracks, item.track.type, nextTypeIndex);
    const destinationTrack = nextTracks.filter((track) => track.type === item.track.type)[nextTypeIndex];
    if (!destinationTrack) continue;

    const nextTimeline = insertTimelineClip({
      timeline: { ...ensuredTimeline, tracks: nextTracks },
      trackId: destinationTrack.id,
      clip: {
        ...item.clip,
        startTime: roundTimelineTime(item.clip.startTime + safeDelta),
      } as TimelineClip,
    });
    nextTracks = nextTimeline.tracks;
  }

  return withSortedTracks({ ...ensuredTimeline, tracks: nextTracks }, { pruneEmptyTracks: true });
};

export const selectTimelineClipIdsInRange = ({
  timeline,
  startTime,
  endTime,
  trackIds,
  includeLockedTracks = false,
}: {
  timeline?: NodeTimeline | null;
  startTime: number;
  endTime: number;
  trackIds?: string[];
  includeLockedTracks?: boolean;
}): string[] => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const minTime = Math.min(startTime, endTime);
  const maxTime = Math.max(startTime, endTime);
  const trackIdSet = trackIds ? new Set(trackIds) : null;

  return ensuredTimeline.tracks.flatMap((track) => {
    if (!includeLockedTracks && track.locked) return [];
    if (trackIdSet && !trackIdSet.has(track.id)) return [];

    return track.clips
      .filter((clip) => clip.startTime < maxTime && getClipEndTime(clip) > minTime)
      .map((clip) => clip.id);
  });
};

export const trimTimelineClip = ({
  timeline,
  clipId,
  side,
  time,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  side: 'left' | 'right';
  time: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  let didChange = false;
  const nextTimeline = updateTimelineClip({
    timeline: ensuredTimeline,
    clipId,
    update: (clip) => {
      if (side === 'left') {
        const endTime = getClipEndTime(clip);
        const nextStart = clampTimelineTime(Math.min(time, endTime - MIN_TIMELINE_CLIP_DURATION), ensuredTimeline.duration);
        const delta = roundTimelineTime(nextStart - clip.startTime);
        const nextDuration = roundTimelineTime(endTime - nextStart);
        const nextSourceStart = getAdjustedSourceStart(clip, delta);
        const nextSourceDuration = getAdjustedSourceDuration(clip, -delta);
        if (nextStart === clip.startTime && nextDuration === clip.duration && nextSourceStart === clip.sourceStart && nextSourceDuration === clip.sourceDuration) return clip;
        didChange = true;
        return {
          ...clip,
          startTime: nextStart,
          duration: nextDuration,
          sourceStart: nextSourceStart,
          sourceDuration: nextSourceDuration,
        };
      }

      const nextEnd = Math.max(clip.startTime + MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(time));
      const nextDuration = roundTimelineTime(nextEnd - clip.startTime);
      const nextSourceDuration = getAdjustedSourceDuration(clip, roundTimelineTime(nextDuration - clip.duration));
      if (nextDuration === clip.duration && nextSourceDuration === clip.sourceDuration) return clip;
      didChange = true;
      return {
        ...clip,
        duration: nextDuration,
        sourceDuration: nextSourceDuration,
      };
    },
  });
  return didChange ? nextTimeline : unchangedTimeline;
};

export const trimTimelineClipWithRipple = ({
  timeline,
  clipId,
  side,
  time,
}: {
  timeline?: NodeTimeline | null;
  clipId: string;
  side: 'left' | 'right';
  time: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const clipRef = findTimelineClip(ensuredTimeline, clipId);
  if (!clipRef || clipRef.track.locked) return unchangedTimeline;

  const previousEndTime = getClipEndTime(clipRef.clip);
  const nextTimeline = trimTimelineClip({ timeline: ensuredTimeline, clipId, side, time });
  if (nextTimeline === unchangedTimeline || nextTimeline === ensuredTimeline) return unchangedTimeline;
  const nextClipRef = findTimelineClip(nextTimeline, clipId);
  if (!nextClipRef) return nextTimeline;

  const nextEndTime = getClipEndTime(nextClipRef.clip);
  const delta = roundTimelineTime(nextEndTime - previousEndTime);
  if (delta === 0) return nextTimeline;

  return withSortedTracks({
    ...nextTimeline,
    tracks: nextTimeline.tracks.map((track) => {
      if (track.locked || track.id !== clipRef.track.id) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === clipId || clip.startTime < previousEndTime) return clip;
          return { ...clip, startTime: roundTimelineTime(Math.max(0, clip.startTime + delta)) } as TimelineClip;
        }),
      };
    }),
  });
};

export const trimTimelineClipGroup = ({
  timeline,
  clipIds,
  anchorClipId,
  side,
  time,
}: {
  timeline?: NodeTimeline | null;
  clipIds: string[];
  anchorClipId: string;
  side: 'left' | 'right';
  time: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const anchorRef = findTimelineClip(ensuredTimeline, anchorClipId);
  if (!anchorRef || anchorRef.track.locked) return unchangedTimeline;

  const requestedClipIds = new Set(clipIds.length > 0 ? clipIds : [anchorClipId]);
  requestedClipIds.add(anchorClipId);
  const items = ensuredTimeline.tracks.flatMap((track) => (
    track.locked
      ? []
      : track.clips
          .filter((clip) => requestedClipIds.has(clip.id))
          .map((clip) => ({ clip, trackId: track.id }))
  ));
  if (items.length === 0) return unchangedTimeline;

  const anchorEdgeTime = side === 'left' ? anchorRef.clip.startTime : getClipEndTime(anchorRef.clip);
  const requestedDelta = roundTimelineTime(time - anchorEdgeTime);
  let minDelta = Number.NEGATIVE_INFINITY;
  let maxDelta = Number.POSITIVE_INFINITY;

  for (const { clip } of items) {
    if (side === 'left') {
      minDelta = Math.max(minDelta, -clip.startTime);
      maxDelta = Math.min(maxDelta, clip.duration - MIN_TIMELINE_CLIP_DURATION);
    } else {
      minDelta = Math.max(minDelta, MIN_TIMELINE_CLIP_DURATION - clip.duration);
    }
  }

  const delta = roundTimelineTime(Math.max(minDelta, Math.min(maxDelta, requestedDelta)));
  if (delta === 0) return unchangedTimeline;

  const editableClipIdSet = new Set(items.map((item) => item.clip.id));
  return withSortedTracks({
    ...ensuredTimeline,
    tracks: ensuredTimeline.tracks.map((track) => {
      if (track.locked) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (!editableClipIdSet.has(clip.id)) return clip;

          if (side === 'left') {
            const endTime = getClipEndTime(clip);
            const nextStartTime = roundTimelineTime(Math.max(0, Math.min(clip.startTime + delta, endTime - MIN_TIMELINE_CLIP_DURATION)));
            const sourceDelta = roundTimelineTime(nextStartTime - clip.startTime);
            return {
              ...clip,
              startTime: nextStartTime,
              duration: roundTimelineTime(endTime - nextStartTime),
              sourceStart: getAdjustedSourceStart(clip, sourceDelta),
              sourceDuration: getAdjustedSourceDuration(clip, -sourceDelta),
            } as TimelineClip;
          }

          const nextEndTime = roundTimelineTime(Math.max(clip.startTime + MIN_TIMELINE_CLIP_DURATION, getClipEndTime(clip) + delta));
          return {
            ...clip,
            duration: roundTimelineTime(nextEndTime - clip.startTime),
            sourceDuration: getAdjustedSourceDuration(clip, roundTimelineTime(nextEndTime - getClipEndTime(clip))),
          } as TimelineClip;
        }),
      };
    }),
  });
};

export const updateTimelineTrack = ({
  timeline,
  trackId,
  patch,
}: {
  timeline?: NodeTimeline | null;
  trackId: string;
  patch: Partial<Pick<TimelineTrack, 'hidden' | 'locked' | 'muted' | 'name' | 'collapsed'>>;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  return mapTracks(ensuredTimeline, (track) => {
    if (track.id !== trackId) return track;
    const nextPatch = { ...patch };
    if ('muted' in nextPatch && !canTimelineTrackHaveAudio(track)) delete nextPatch.muted;
    if ('hidden' in nextPatch && !canTimelineTrackBeHidden(track)) delete nextPatch.hidden;
    return { ...track, ...nextPatch };
  });
};

export const deleteTimelineTrack = ({
  timeline,
  trackId,
}: {
  timeline?: NodeTimeline | null;
  trackId: string;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const unchangedTimeline = getUnchangedTimeline(timeline, ensuredTimeline);
  const track = ensuredTimeline.tracks.find((item) => item.id === trackId);
  if (!track || !canDeleteTimelineTrack(track)) return unchangedTimeline;

  return withSortedTracks({
    ...ensuredTimeline,
    tracks: ensuredTimeline.tracks.filter((item) => item.id !== trackId),
  });
};

export const addTimelineTrack = ({
  timeline,
  type,
  afterTrackId,
}: {
  timeline?: NodeTimeline | null;
  type: TimelineTrack['type'];
  afterTrackId?: string | null;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const sameTypeCount = ensuredTimeline.tracks.filter((track) => track.type === type).length;
  const baseTrackId = getDefaultTrackIdForType(type);
  let nextIndex = sameTypeCount + 1;
  let nextTrackId = `${baseTrackId}-${nextIndex}`;
  while (ensuredTimeline.tracks.some((track) => track.id === nextTrackId)) {
    nextIndex += 1;
    nextTrackId = `${baseTrackId}-${nextIndex}`;
  }

  const nextTrack = {
    ...createEmptyTimelineTrack(type, nextTrackId, type === 'media' ? { mediaRole: 'overlay' } : undefined),
    name: type === 'media'
      ? `${getDefaultMediaTrackName('overlay')}${nextIndex > 1 ? ` ${nextIndex}` : ''}`
      : sameTypeCount === 0 ? getDefaultTrackName(type) : `${getDefaultTrackName(type)} ${nextIndex}`,
  };
  const explicitIndex = afterTrackId ? ensuredTimeline.tracks.findIndex((track) => track.id === afterTrackId) : -1;
  const lastSameTypeIndex = ensuredTimeline.tracks.reduce((index, track, currentIndex) => (track.type === type ? currentIndex : index), -1);
  const insertIndex = explicitIndex >= 0 ? explicitIndex + 1 : lastSameTypeIndex >= 0 ? lastSameTypeIndex + 1 : ensuredTimeline.tracks.length;
  const tracks = [...ensuredTimeline.tracks];
  tracks.splice(insertIndex, 0, nextTrack);

  return withSortedTracks({
    ...ensuredTimeline,
    tracks,
  });
};

export const reorderTimelineTrack = ({
  timeline,
  trackId,
  targetIndex,
}: {
  timeline?: NodeTimeline | null;
  trackId: string;
  targetIndex: number;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const currentIndex = ensuredTimeline.tracks.findIndex((track) => track.id === trackId);
  if (currentIndex < 0) return ensuredTimeline;

  const nextIndex = Math.max(0, Math.min(ensuredTimeline.tracks.length - 1, Math.round(targetIndex)));
  if (nextIndex === currentIndex) return ensuredTimeline;

  const tracks = [...ensuredTimeline.tracks];
  const [track] = tracks.splice(currentIndex, 1);
  tracks.splice(nextIndex, 0, track);

  return withSortedTracks({
    ...ensuredTimeline,
    tracks,
  });
};

export const findTimelineClip = (timeline: NodeTimeline | undefined | null, clipId: string | null) => {
  if (!clipId) return null;
  const ensuredTimeline = ensureNodeTimeline(timeline);
  for (const track of ensuredTimeline.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
};

export const setTimelinePlayhead = (timeline: NodeTimeline | undefined | null, playheadTime: number): NodeTimeline => {
  if (
    timeline?.version === 2 &&
    Number.isFinite(Number(timeline.duration)) &&
    timeline.playheadTime !== undefined
  ) {
    const existingNextPlayheadTime = clampTimelineTime(playheadTime, Number(timeline.duration));
    if (Math.abs(timeline.playheadTime - existingNextPlayheadTime) <= 0.001) return timeline;
  }

  const ensuredTimeline = ensureNodeTimeline(timeline);
  const nextPlayheadTime = clampTimelineTime(playheadTime, ensuredTimeline.duration);
  if (ensuredTimeline.playheadTime !== undefined && Math.abs(ensuredTimeline.playheadTime - nextPlayheadTime) <= 0.001) return ensuredTimeline;
  return {
    ...ensuredTimeline,
    playheadTime: nextPlayheadTime,
  };
};

export const setTimelineZoom = (timeline: NodeTimeline | undefined | null, zoom: number): NodeTimeline => {
  if (timeline?.version === 2 && timeline.zoom !== undefined) {
    const existingNextZoom = clampTimelineZoom(zoom);
    if (Math.abs(timeline.zoom - existingNextZoom) <= 0.001) return timeline;
  }

  const ensuredTimeline = ensureNodeTimeline(timeline);
  const nextZoom = clampTimelineZoom(zoom);
  if (ensuredTimeline.zoom !== undefined && Math.abs(ensuredTimeline.zoom - nextZoom) <= 0.001) return ensuredTimeline;
  return {
    ...ensuredTimeline,
    zoom: nextZoom,
  };
};

export const canClipLiveOnTrack = (clip: TimelineClip, track: TimelineTrack) => {
  if (getClipTrackType(clip) !== track.type) return false;
  if (track.type !== 'media') return true;
  const clipRole = getClipMediaTrackRole(clip);
  const trackRole = getTrackMediaRole(track);
  if (clipRole === 'audio') return trackRole === 'audio';
  return trackRole !== 'audio';
};

export const findTimelineBookmarkAtTime = (timeline: NodeTimeline | undefined | null, time: number) => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const safeTime = roundTimelineTime(time);
  return ensuredTimeline.bookmarks.find((bookmark) => Math.abs(bookmark.time - safeTime) <= BOOKMARK_TIME_EPSILON) ?? null;
};

export const toggleTimelineBookmark = ({
  timeline,
  time,
  label,
}: {
  timeline?: NodeTimeline | null;
  time: number;
  label?: string;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  const safeTime = clampTimelineTime(time, ensuredTimeline.duration);
  const existingBookmark = findTimelineBookmarkAtTime(ensuredTimeline, safeTime);

  if (existingBookmark) {
    return {
      ...ensuredTimeline,
      bookmarks: ensuredTimeline.bookmarks.filter((bookmark) => bookmark.id !== existingBookmark.id),
    };
  }

  return {
    ...ensuredTimeline,
    bookmarks: [
      ...ensuredTimeline.bookmarks,
      {
        id: createTimelineId(),
        time: safeTime,
        label,
      },
    ].sort((first, second) => first.time - second.time),
  };
};

export const updateTimelineBookmark = ({
  timeline,
  bookmarkId,
  patch,
}: {
  timeline?: NodeTimeline | null;
  bookmarkId: string;
  patch: Partial<Pick<NodeTimeline['bookmarks'][number], 'time' | 'label' | 'color'>>;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  return {
    ...ensuredTimeline,
    bookmarks: ensuredTimeline.bookmarks
      .map((bookmark) => (
        bookmark.id === bookmarkId
          ? {
              ...bookmark,
              ...patch,
              time: patch.time !== undefined ? clampTimelineTime(patch.time, ensuredTimeline.duration) : bookmark.time,
            }
          : bookmark
      ))
      .sort((first, second) => first.time - second.time),
  };
};

export const deleteTimelineBookmark = ({
  timeline,
  bookmarkId,
}: {
  timeline?: NodeTimeline | null;
  bookmarkId: string;
}): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline);
  return {
    ...ensuredTimeline,
    bookmarks: ensuredTimeline.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
  };
};
