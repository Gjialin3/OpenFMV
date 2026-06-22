import {
  NodeTimeline,
  OverlayRect,
  ButtonQteConfig,
  ButtonStyleConfig,
  TimelineBookmark,
  TimelineClip,
  TimelineClipKeyframe,
  TimelineClipType,
  TimelineInteractionClip,
  TimelineInteractionClipType,
  TimelineKeyframeInterpolation,
  TimelineKeyframeProperty,
  TimelineMediaClip,
  TimelineMediaClipType,
  TimelineTrack,
  TimelineTrackType,
} from '@/app/_types';

import { normalizeButtonStyleConfig } from './button-style';
import {
  DEFAULT_INTERACTION_CLIP_DURATION,
  DEFAULT_MEDIA_CLIP_DURATION,
  DEFAULT_NODE_TIMELINE_DURATION,
  INTERACTION_TRACK_ID,
  MEDIA_TRACK_ID,
  MIN_TIMELINE_CLIP_DURATION,
  NODE_TIMELINE_VERSION,
} from './constants';

type TimelineRecord = Partial<NodeTimeline> & { version?: number };
type ClipRecord = Record<string, unknown> & { type?: unknown; id?: unknown; endTime?: unknown };
type BookmarkRecord = Record<string, unknown>;

export const createTimelineId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const roundTimelineTime = (value: number, precision = 0.01) => {
  if (!Number.isFinite(value)) return 0;
  return Number((Math.round(value / precision) * precision).toFixed(3));
};

export const clampTimelineTime = (value: number, duration = DEFAULT_NODE_TIMELINE_DURATION) => {
  if (!Number.isFinite(value)) return 0;
  return roundTimelineTime(Math.max(0, Math.min(duration, value)));
};

export const isMediaClipType = (type: unknown): type is TimelineMediaClipType => {
  return type === 'video' || type === 'image' || type === 'audio';
};

export const isInteractionClipType = (type: unknown): type is TimelineInteractionClipType => {
  return type === 'button';
};

export const getClipTrackType = (clip: Pick<TimelineClip, 'type'>): TimelineTrackType => {
  if (isMediaClipType(clip.type)) return 'media';
  return 'interaction';
};

export const getDefaultTrackIdForType = (type: TimelineTrackType) => {
  if (type === 'interaction') return INTERACTION_TRACK_ID;
  return MEDIA_TRACK_ID;
};

export const getDefaultTrackName = (type: TimelineTrackType) => {
  if (type === 'interaction') return 'Interaction';
  return 'Media';
};

export const getDefaultMediaTrackName = (mediaRole?: TimelineTrack['mediaRole']) => {
  if (mediaRole === 'audio') return 'Audio';
  if (mediaRole === 'overlay') return 'Overlay';
  return 'Media';
};

export const getClipMediaTrackRole = (clip: Pick<TimelineClip, 'type'>): TimelineTrack['mediaRole'] => {
  return clip.type === 'audio' ? 'audio' : 'overlay';
};

export const getTrackMediaRole = (track: Partial<TimelineTrack>): TimelineTrack['mediaRole'] => {
  if (track.type !== 'media') return undefined;
  if (track.mediaRole === 'main' || track.mediaRole === 'overlay' || track.mediaRole === 'audio') return track.mediaRole;
  if (track.id === MEDIA_TRACK_ID) return 'main';

  const clips = Array.isArray(track.clips) ? track.clips : [];
  if (clips.length > 0 && clips.every((clip) => (clip as { type?: unknown }).type === 'audio')) return 'audio';
  return 'overlay';
};

export const getTimelineDuration = (timeline?: Partial<NodeTimeline> | null, fallback = DEFAULT_NODE_TIMELINE_DURATION) => {
  const duration = Number(timeline?.duration);
  return Number.isFinite(duration) && duration > 0 ? roundTimelineTime(duration) : fallback;
};

export const getClipDuration = (clip: ClipRecord) => {
  const duration = Number(clip.duration);
  if (Number.isFinite(duration) && duration > 0) return Math.max(MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(duration));
  const startTime = Number(clip.startTime) || 0;
  const endTime = Number(clip.endTime);
  if (Number.isFinite(endTime) && endTime > startTime) return Math.max(MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(endTime - startTime));
  return isMediaClipType(clip.type) ? DEFAULT_MEDIA_CLIP_DURATION : DEFAULT_INTERACTION_CLIP_DURATION;
};

