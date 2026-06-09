import type { Connection } from '@xyflow/react';

import { AppEdge, AppNode, NodeTimeline, TimelineAction, TimelineClip, TimelineInteractionClip } from '../_types';
import { addGraphEdge } from './graphRules';

const TIMELINE_OUTPUT_HANDLE_PREFIX = 'timeline-output:';
const TIMELINE_TIMEOUT_HANDLE_SUFFIX = ':timeout';

type TimelineOutputKind = 'action' | 'timeout';
type TimelineOutputClip = Extract<TimelineInteractionClip, { type: 'button' }>;

interface TimelineOutputHandle {
  clipId: string;
  kind: TimelineOutputKind;
}

export const getTimelineClipOutputHandleId = (clipId: string, kind: TimelineOutputKind = 'action') => (
  kind === 'timeout'
    ? `${TIMELINE_OUTPUT_HANDLE_PREFIX}${clipId}${TIMELINE_TIMEOUT_HANDLE_SUFFIX}`
    : `${TIMELINE_OUTPUT_HANDLE_PREFIX}${clipId}`
);

export const parseTimelineOutputHandleId = (handleId?: string | null): TimelineOutputHandle | null => {
  if (!handleId?.startsWith(TIMELINE_OUTPUT_HANDLE_PREFIX)) return null;
  const rawClipId = handleId.slice(TIMELINE_OUTPUT_HANDLE_PREFIX.length);
  if (!rawClipId) return null;
  if (rawClipId.endsWith(TIMELINE_TIMEOUT_HANDLE_SUFFIX)) {
    const clipId = rawClipId.slice(0, -TIMELINE_TIMEOUT_HANDLE_SUFFIX.length);
    return clipId ? { clipId, kind: 'timeout' } : null;
  }
  return { clipId: rawClipId, kind: 'action' };
};

export const isTimelineOutputHandleId = (handleId?: string | null) => Boolean(parseTimelineOutputHandleId(handleId));

const isTimelineOutputClip = (clip: TimelineClip): clip is TimelineOutputClip => (
  clip.type === 'button'
);

const getClipAction = (clip: TimelineOutputClip, kind: TimelineOutputKind): TimelineAction | undefined => {
  if (kind === 'timeout') return clip.timeoutAction;
  return clip.action;
};

const areTimelineActionsEqual = (first: TimelineAction | undefined, second: TimelineAction | undefined) => (
  (first?.type ?? 'continue') === (second?.type ?? 'continue')
    && (first?.handleId ?? null) === (second?.handleId ?? null)
    && (first?.nodeId ?? null) === (second?.nodeId ?? null)
);

const setClipAction = (clip: TimelineClip, handle: TimelineOutputHandle, action: TimelineAction): TimelineClip => {
  if (clip.id !== handle.clipId || !isTimelineOutputClip(clip)) return clip;
  if (areTimelineActionsEqual(getClipAction(clip, handle.kind), action)) return clip;
  if (handle.kind === 'timeout') return clip.type === 'button' ? { ...clip, timeoutAction: action } : clip;
  return { ...clip, action };
};

const updateTimelineOutputAction = (timeline: NodeTimeline | undefined, handle: TimelineOutputHandle, action: TimelineAction) => {
  if (!timeline?.tracks) return timeline;
  let didChange = false;
  const tracks = timeline.tracks.map((track) => {
    let trackChanged = false;
    const clips = track.clips.map((clip) => {
      const nextClip = setClipAction(clip, handle, action);
      if (nextClip !== clip) trackChanged = true;
      return nextClip;
    });
    if (!trackChanged) return track;
    didChange = true;
    return { ...track, clips };
  });
  return didChange ? { ...timeline, tracks } : timeline;
};

const updateTimelineOutputActionForSource = (nodes: AppNode[], source: string, sourceHandle: string, action: TimelineAction): AppNode[] => {
  const handle = parseTimelineOutputHandleId(sourceHandle);
  if (!handle) return nodes;
  let didChange = false;
  const nextNodes = nodes.map((node) => {
    if (node.id !== source) return node;
    const timeline = updateTimelineOutputAction(node.data.timeline, handle, action);
    if (timeline === node.data.timeline) return node;
    didChange = true;
    return { ...node, data: { ...node.data, timeline } as AppNode['data'] };
  });
  return didChange ? nextNodes : nodes;
};

export const updateTimelineOutputActionForConnection = (nodes: AppNode[], connection: Connection): AppNode[] => {
  if (!connection.source || !connection.sourceHandle || !connection.target) return nodes;
  return updateTimelineOutputActionForSource(nodes, connection.source, connection.sourceHandle, { type: 'goToNode', nodeId: connection.target });
};

