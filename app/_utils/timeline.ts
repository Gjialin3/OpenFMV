import { NodeTimeline, OverlayRect, TimelineAction, TimelineClip, TimelineClipType } from '../_types';

export const INTERACTION_TRACK_ID = 'interaction-track';
export const DEFAULT_TIMELINE_DURATION = 24;
export const DEFAULT_CLIP_DURATION = 4;

export const createTimelineId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const roundTimelineTime = (value: number, precision = 0.1) => {
  if (!Number.isFinite(value)) return 0;
  return Number((Math.round(value / precision) * precision).toFixed(2));
};

export const clampTimelineTime = (value: number, duration = DEFAULT_TIMELINE_DURATION) => {
  if (!Number.isFinite(value)) return 0;
  return roundTimelineTime(Math.max(0, Math.min(duration, value)), 0.01);
};

export const clampOverlayRect = (rect: OverlayRect): OverlayRect => {
  const width = Math.max(0.06, Math.min(1, rect.width));
  const height = Math.max(0.06, Math.min(1, rect.height));
  return {
    x: Math.max(0, Math.min(1 - width, rect.x)),
    y: Math.max(0, Math.min(1 - height, rect.y)),
    width,
    height,
  };
};

export const getDefaultOverlayRect = (type: TimelineClipType): OverlayRect => {
  if (type === 'hotspot') return { x: 0.4, y: 0.38, width: 0.2, height: 0.16 };
  if (type === 'pauseGate') return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
  return { x: 0.39, y: 0.72, width: 0.22, height: 0.1 };
};

export const getTimelineDuration = (timeline?: NodeTimeline, fallback = DEFAULT_TIMELINE_DURATION) => {
  const duration = Number(timeline?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : fallback;
};

export const ensureNodeTimeline = (timeline?: NodeTimeline, duration = DEFAULT_TIMELINE_DURATION): NodeTimeline => {
  const tracks = Array.isArray(timeline?.tracks) ? timeline.tracks : [];
  const hasInteractionTrack = tracks.some((track) => track.id === INTERACTION_TRACK_ID);

  return {
    version: 1,
    duration: getTimelineDuration(timeline, duration),
    tracks: hasInteractionTrack
      ? tracks
      : [
          ...tracks,
          {
            id: INTERACTION_TRACK_ID,
            type: 'interaction',
            name: '交互轨道',
            clips: [],
          },
        ],
  };
};

export const getTimelineClips = (timeline?: NodeTimeline): TimelineClip[] => {
  if (!timeline?.tracks) return [];
  return timeline.tracks.flatMap((track) => (Array.isArray(track.clips) ? track.clips : []));
};

export const writeTimelineClips = (timeline: NodeTimeline | undefined, clips: TimelineClip[], duration = DEFAULT_TIMELINE_DURATION): NodeTimeline => {
  const ensuredTimeline = ensureNodeTimeline(timeline, duration);
  return {
    ...ensuredTimeline,
    duration: getTimelineDuration(ensuredTimeline, duration),
    tracks: ensuredTimeline.tracks.map((track) => (
      track.id === INTERACTION_TRACK_ID
        ? { ...track, clips }
        : track
    )),
  };
};

export const isTimelineClipActive = (clip: TimelineClip, time: number) => {
  if (!clip.enabled) return false;
  const endTime = clip.endTime ?? clip.startTime + 0.1;
  return time >= clip.startTime && time <= endTime;
};

export const getTimelineClipLabel = (clip: TimelineClip) => {
  if (clip.type === 'hotspot') return clip.hint || clip.name || 'Hotspot';
  return clip.label || clip.name || clip.type;
};

export const createTimelineClip = (
  type: TimelineClipType,
  startTime: number,
  duration: number,
  rect?: OverlayRect
): TimelineClip => {
  const safeStart = clampTimelineTime(startTime, duration);
  const endTime = clampTimelineTime(Math.min(duration, safeStart + DEFAULT_CLIP_DURATION), duration);
  const safeEnd = endTime > safeStart ? endTime : roundTimelineTime(safeStart + 0.1, 0.01);
  const safeRect = clampOverlayRect(rect || getDefaultOverlayRect(type));
  const action: TimelineAction = { type: 'continue' };

  if (type === 'hotspot') {
    return {
      id: createTimelineId(),
      type,
      name: '热点区域',
      startTime: safeStart,
      endTime: safeEnd,
      rect: safeRect,
      hint: 'Hotspot',
      showHint: true,
      action,
      pauseOnShow: false,
      enabled: true,
    };
  }

  if (type === 'pauseGate') {
    return {
      id: createTimelineId(),
      type,
      name: '暂停等待',
      label: 'Continue',
      startTime: safeStart,
      endTime: safeEnd,
      rect: safeRect,
      action,
      resumeOnClick: true,
      enabled: true,
    };
  }

  return {
    id: createTimelineId(),
    type,
    name: '选择按钮',
    label: 'New choice',
    startTime: safeStart,
    endTime: safeEnd,
    rect: safeRect,
    action,
    pauseOnShow: true,
    enabled: true,
  };
};