export const getClipEndTime = (clip: Pick<TimelineClip, 'startTime' | 'duration'> & { endTime?: number }) => {
  const startTime = Number(clip.startTime) || 0;
  const duration = Number(clip.duration);
  if (Number.isFinite(duration) && duration > 0) return roundTimelineTime(startTime + duration);
  const endTime = Number(clip.endTime);
  if (Number.isFinite(endTime) && endTime > startTime) return roundTimelineTime(endTime);
  return roundTimelineTime(startTime + MIN_TIMELINE_CLIP_DURATION);
};

export const clampOverlayRect = (rect: OverlayRect): OverlayRect => {
  const width = Math.max(0.04, Math.min(1, Number(rect.width) || 0.2));
  const height = Math.max(0.04, Math.min(1, Number(rect.height) || 0.12));
  return {
    x: Math.max(0, Math.min(1 - width, Number(rect.x) || 0)),
    y: Math.max(0, Math.min(1 - height, Number(rect.y) || 0)),
    width,
    height,
  };
};

export const clampTimelineClipOpacity = (opacity: unknown) => {
  const value = Number(opacity);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
};

export const clampTimelineClipRotation = (rotation: unknown) => {
  const value = Number(rotation);
  return Number.isFinite(value) ? value : 0;
};

export const isTimelineKeyframeProperty = (property: unknown): property is TimelineKeyframeProperty => (
  property === 'opacity' ||
  property === 'rotation' ||
  property === 'x' ||
  property === 'y' ||
  property === 'width' ||
  property === 'height' ||
  property === 'volume'
);

export const isTimelineKeyframeInterpolation = (interpolation: unknown): interpolation is TimelineKeyframeInterpolation => (
  interpolation === 'linear' || interpolation === 'hold'
);

export const clampTimelineKeyframeValue = (property: TimelineKeyframeProperty, value: unknown) => {
  if (property === 'opacity') return clampTimelineClipOpacity(value);
  if (property === 'rotation') return clampTimelineClipRotation(value);
  if (property === 'volume') {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? Math.max(0, Math.min(2, nextValue)) : 1;
  }

  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return property === 'width' || property === 'height' ? 0.1 : 0;
  if (property === 'width' || property === 'height') return Math.max(0.01, Math.min(1, nextValue));
  return Math.max(0, Math.min(1, nextValue));
};

const normalizeTimelineClipKeyframes = (clip: ClipRecord, duration: number): TimelineClipKeyframe[] => {
  if (!Array.isArray(clip.keyframes)) return [];
  return clip.keyframes
    .map((keyframe): TimelineClipKeyframe | null => {
      const source = keyframe as Record<string, unknown>;
      if (!isTimelineKeyframeProperty(source.property)) return null;
      const time = Number(source.time);
      if (!Number.isFinite(time)) return null;
      const interpolation = isTimelineKeyframeInterpolation(source.interpolation)
        ? source.interpolation
        : isTimelineKeyframeInterpolation(source.segmentToNext)
          ? source.segmentToNext
          : undefined;
      return {
        id: typeof source.id === 'string' && source.id ? source.id : createTimelineId(),
        property: source.property,
        time: roundTimelineTime(Math.max(0, Math.min(duration, time))),
        value: clampTimelineKeyframeValue(source.property, source.value),
        interpolation,
      };
    })
    .filter((keyframe): keyframe is TimelineClipKeyframe => Boolean(keyframe))
    .sort((first, second) => first.time - second.time || first.property.localeCompare(second.property));
};

export const clampTimelineMediaPlaybackRate = (playbackRate: unknown) => {
  const value = Number(playbackRate);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(0.01, Math.min(5, value));
};

export const getDefaultOverlayRect = (type: TimelineInteractionClipType): OverlayRect => {
  return { x: 0.39, y: 0.72, width: 0.22, height: 0.1 };
};

export const getButtonMode = (clip: Pick<TimelineInteractionClip, 'mode'> | null | undefined) => (
  clip?.mode === 'qte' ? 'qte' : 'normal'
);

export const isQteButtonClip = (clip: Pick<TimelineInteractionClip, 'mode'> | null | undefined) => (
  getButtonMode(clip) === 'qte'
);

