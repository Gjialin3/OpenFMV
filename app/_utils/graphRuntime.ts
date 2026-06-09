import { AppEdge, AppNode, InteractionMode, InteractionRule, NodeType, OpenFMVGraph, OverlayRect, TimelineAction, TimelineClip, TimelineInteractionClip, TimelineMediaClip } from '../_types';
import {
  buildNodeEffects as buildCoreNodeEffects,
  compileNodeTimeline as compileCoreNodeTimeline,
  compileRuntimeGraph as compileCoreRuntimeGraph,
  createRuntime as createCoreRuntime,
  createRuntimeState as createCoreRuntimeState,
  dispatchRuntimeEvent as dispatchCoreRuntimeEvent,
  getActiveTimelineClips as getCoreActiveTimelineClips,
  getActiveTimelineMediaClips as getCoreActiveTimelineMediaClips,
  clampRuntimeTimelineTime as clampCoreRuntimeTimelineTime,
  getEntryNodeId as getCoreEntryNodeId,
  getRuntimeSnapshot as getCoreRuntimeSnapshot,
  getNodeById as getCoreNodeById,
  getNodeText as getCoreNodeText,
  getNodeTitle as getCoreNodeTitle,
  getOutgoingEdges as getCoreOutgoingEdges,
  getRuntimeChoiceRules as getCoreRuntimeChoiceRules,
  getRuntimeInteractionMode as getCoreRuntimeInteractionMode,
  getTimelineClipEndTime as getCoreTimelineClipEndTime,
  getTimelineClips as getCoreTimelineClips,
  getTimelineInteractionClips as getCoreTimelineInteractionClips,
  getTimelineMediaClips as getCoreTimelineMediaClips,
  getVisibleRules as getCoreVisibleRules,
  isTimelineClipActive as isCoreTimelineClipActive,
  resolveTimelineActionNodeId as resolveCoreTimelineActionNodeId,
  resolveTimelineClipKeyframes as resolveCoreTimelineClipKeyframes,
  resolveNextNodeId as resolveCoreNextNodeId,
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
  timelineTime: number;
}

export type RuntimeEvent =
  | { type: 'runtime.start' }
  | { type: 'restart' }
  | { type: 'continue' }
  | { type: 'timer.timeout' }
  | { type: 'choice.selected'; input?: string; handleId?: string | null }
  | { type: 'input.submitted'; value: string }
  | { type: 'slider.unlocked'; input?: string; handleId?: string | null }
  | { type: 'navigate'; nodeId: string | null }
  | { type: 'variable.set'; key: string; value: unknown }
  | { type: 'timeline.time.update'; time: number }
  | { type: 'timeline.clip.triggered'; clipId: string; action?: TimelineAction }
  | { type: 'timeline.clip.timeout'; clipId: string; action?: TimelineAction };

export type RuntimeEffect =
  | { type: 'scene'; nodeId: string; nodeType: NodeType; title: string; text: string }
  | { type: 'playMedia'; mediaType: 'video'; src: string; playbackId?: string; poster?: string; timelineStartTime?: number; sourceStart?: number; sourceDuration?: number; duration?: number; timelineDuration?: number; muted?: boolean; rect?: OverlayRect; fit?: 'contain' | 'cover'; opacity?: number; rotation?: number; playbackRate?: number; preservePitch?: boolean; freezeFrameTime?: number }
  | { type: 'playMedia'; mediaType: 'image'; src: string; timelineStartTime?: number; duration?: number; timelineDuration?: number; rect?: OverlayRect; fit?: 'contain' | 'cover'; opacity?: number; rotation?: number }
  | { type: 'playMedia'; mediaType: 'audio'; src: string; timelineStartTime?: number; sourceStart?: number; sourceDuration?: number; duration?: number; timelineDuration?: number; muted?: boolean; volume?: number; playbackRate?: number; preservePitch?: boolean }
  | { type: 'showChoices'; prompt: string; choices: Array<{ id: string; label: string; input: string; handleId: string; rule: InteractionRule }> }
  | { type: 'showInput'; prompt: string; placeholder: string }
  | { type: 'showSlider'; prompt: string; label: string; handleId: string }
  | { type: 'showContinue'; label: string }
  | { type: 'showRestart' }
  | { type: 'startTimer'; seconds: number; key: string }
  | { type: 'timelinePlayback'; nodeId: string; duration: number }
  | { type: 'timelineOverlay'; nodeId: string; clips: TimelineInteractionClip[]; duration?: number }
  | { type: 'end' };

export interface CompiledRuntimeNodeTimeline {
  nodeId?: string;
  duration: number;
  mediaClips: TimelineMediaClip[];
  visualMediaClips: TimelineMediaClip[];
  interactionClips: TimelineInteractionClip[];
  primaryMediaClip: TimelineMediaClip | null;
}

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  currentNodeId: string | null;
  currentNode: AppNode | null;
  history: string[];
  variables: Record<string, unknown>;
  timelineTime: number;
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

export const getTimelineMediaClips = (node: AppNode): TimelineMediaClip[] => getCoreTimelineMediaClips(node) as TimelineMediaClip[];

export const getTimelineInteractionClips = (node: AppNode): TimelineInteractionClip[] => getCoreTimelineInteractionClips(node) as TimelineInteractionClip[];

export const getTimelineClipEndTime = (clip: TimelineClip): number => getCoreTimelineClipEndTime(clip);

export const isTimelineClipActive = (clip: TimelineClip, time: number): boolean => isCoreTimelineClipActive(clip, time);

export const resolveTimelineClipKeyframes = <TClip extends TimelineClip>(clip: TClip, timelineTime: number): TClip => {
  return resolveCoreTimelineClipKeyframes(clip, timelineTime) as TClip;
};

export const getActiveTimelineClips = (node: AppNode, time: number): TimelineInteractionClip[] => getCoreActiveTimelineClips(node, time) as TimelineInteractionClip[];

export const getActiveTimelineMediaClips = (node: AppNode, time: number): TimelineMediaClip[] => getCoreActiveTimelineMediaClips(node, time) as TimelineMediaClip[];

export const clampRuntimeTimelineTime = (time: number, duration?: number): number => clampCoreRuntimeTimelineTime(time, duration);

export const compileNodeTimeline = (node: AppNode): CompiledRuntimeNodeTimeline => {
  return compileCoreNodeTimeline(node) as CompiledRuntimeNodeTimeline;
};

export const resolveTimelineActionNodeId = (node: AppNode, edges: AppEdge[], action?: TimelineAction): string | null => {
  return resolveCoreTimelineActionNodeId(node, edges, action);
};

export const compileRuntimeGraph = (graph: OpenFMVGraph, options: { entryNodeId?: string | null } = {}): RuntimeProgram => {
  return compileCoreRuntimeGraph(graph, options) as RuntimeProgram;
};

export const createRuntimeState = (program: RuntimeProgram, seed: Partial<RuntimeState> = {}): RuntimeState => {
  return createCoreRuntimeState(program, seed) as RuntimeState;
};

export const buildNodeEffects = (node: AppNode | null | undefined, edges: AppEdge[], timelineTime?: number): RuntimeEffect[] => {
  return buildCoreNodeEffects(node, edges, timelineTime) as RuntimeEffect[];
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