export const updateTimelineOutputActionsForEdges = (nodes: AppNode[], previousEdges: AppEdge[], nextEdges: AppEdge[]): AppNode[] => {
  const nextEdgeKeys = new Set(nextEdges.map((edge) => `${edge.source}:${edge.sourceHandle ?? ''}`));
  const mutations: Array<{ source: string; sourceHandle: string; action: TimelineAction }> = [];

  previousEdges.forEach((edge) => {
    const sourceHandle = edge.sourceHandle;
    if (!sourceHandle || !isTimelineOutputHandleId(sourceHandle)) return;
    const key = `${edge.source}:${sourceHandle}`;
    if (nextEdgeKeys.has(key)) return;
    mutations.push({
      source: edge.source,
      sourceHandle,
      action: { type: 'continue' },
    });
  });

  nextEdges.forEach((edge) => {
    const sourceHandle = edge.sourceHandle;
    if (!sourceHandle || !isTimelineOutputHandleId(sourceHandle) || !edge.target) return;
    mutations.push({
      source: edge.source,
      sourceHandle,
      action: { type: 'goToNode', nodeId: edge.target },
    });
  });

  if (mutations.length === 0) return nodes;

  let nextNodes = nodes;
  mutations.forEach((mutation) => {
    nextNodes = updateTimelineOutputActionForSource(nextNodes, mutation.source, mutation.sourceHandle, mutation.action);
  });

  return nextNodes;
};

export const removeTimelineOutputEdge = (edges: AppEdge[], source: string, sourceHandle: string) => (
  edges.filter((edge) => !(edge.source === source && (edge.sourceHandle ?? null) === sourceHandle))
);

export const upsertTimelineOutputEdge = (connection: Connection, edges: AppEdge[], nodes: AppNode[]) => {
  if (!connection.source || !connection.sourceHandle || !connection.target || !isTimelineOutputHandleId(connection.sourceHandle)) return edges;
  const withoutExisting = removeTimelineOutputEdge(edges, connection.source, connection.sourceHandle);
  return addGraphEdge(connection, withoutExisting, nodes);
};

const areEdgesEquivalent = (first: AppEdge[], second: AppEdge[]) => (
  first.length === second.length && first.every((edge, index) => {
    const other = second[index];
    return edge.id === other.id
      && edge.source === other.source
      && edge.target === other.target
      && (edge.sourceHandle ?? null) === (other.sourceHandle ?? null)
      && (edge.targetHandle ?? null) === (other.targetHandle ?? null);
  })
);

export const syncTimelineOutputEdges = (nodes: AppNode[], edges: AppEdge[]): AppEdge[] => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const desiredConnections: Connection[] = [];

  nodes.forEach((node) => {
    node.data.timeline?.tracks?.forEach((track) => {
      if (track.hidden || track.type !== 'interaction') return;
      track.clips.forEach((clip) => {
        if (!clip.enabled || clip.hidden || !isTimelineOutputClip(clip)) return;
        (['action', 'timeout'] as const).forEach((kind) => {
          const sourceHandle = getTimelineClipOutputHandleId(clip.id, kind);
          const action = getClipAction(clip, kind);
          if (action?.type !== 'goToNode' || !action.nodeId || !nodeIds.has(action.nodeId)) return;
          desiredConnections.push({
            source: node.id,
            sourceHandle,
            target: action.nodeId,
            targetHandle: null,
          });
        });
      });
    });
  });

  const desiredByHandle = new Map(desiredConnections.map((connection) => [`${connection.source}:${connection.sourceHandle ?? ''}`, connection]));
  const satisfiedDesiredHandles = new Set<string>();
  let nextEdges = edges.filter((edge) => {
    if (!isTimelineOutputHandleId(edge.sourceHandle)) return true;
    const key = `${edge.source}:${edge.sourceHandle ?? ''}`;
    const desiredConnection = desiredByHandle.get(key);
    if (!desiredConnection) return false;
    if (edge.target !== desiredConnection.target || (edge.targetHandle ?? null) !== (desiredConnection.targetHandle ?? null)) return false;
    satisfiedDesiredHandles.add(key);
    return true;
  });

  desiredConnections.forEach((connection) => {
    if (satisfiedDesiredHandles.has(`${connection.source}:${connection.sourceHandle ?? ''}`)) return;
    nextEdges = upsertTimelineOutputEdge(connection, nextEdges, nodes);
  });

  return areEdgesEquivalent(edges, nextEdges) ? edges : nextEdges;
};