const normalizeButtonQteConfig = (value: unknown): ButtonQteConfig => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const input = source.input === 'space' ? 'space' : 'click';
  const prompt = typeof source.prompt === 'string' && source.prompt.trim() ? source.prompt : undefined;
  const clickCount = Number.isFinite(Number(source.clickCount)) ? Math.max(1, Math.min(20, Math.round(Number(source.clickCount)))) : 1;
  const keyLabel = typeof source.keyLabel === 'string' && source.keyLabel.trim()
    ? input === 'space' && source.keyLabel === 'Click' ? 'Space' : source.keyLabel
    : input === 'space' ? 'Space' : 'Click';
  return {
    input,
    ...(prompt ? { prompt } : {}),
    clickCount,
    keyLabel,
    showCountdown: source.showCountdown !== false,
    showCueLabel: source.showCueLabel !== false,
  };
};

const normalizeButtonStyle = (value: unknown, mode?: 'normal' | 'qte'): ButtonStyleConfig | undefined => {
  return normalizeButtonStyleConfig(value, mode);
};

export const createEmptyTimelineTrack = (
  type: TimelineTrackType,
  id = getDefaultTrackIdForType(type),
  options: { mediaRole?: TimelineTrack['mediaRole']; name?: string } = {}
): TimelineTrack => ({
  id,
  type,
  name: options.name || (type === 'media' ? getDefaultMediaTrackName(options.mediaRole || (id === MEDIA_TRACK_ID ? 'main' : 'overlay')) : getDefaultTrackName(type)),
  mediaRole: type === 'media' ? options.mediaRole || (id === MEDIA_TRACK_ID ? 'main' : 'overlay') : undefined,
  clips: [],
});

export const createEmptyNodeTimeline = (duration = DEFAULT_NODE_TIMELINE_DURATION): NodeTimeline => ({
  version: NODE_TIMELINE_VERSION,
  duration,
  tracks: [
    createEmptyTimelineTrack('media'),
    createEmptyTimelineTrack('interaction'),
  ],
  bookmarks: [],
});

const normalizeBaseClip = <TClip extends ClipRecord>(clip: TClip) => {
  const startTime = Math.max(0, roundTimelineTime(Number(clip.startTime) || 0));
  const duration = getClipDuration(clip);
  const keyframes = normalizeTimelineClipKeyframes(clip, duration);
  return {
    id: typeof clip.id === 'string' && clip.id ? clip.id : createTimelineId(),
    startTime,
    duration,
    sourceStart: Number.isFinite(Number(clip.sourceStart)) ? Math.max(0, roundTimelineTime(Number(clip.sourceStart))) : undefined,
    sourceDuration: Number.isFinite(Number(clip.sourceDuration)) ? Math.max(0, roundTimelineTime(Number(clip.sourceDuration))) : undefined,
    name: typeof clip.name === 'string' ? clip.name : undefined,
    enabled: clip.enabled !== false,
    hidden: clip.hidden === true,
    opacity: clampTimelineClipOpacity(clip.opacity),
    rotation: clampTimelineClipRotation(clip.rotation),
    linkGroupId: typeof clip.linkGroupId === 'string' && clip.linkGroupId ? clip.linkGroupId : undefined,
    keyframes: keyframes.length > 0 ? keyframes : undefined,
  };
};

const normalizeMediaClip = (clip: ClipRecord): TimelineMediaClip | null => {
  if (!isMediaClipType(clip.type) || typeof clip.src !== 'string' || !clip.src) return null;
  return {
    ...normalizeBaseClip(clip),
    type: clip.type,
    src: clip.src,
    assetId: typeof clip.assetId === 'string' ? clip.assetId : undefined,
    poster: typeof clip.poster === 'string' ? clip.poster : undefined,
    playbackId: typeof clip.playbackId === 'string' ? clip.playbackId : undefined,
    muted: clip.type === 'video' || clip.type === 'audio' ? clip.muted === true : undefined,
    volume: Number.isFinite(Number(clip.volume)) ? Math.max(0, Math.min(2, Number(clip.volume))) : undefined,
    playbackRate: clip.type === 'video' || clip.type === 'audio' ? clampTimelineMediaPlaybackRate(clip.playbackRate) : undefined,
    preservePitch: clip.type === 'video' || clip.type === 'audio' ? clip.preservePitch !== false : undefined,
    freezeFrameTime: clip.type === 'video' && Number.isFinite(Number(clip.freezeFrameTime)) ? Math.max(0, roundTimelineTime(Number(clip.freezeFrameTime))) : undefined,
    fit: clip.fit === 'cover' ? 'cover' : 'contain',
    rect: clip.rect ? clampOverlayRect(clip.rect as OverlayRect) : undefined,
    sourceAudioEnabled: clip.type === 'video' && clip.sourceAudioEnabled === false ? false : undefined,
    sourceVideoClipId: clip.type === 'audio' && typeof clip.sourceVideoClipId === 'string' && clip.sourceVideoClipId ? clip.sourceVideoClipId : undefined,
  };
};

