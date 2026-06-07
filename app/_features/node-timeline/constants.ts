import type { TimelineClip, TimelineMediaClip, TimelineTrack } from '@/app/_types';

export const NODE_TIMELINE_VERSION = 2;
export const DEFAULT_NODE_TIMELINE_DURATION = 24;
export const DEFAULT_TIMELINE_ZOOM = 64;
export const MIN_TIMELINE_ZOOM = 28;
export const MAX_TIMELINE_ZOOM = 220;
export const DEFAULT_MEDIA_CLIP_DURATION = 6;
export const DEFAULT_INTERACTION_CLIP_DURATION = 4;
export const MIN_TIMELINE_CLIP_DURATION = 0.1;
export const TIMELINE_FRAME_STEP_SECONDS = 1 / 30;
export const TIMELINE_JUMP_STEP_SECONDS = 5;
export const TIMELINE_TRACK_GAP_PX = 6;
export const TIMELINE_CLIP_HEIGHT_PX = 40;
export const TIMELINE_COLLAPSED_CLIP_HEIGHT_PX = 26;
export const TIMELINE_COLLAPSED_TRACK_HEIGHT_PX = 32;
export const TIMELINE_EMPTY_MEDIA_BUTTON_HEIGHT_PX = 28;

export const MEDIA_TRACK_ID = 'media-track-main';
export const INTERACTION_TRACK_ID = 'interaction-track-main';
export const DEFAULT_TIMELINE_TRACK_IDS = [MEDIA_TRACK_ID, INTERACTION_TRACK_ID] as const;

export const isDefaultTimelineTrackId = (trackId: string) => {
  return (DEFAULT_TIMELINE_TRACK_IDS as readonly string[]).includes(trackId);
};

export const isMainTimelineTrackId = (trackId: string) => {
  return trackId === MEDIA_TRACK_ID;
};

export const canDeleteTimelineTrack = (track: TimelineTrack) => {
  return !isDefaultTimelineTrackId(track.id);
};

export const canTimelineTrackHaveAudio = (track: TimelineTrack) => {
  return track.type === 'media';
};

export const canTimelineTrackBeHidden = (_track: TimelineTrack) => {
  return true;
};

export const getNodeTimelineTrackHeight = (track: Pick<TimelineTrack, 'type' | 'collapsed'>) => {
  if (track.collapsed) return TIMELINE_COLLAPSED_TRACK_HEIGHT_PX;
  if (track.type === 'media') return 64;
  if (track.type === 'interaction') return 50;
  return 44;
};

export const canTimelineClipHaveAudio = (clip: TimelineClip): clip is TimelineMediaClip & { type: 'video' | 'audio' } => {
  return clip.type === 'video' || clip.type === 'audio';
};

export const canTimelineClipBeHidden = (_clip: TimelineClip) => {
  return true;
};
