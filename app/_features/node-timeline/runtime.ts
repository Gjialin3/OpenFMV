import { AppNode, NodeTimeline, TimelineInteractionClip, TimelineMediaClip } from '@/app/_types';

import {
  ensureNodeTimeline,
  isTimelineClipActive,
  isVisualMediaClip,
} from './schema';

export interface CompiledNodeTimeline {
  nodeId?: string;
  timeline: NodeTimeline;
  duration: number;
  mediaClips: TimelineMediaClip[];
  visualMediaClips: TimelineMediaClip[];
  interactionClips: TimelineInteractionClip[];
  primaryMediaClip: TimelineMediaClip | null;
}

const sortByTime = <TClip extends { startTime: number; duration: number }>(clips: TClip[]) => {
  return [...clips].sort((first, second) => first.startTime - second.startTime || second.duration - first.duration);
};

export const compileNodeTimeline = (nodeOrTimeline?: AppNode | NodeTimeline | null): CompiledNodeTimeline => {
  const node = nodeOrTimeline && 'data' in nodeOrTimeline ? nodeOrTimeline : null;
  const sourceTimeline = node ? node.data.timeline : nodeOrTimeline as NodeTimeline | null | undefined;
  const timeline = ensureNodeTimeline(sourceTimeline);
  const visibleTracks = timeline.tracks.filter((track) => !track.hidden);
  const mediaClips = sortByTime(
    visibleTracks
      .filter((track) => track.type === 'media')
      .flatMap((track) => track.clips.map((clip) => (
        clip.type === 'video' || clip.type === 'audio'
          ? { ...clip, muted: track.muted === true || clip.muted === true || (clip.type === 'video' && clip.sourceAudioEnabled === false) }
          : clip
      )))
      .filter((clip): clip is TimelineMediaClip => clip.type === 'video' || clip.type === 'image' || clip.type === 'audio')
      .filter((clip) => clip.enabled && !clip.hidden)
  );
  const visualMediaClips = mediaClips.filter(isVisualMediaClip);
  const interactionClips = sortByTime(
    visibleTracks
      .filter((track) => track.type === 'interaction')
      .flatMap((track) => track.clips)
      .filter((clip): clip is TimelineInteractionClip => clip.type === 'button')
      .filter((clip) => clip.enabled && !clip.hidden)
  );

  return {
    nodeId: node?.id,
    timeline,
    duration: timeline.duration,
    mediaClips,
    visualMediaClips,
    interactionClips,
    primaryMediaClip: visualMediaClips[0] ?? mediaClips[0] ?? null,
  };
};

export const getActiveTimelineInteractionClips = (node: AppNode, time: number): TimelineInteractionClip[] => {
  return compileNodeTimeline(node).interactionClips.filter((clip) => isTimelineClipActive(clip, time));
};

export const getActiveTimelineMediaClips = (node: AppNode, time: number): TimelineMediaClip[] => {
  return compileNodeTimeline(node).mediaClips.filter((clip) => isTimelineClipActive(clip, time));
};