const normalizeInteractionClip = (clip: ClipRecord): TimelineInteractionClip | null => {
  if (!isInteractionClipType(clip.type)) return null;
  const base = normalizeBaseClip(clip);
  const label = typeof clip.label === 'string' ? clip.label : 'Choice';
  const mode = clip.mode === 'qte' ? 'qte' : undefined;
  const style = normalizeButtonStyle(clip.style, mode === 'qte' ? 'qte' : 'normal');

  return {
    ...base,
    type: 'button',
    ...(mode ? { mode } : {}),
    label,
    rect: clampOverlayRect((clip.rect as OverlayRect | undefined) || getDefaultOverlayRect('button')),
    pauseOnShow: clip.pauseOnShow === true,
    ...(mode === 'qte' ? { qte: normalizeButtonQteConfig(clip.qte) } : {}),
    ...(style ? { style } : {}),
  };
};

export const normalizeTimelineClip = (clip: ClipRecord): TimelineClip | null => {
  return normalizeMediaClip(clip) || normalizeInteractionClip(clip);
};

const normalizeTimelineTrack = (track: Partial<TimelineTrack>, fallbackType: TimelineTrackType): TimelineTrack => {
  const rawType = (track as { type?: unknown }).type;
  const type = rawType === 'media' || rawType === 'interaction' ? rawType : fallbackType;
  const mediaRole = getTrackMediaRole({ ...track, type });
  return {
    id: typeof track.id === 'string' && track.id ? track.id : getDefaultTrackIdForType(type),
    type,
    name: typeof track.name === 'string' && track.name ? track.name : type === 'media' ? getDefaultMediaTrackName(mediaRole) : getDefaultTrackName(type),
    mediaRole: type === 'media' ? mediaRole : undefined,
    locked: track.locked === true,
    hidden: track.hidden === true,
    muted: track.muted === true,
    collapsed: track.collapsed === true,
    clips: (Array.isArray(track.clips) ? track.clips : [])
      .map((clip) => normalizeTimelineClip(clip as unknown as ClipRecord))
      .filter((clip): clip is TimelineClip => Boolean(clip))
      .filter((clip) => getClipTrackType(clip) === type)
      .sort((first, second) => first.startTime - second.startTime),
  };
};

const normalizeTimelineBookmark = (bookmark: BookmarkRecord, timelineDuration: number): TimelineBookmark | null => {
  const time = Number(bookmark.time);
  if (!Number.isFinite(time)) return null;
  return {
    id: typeof bookmark.id === 'string' && bookmark.id ? bookmark.id : createTimelineId(),
    time: clampTimelineTime(time, timelineDuration),
    label: typeof bookmark.label === 'string' ? bookmark.label : undefined,
    color: typeof bookmark.color === 'string' ? bookmark.color : undefined,
  };
};

export const ensureNodeTimeline = (timeline?: TimelineRecord | null, duration = DEFAULT_NODE_TIMELINE_DURATION): NodeTimeline => {
  const fallback = createEmptyNodeTimeline(duration);
  const sourceTracks = Array.isArray(timeline?.tracks) ? timeline.tracks : [];
  const tracks = sourceTracks.map((track) => {
    const rawType = (track as { type?: unknown }).type;
    const legacyType: TimelineTrackType = rawType === 'interaction' ? 'interaction' : 'media';
    return normalizeTimelineTrack(track as Partial<TimelineTrack>, legacyType);
  });
  const withDefaults = tracks.length > 0 ? tracks : fallback.tracks;

  const timelineDuration = Math.max(getTimelineDuration(timeline, duration), ...withDefaults.flatMap((track) => track.clips.map(getClipEndTime)), DEFAULT_INTERACTION_CLIP_DURATION);

  return {
    version: NODE_TIMELINE_VERSION,
    duration: roundTimelineTime(timelineDuration),
    tracks: withDefaults,
    bookmarks: (Array.isArray(timeline?.bookmarks) ? timeline.bookmarks : [])
      .map((bookmark) => normalizeTimelineBookmark(bookmark as unknown as BookmarkRecord, timelineDuration))
      .filter((bookmark): bookmark is TimelineBookmark => Boolean(bookmark))
      .sort((first, second) => first.time - second.time),
    playheadTime: Number.isFinite(Number(timeline?.playheadTime)) ? clampTimelineTime(Number(timeline?.playheadTime), timelineDuration) : undefined,
    zoom: Number.isFinite(Number(timeline?.zoom)) ? Number(timeline?.zoom) : undefined,
  };
};

