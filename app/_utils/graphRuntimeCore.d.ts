import { AppEdge, AppNode, NodeType, OpenFMVGraph, OverlayRect, TimelineClip, TimelineInteractionClip, TimelineMediaClip } from '../_types';

export interface RuntimeChoice {
  input?: string;
  handleId?: string | null;
}

export function getEntryNodeId(graph: OpenFMVGraph, preferredEntryNodeId?: string | null): string | null;
export function getNodeText(node: AppNode): string;
export function getNodeTitle(node: AppNode): string;
export function getOutgoingEdges(nodeId: string, edges: AppEdge[]): AppEdge[];
export function resolveNextNodeId(node: AppNode, edges: AppEdge[], choice?: RuntimeChoice): string | null;
export function getNodeById(nodes: AppNode[], nodeId: string | null | undefined): AppNode | null;
export function isTimelineMediaClipType(type: unknown): boolean;
export function isTimelineInteractionClipType(type: unknown): boolean;
export function getTimelineClipOutputHandleId(clipId: string, kind?: 'click' | 'timeout'): string;
export function resolveOutputTargetNodeId(node: AppNode | null | undefined, edges: AppEdge[], outputId: string): string | null;
export function getTimelineTracks(node: AppNode): unknown[];
export function getTimelineClips(node: AppNode): TimelineClip[];
export function getTimelineMediaClips(node: AppNode): TimelineMediaClip[];
export function getTimelineInteractionClips(node: AppNode): TimelineInteractionClip[];
export function getTimelineClipEndTime(clip: TimelineClip): number;
export function getTimelineMediaPlaybackRate(clip: TimelineClip): number;
export function getTimelineClipRuntimeEndTime(clip: TimelineClip): number;
export function isTimelineClipActive(clip: TimelineClip, time: number): boolean;
export function resolveTimelineClipKeyframes<TClip extends TimelineClip>(clip: TClip, timelineTime: number): TClip;
export function getActiveTimelineClips(node: AppNode, time: number): TimelineInteractionClip[];
export function getActiveTimelineMediaClips(node: AppNode, time: number): TimelineMediaClip[];
export function clampRuntimeTimelineTime(time: number, duration?: number): number;
export function getTimelineDuration(node: AppNode): number;
export function compileNodeTimeline(node: AppNode): {
  nodeId?: string;
  duration: number;
  mediaClips: TimelineMediaClip[];
  visualMediaClips: TimelineMediaClip[];
  interactionClips: TimelineInteractionClip[];
  primaryMediaClip: TimelineMediaClip | null;
};
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
  | { type: 'navigate'; nodeId: string | null }
  | { type: 'timeline.time.update'; time: number; nodeId?: string | null }
  | { type: 'timeline.clip.triggered'; clipId: string; nodeId?: string | null }
  | { type: 'timeline.clip.timeout'; clipId: string; nodeId?: string | null };
export type RuntimeEffect =
  | { type: 'scene'; nodeId: string; nodeType: NodeType; title: string; text: string }
  | { type: 'playMedia'; mediaType: 'video'; src: string; playbackId?: string; poster?: string; timelineStartTime?: number; sourceStart?: number; sourceDuration?: number; duration?: number; timelineDuration?: number; muted?: boolean; rect?: OverlayRect; fit?: 'contain' | 'cover'; opacity?: number; rotation?: number; playbackRate?: number; preservePitch?: boolean; freezeFrameTime?: number }
  | { type: 'playMedia'; mediaType: 'image'; src: string; timelineStartTime?: number; duration?: number; timelineDuration?: number; rect?: OverlayRect; fit?: 'contain' | 'cover'; opacity?: number; rotation?: number }
  | { type: 'playMedia'; mediaType: 'audio'; src: string; timelineStartTime?: number; sourceStart?: number; sourceDuration?: number; duration?: number; timelineDuration?: number; muted?: boolean; volume?: number; playbackRate?: number; preservePitch?: boolean }
  | { type: 'autoNavigate'; targetNodeId: string }
  | { type: 'showContinue'; label: string; targetNodeId: string }
  | { type: 'showRestart' }
  | { type: 'timelinePlayback'; nodeId: string; duration: number }
  | { type: 'timelineOverlay'; nodeId: string; clips: TimelineInteractionClip[]; duration?: number }
  | { type: 'end' };
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
  start(): RuntimeSnapshot;
  dispatch(event: RuntimeEvent): RuntimeSnapshot;
  getSnapshot(): RuntimeSnapshot;
}
export function compileRuntimeGraph(graph: OpenFMVGraph, options?: { entryNodeId?: string | null }): RuntimeProgram;
export function createRuntimeState(program: RuntimeProgram, seed?: Partial<RuntimeState>): RuntimeState;
export function buildNodeEffects(node: AppNode | null | undefined, edges: AppEdge[], timelineTime?: number): RuntimeEffect[];
export function getRuntimeSnapshot(program: RuntimeProgram, state: RuntimeState): RuntimeSnapshot;
export function dispatchRuntimeEvent(program: RuntimeProgram, state: RuntimeState, event: RuntimeEvent): RuntimeState;
export function createRuntime(graph: OpenFMVGraph, options?: { entryNodeId?: string | null; initialState?: Partial<RuntimeState> }): RuntimeController;
export function buildGraphRuntimeBrowserScript(): string;
export function buildRuntimeCoreBrowserScript(): string;
export const graphRuntimeFunctionNames: string[];
export const runtimeCoreFunctionNames: string[];
