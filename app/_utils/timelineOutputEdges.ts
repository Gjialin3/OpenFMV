import type { Connection } from '@xyflow/react';

import { AppEdge, AppNode, TimelineInteractionClip } from '../_types';
import { addGraphEdge } from './graphRules';

export const NODE_DEFAULT_OUTPUT_ID = 'node:default';

const BUTTON_OUTPUT_PREFIX = 'button:';

export type NodeOutputKind = 'default' | 'buttonClick' | 'buttonTimeout';

export interface NodeOutput {
  id: string;
  label: string;
  kind: NodeOutputKind;
  clipId?: string;
}

export type TimelineOutputKind = 'click' | 'timeout';

export const getTimelineClipOutputHandleId = (clipId: string, kind: TimelineOutputKind = 'click') => (
  kind === 'timeout'
    ? `${BUTTON_OUTPUT_PREFIX}${clipId}:timeout`
    : `${BUTTON_OUTPUT_PREFIX}${clipId}:click`
);

export const getButtonClickOutputId = (clipId: string) => getTimelineClipOutputHandleId(clipId, 'click');

export const getButtonTimeoutOutputId = (clipId: string) => getTimelineClipOutputHandleId(clipId, 'timeout');

const getButtonLabel = (clip: TimelineInteractionClip) => {
  const label = (clip.label || clip.name || '').trim();
  return label || 'Button';
};

const isEnabledButtonClip = (clip: unknown): clip is TimelineInteractionClip => {
  const value = clip as Partial<TimelineInteractionClip> | null | undefined;
  return value?.type === 'button' && value.enabled !== false && value.hidden !== true;
};

const shouldExposeTimeoutOutput = (clip: TimelineInteractionClip) => {
  return clip.mode === 'qte';
};

export const getNodeOutputs = (node: AppNode): NodeOutput[] => {
  const outputs: NodeOutput[] = node.type === 'end'
    ? []
    : [{ id: NODE_DEFAULT_OUTPUT_ID, label: 'Default', kind: 'default' }];

  node.data.timeline?.tracks?.forEach((track) => {
    if (track.hidden || track.type !== 'interaction') return;
    track.clips.forEach((clip) => {
      if (!isEnabledButtonClip(clip)) return;
      const label = getButtonLabel(clip);
      outputs.push({
        id: getButtonClickOutputId(clip.id),
        label: `${label} success`,
        kind: 'buttonClick',
        clipId: clip.id,
      });
      if (shouldExposeTimeoutOutput(clip)) {
        outputs.push({
          id: getButtonTimeoutOutputId(clip.id),
          label: `${label} fail`,
          kind: 'buttonTimeout',
          clipId: clip.id,
        });
      }
    });
  });

  return outputs;
};

export const getNodeOutputIds = (node: AppNode) => new Set(getNodeOutputs(node).map((output) => output.id));

export const isValidNodeOutputHandle = (node: AppNode | undefined, sourceHandle?: string | null) => {
  if (!node || !sourceHandle) return false;
  return getNodeOutputIds(node).has(sourceHandle);
};

export const pruneEdgesForNodeOutputs = (nodes: AppNode[], edges: AppEdge[]) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => {
    if (edge.source === edge.target) return false;
    if (!nodesById.has(edge.target)) return false;
    const sourceNode = nodesById.get(edge.source);
    return isValidNodeOutputHandle(sourceNode, edge.sourceHandle);
  });
};

export const resolveOutputTargetNodeId = (node: AppNode | null | undefined, edges: AppEdge[], outputId: string) => {
  if (!node) return null;
  return edges.find((edge) => edge.source === node.id && edge.sourceHandle === outputId)?.target ?? null;
};

export const removeTimelineOutputEdge = (edges: AppEdge[], source: string, sourceHandle: string) => (
  edges.filter((edge) => !(edge.source === source && (edge.sourceHandle ?? null) === sourceHandle))
);

export const upsertTimelineOutputEdge = (connection: Connection, edges: AppEdge[], nodes: AppNode[]) => {
  if (!connection.source || !connection.sourceHandle || !connection.target) return edges;
  if (!isValidNodeOutputHandle(nodes.find((node) => node.id === connection.source), connection.sourceHandle)) return edges;
  const withoutExisting = removeTimelineOutputEdge(edges, connection.source, connection.sourceHandle);
  return addGraphEdge(connection, withoutExisting, nodes);
};

export const syncTimelineOutputEdges = pruneEdgesForNodeOutputs;
