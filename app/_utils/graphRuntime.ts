import { AppEdge, AppNode, InteractionMode, InteractionRule, NodeType, OpenFMVGraph, TimelineAction, TimelineClip } from '../_types';
import {
  buildNodeEffects as buildCoreNodeEffects,
  compileRuntimeGraph as compileCoreRuntimeGraph,
  createRuntime as createCoreRuntime,
  createRuntimeState as createCoreRuntimeState,
  dispatchRuntimeEvent as dispatchCoreRuntimeEvent,
  getEntryNodeId as getCoreEntryNodeId,
  getRuntimeSnapshot as getCoreRuntimeSnapshot,
  getNodeById as getCoreNodeById,
  getNodeText as getCoreNodeText,
  getNodeTitle as getCoreNodeTitle,
  getOutgoingEdges as getCoreOutgoingEdges,
  getActiveTimelineClips as getCoreActiveTimelineClips,
  getRuntimeChoiceRules as getCoreRuntimeChoiceRules,
  getRuntimeInteractionMode as getCoreRuntimeInteractionMode,
  getTimelineClips as getCoreTimelineClips,
  getVisibleRules as getCoreVisibleRules,
  resolveNextNodeId as resolveCoreNextNodeId,
  resolveTimelineActionNodeId as resolveCoreTimelineActionNodeId,
  shouldShowRuntimeControls as shouldCoreShowRuntimeControls,
} from './graphRuntimeCore.mjs';

export interface RuntimeChoice {
  input?: string;
  handleId?: string | null;
}

export type RuntimeStatus = 'running' | 'ended';

export interface RuntimeProgram {
  graph: OpenFMVGraph;
  entryNodeId: string | null;
}

export interface RuntimeState {
  status: RuntimeStatus;
  currentNodeId: string | null;
  history: string[];
  variables: Record<string, unknown>;
}

export type RuntimeEvent =
  | { type: 'runtime.start' }
  | { type: 'restart' }
  | { type: 'continue' }
  | { type: 'timer.timeout' }
  | { type: 'choice.selected'; input?: string; handleId?: string | null }
  | { type: 'input.submitted'; value: string }
  | { type: 'slider.unlocked'; input?: string; handleId?: string | null }
  | { type: 'timeline.clip.triggered'; clipId: string; action?: TimelineAction }
  | { type: 'timeline.clip.timeout'; clipId: string; action?: TimelineAction }
  | { type: 'navigate'; nodeId: string | null }
  | { type: 'variable.set'; key: string; value: unknown };

export type RuntimeEffect =
  | { type: 'scene'; nodeId: string; nodeType: NodeType; title: string; text: string }
  | { type: 'playMedia'; mediaType: 'video'; src: string; playbackId?: string; poster?: string }
  | { type: 'playMedia'; mediaType: 'image'; src: string }
  | { type: 'timelineOverlay'; nodeId: string; clips: TimelineClip[] }
  | { type: 'showChoices'; prompt: string; choices: Array<{ id: string; label: string; input: string; handleId: string; rule: InteractionRule }> }
  | { type: 'showInput'; prompt: string; placeholder: string }
  | { type: 'showSlider'; prompt: string; label: string; handleId: string }
  | { type: 'showContinue'; label: string }
  | { type: 'showRestart' }
  | { type: 'startTimer'; seconds: number; key: string }
  | { type: 'end' };

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  currentNodeId: string | null;
  currentNode: AppNode | null;
  history: string[];
  variables: Record<string, unknown>;
  effects: RuntimeEffect[];
}

export interface RuntimeController {
  program: RuntimeProgram;
  start: () => RuntimeSnapshot;
  dispatch: (event: RuntimeEvent) => RuntimeSnapshot;
  getSnapshot: () => RuntimeSnapshot;
}

export const getEntryNodeId = (graph: OpenFMVGraph, preferredEntryNodeId?: string | null): string | null => {
  return getCoreEntryNodeId(graph, preferredEntryNodeId);
};

export const getNodeText = (node: AppNode): string => getCoreNodeText(node);

export const getNodeTitle = (node: AppNode): string => getCoreNodeTitle(node);

export const getVisibleRules = (node: AppNode): InteractionRule[] => getCoreVisibleRules(node);

export const getOutgoingEdges = (nodeId: string, edges: AppEdge[]): AppEdge[] => getCoreOutgoingEdges(nodeId, edges);

export const resolveNextNodeId = (node: AppNode, edges: AppEdge[], choice: RuntimeChoice = {}): string | null => {
  return resolveCoreNextNodeId(node, edges, choice);
};

export const getNodeById = (nodes: AppNode[], nodeId: string | null | undefined): AppNode | null => {
  return getCoreNodeById(nodes, nodeId);
};

export const getRuntimeInteractionMode = (node: AppNode): InteractionMode => getCoreRuntimeInteractionMode(node);

export const shouldShowRuntimeControls = (node: AppNode | null | undefined, edges: AppEdge[]): boolean => {
  return shouldCoreShowRuntimeControls(node, edges);
};

export const getRuntimeChoiceRules = (node: AppNode): InteractionRule[] => getCoreRuntimeChoiceRules(node);

export const getTimelineClips = (node: AppNode): TimelineClip[] => getCoreTimelineClips(node) as TimelineClip[];

export const getActiveTimelineClips = (node: AppNode, time: number): TimelineClip[] => getCoreActiveTimelineClips(node, time) as TimelineClip[];

export const resolveTimelineActionNodeId = (node: AppNode, edges: AppEdge[], action: TimelineAction): string | null => {
  return resolveCoreTimelineActionNodeId(node, edges, action);
};

export const compileRuntimeGraph = (graph: OpenFMVGraph, options: { entryNodeId?: string | null } = {}): RuntimeProgram => {
  return compileCoreRuntimeGraph(graph, options) as RuntimeProgram;
};

export const createRuntimeState = (program: RuntimeProgram, seed: Partial<RuntimeState> = {}): RuntimeState => {
  return createCoreRuntimeState(program, seed) as RuntimeState;
};

export const buildNodeEffects = (node: AppNode | null | undefined, edges: AppEdge[]): RuntimeEffect[] => {
  return buildCoreNodeEffects(node, edges) as RuntimeEffect[];
};

export const getRuntimeSnapshot = (program: RuntimeProgram, state: RuntimeState): RuntimeSnapshot => {
  return getCoreRuntimeSnapshot(program, state) as RuntimeSnapshot;
};

export const dispatchRuntimeEvent = (program: RuntimeProgram, state: RuntimeState, event: RuntimeEvent): RuntimeState => {
  return dispatchCoreRuntimeEvent(program, state, event) as RuntimeState;
};

export const createRuntime = (graph: OpenFMVGraph, options: { entryNodeId?: string | null; initialState?: Partial<RuntimeState> } = {}): RuntimeController => {
  return createCoreRuntime(graph, options) as RuntimeController;
};