export const getTimelineTracksByType = (timeline: NodeTimeline | undefined, type: TimelineTrackType) => {
  return ensureNodeTimeline(timeline).tracks.filter((track) => track.type === type);
};

export const getTimelineClips = (timeline?: NodeTimeline | null): TimelineClip[] => {
  return ensureNodeTimeline(timeline).tracks.flatMap((track) => track.clips);
};

export const getMediaTimelineClips = (timeline?: NodeTimeline | null): TimelineMediaClip[] => {
  return getTimelineClips(timeline).filter((clip): clip is TimelineMediaClip => isMediaClipType(clip.type));
};

export const getInteractionTimelineClips = (timeline?: NodeTimeline | null): TimelineInteractionClip[] => {
  return getTimelineClips(timeline).filter((clip): clip is TimelineInteractionClip => isInteractionClipType(clip.type));
};

export const isTimelineClipActive = (clip: TimelineClip, time: number) => {
  if (!clip.enabled || clip.hidden) return false;
  const normalizedTime = Number(time) || 0;
  return normalizedTime >= clip.startTime && normalizedTime < getClipEndTime(clip);
};

export const getTimelineClipLocalTime = (clip: Pick<TimelineClip, 'startTime' | 'duration'>, timelineTime: number) => {
  return roundTimelineTime(Math.max(0, Math.min(clip.duration, (Number(timelineTime) || 0) - clip.startTime)));
};

export const getTimelineClipKeyframesForProperty = (clip: Pick<TimelineClip, 'keyframes'>, property: TimelineKeyframeProperty) => {
  return [...(clip.keyframes || [])]
    .filter((keyframe) => keyframe.property === property)
    .sort((first, second) => first.time - second.time);
};

export const resolveTimelineKeyframedValue = ({
  clip,
  property,
  timelineTime,
  fallback,
}: {
  clip: Pick<TimelineClip, 'startTime' | 'duration' | 'keyframes'>;
  property: TimelineKeyframeProperty;
  timelineTime: number;
  fallback: number;
}) => {
  const keyframes = getTimelineClipKeyframesForProperty(clip, property);
  if (keyframes.length === 0) return fallback;

  const localTime = getTimelineClipLocalTime(clip, timelineTime);
  const previous = [...keyframes].reverse().find((keyframe) => keyframe.time <= localTime);
  const next = keyframes.find((keyframe) => keyframe.time >= localTime);
  if (!previous) return keyframes[0].value;
  if (!next) return keyframes[keyframes.length - 1].value;
  if (previous.id === next.id || previous.time === next.time) return previous.value;
  if (previous.interpolation === 'hold') return previous.value;

  const progress = (localTime - previous.time) / (next.time - previous.time);
  return clampTimelineKeyframeValue(property, previous.value + (next.value - previous.value) * progress);
};

export const resolveTimelineClipKeyframes = <TClip extends TimelineClip>(clip: TClip, timelineTime: number): TClip => {
  if (!clip.keyframes || clip.keyframes.length === 0) return clip;

  let nextClip = {
    ...clip,
    opacity: resolveTimelineKeyframedValue({
      clip,
      property: 'opacity',
      timelineTime,
      fallback: clampTimelineClipOpacity(clip.opacity),
    }),
    rotation: resolveTimelineKeyframedValue({
      clip,
      property: 'rotation',
      timelineTime,
      fallback: clampTimelineClipRotation(clip.rotation),
    }),
  } as TClip;

  if (nextClip.type === 'video' || nextClip.type === 'image' || nextClip.type === 'button') {
    const fallbackRect = nextClip.type === 'video' || nextClip.type === 'image' ? { x: 0, y: 0, width: 1, height: 1 } : getDefaultOverlayRect(nextClip.type);
    const rect = clampOverlayRect((nextClip.rect as OverlayRect | undefined) || fallbackRect);
    nextClip = {
      ...nextClip,
      rect: clampOverlayRect({
        x: resolveTimelineKeyframedValue({ clip, property: 'x', timelineTime, fallback: rect.x }),
        y: resolveTimelineKeyframedValue({ clip, property: 'y', timelineTime, fallback: rect.y }),
        width: resolveTimelineKeyframedValue({ clip, property: 'width', timelineTime, fallback: rect.width }),
        height: resolveTimelineKeyframedValue({ clip, property: 'height', timelineTime, fallback: rect.height }),
      }),
    } as TClip;
  }

  if (nextClip.type === 'video' || nextClip.type === 'audio') {
    nextClip = {
      ...nextClip,
      volume: resolveTimelineKeyframedValue({
        clip,
        property: 'volume',
        timelineTime,
        fallback: Number.isFinite(Number(nextClip.volume)) ? Math.max(0, Math.min(2, Number(nextClip.volume))) : 1,
      }),
    } as TClip;
  }

  return nextClip;
};

export const getTimelineQteDisplayName = (clip: Pick<TimelineInteractionClip, 'label' | 'name'>) => {
  const rawLabel = typeof clip.label === 'string'
    ? clip.label
    : typeof clip.name === 'string'
      ? clip.name
      : undefined;
  if (typeof rawLabel !== 'string') return 'QTE';

  const label = rawLabel.trim();
  if (!label) return '';
  return label === 'New choice' || label === 'Choice' ? 'QTE' : label;
};

export const getTimelineClipLabel = (clip: TimelineClip) => {
  if (clip.type === 'button') {
    if (isQteButtonClip(clip)) {
      const clickCount = Number.isFinite(Number(clip.qte?.clickCount)) ? Math.max(1, Math.round(Number(clip.qte?.clickCount))) : 1;
      const input = clip.qte?.input === 'space' ? clip.qte.keyLabel || 'Space' : clickCount > 1 ? `Click x${clickCount}` : 'Click';
      const name = getTimelineQteDisplayName(clip);
      return [name, input, `${roundTimelineTime(clip.duration).toFixed(2)}s`].filter(Boolean).join(' · ');
    }
    return typeof clip.label === 'string' ? clip.label : clip.name || 'Continue';
  }
  if (isMediaClipType(clip.type) && 'src' in clip) return clip.name || clip.src.split(/[\\/]/).pop() || clip.type;
  return clip.name || clip.type;
};

export const createInteractionClip = (type: TimelineInteractionClipType, startTime: number, timelineDuration: number): TimelineInteractionClip => {
  const safeStart = clampTimelineTime(startTime, timelineDuration);
  const duration = Math.min(DEFAULT_INTERACTION_CLIP_DURATION, Math.max(MIN_TIMELINE_CLIP_DURATION, timelineDuration - safeStart || DEFAULT_INTERACTION_CLIP_DURATION));

  return {
    id: createTimelineId(),
    type,
    name: 'Button',
    label: 'New choice',
    startTime: safeStart,
    duration,
    rect: getDefaultOverlayRect(type),
    pauseOnShow: false,
    enabled: true,
    opacity: 1,
    rotation: 0,
  };
};

export const createMediaClip = ({
  type,
  src,
  name,
  assetId,
  startTime,
  duration,
  sourceDuration,
  poster,
  playbackId,
}: {
  type: TimelineMediaClipType;
  src: string;
  name?: string;
  assetId?: string;
  startTime: number;
  duration?: number;
  sourceDuration?: number;
  poster?: string;
  playbackId?: string;
}): TimelineMediaClip => {
  const safeDuration = Math.max(MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(duration || DEFAULT_MEDIA_CLIP_DURATION));
  const safeSourceDuration = Number.isFinite(Number(sourceDuration)) && Number(sourceDuration) > 0
    ? Math.max(MIN_TIMELINE_CLIP_DURATION, roundTimelineTime(Number(sourceDuration)))
    : undefined;

  return {
    id: createTimelineId(),
    type,
    src,
    name: name || src.split(/[\\/]/).pop() || type,
    assetId,
    startTime: Math.max(0, roundTimelineTime(startTime)),
    duration: safeDuration,
    sourceStart: 0,
    sourceDuration: type === 'video' || type === 'audio' ? safeSourceDuration : undefined,
    enabled: true,
    opacity: 1,
    rotation: 0,
    fit: 'contain',
    volume: type === 'audio' ? 1 : undefined,
    playbackRate: type === 'video' || type === 'audio' ? 1 : undefined,
    preservePitch: type === 'video' || type === 'audio' ? true : undefined,
    poster,
    playbackId,
  };
};

export const isVisualMediaClip = (clip: TimelineMediaClip) => clip.type === 'video' || clip.type === 'image';
