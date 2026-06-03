import { Node, Edge } from '@xyflow/react';

export type NodeType = 'start' | 'end' | 'story' | 'interaction';

export interface OpenFMVGraph {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface OpenFMVAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  name: string;
  path: string;
  relativePath: string;
  importedAt: string;
  metadata?: Record<string, unknown>;
}

export interface OpenFMVProject {
  schemaVersion: 1;
  id: string;
  title: string;
  graphData: OpenFMVGraph;
  assets: OpenFMVAsset[];
  metadata: {
    description?: string;
    coverImage?: string;
    entryNodeId?: string;
    projectDirectory?: string;
    projectPath?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GameExportConfig {
  gameTitle: string;
  outputDirectory: string;
  locale?: string;
  entryNodeId?: string;
  windowMode: 'windowed' | 'fullscreen' | 'borderless';
  resolution: {
    width: number;
    height: number;
  };
  includeDebugOverlay: boolean;
}

export type OpenFMVExecutionMode = 'cli';

export type OpenFMVAgentId = 'codex' | 'claude' | 'gemini' | 'kimi' | 'qwen' | 'opencode';

export type OpenFMVByokProviderId = 'anthropic' | 'openai-compatible' | 'google-gemini' | 'ollama';

export type OpenFMVMediaProviderId = 'openai-image' | 'doubao-image' | 'doubao-video' | 'google-imagen' | 'google-veo' | 'kling-video' | 'minimax-video' | 'minimax-tts' | 'elevenlabs-audio' | 'senseaudio';

export type OpenFMVMediaProviderType = 'image' | 'video' | 'audio';

export interface OpenFMVAgentInfo {
  id: OpenFMVAgentId;
  name: string;
  bin: string;
  version: string;
  available: boolean;
  models: string[];
  reasoningOptions?: string[];
}

export interface OpenFMVCliSelection {
  agentId: OpenFMVAgentId;
  model: string;
  reasoningEffort?: string;
}

export interface OpenFMVByokProviderConfig {
  providerId: OpenFMVByokProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface OpenFMVMediaProviderConfig {
  providerId: OpenFMVMediaProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface OpenFMVAiConfig {
  executionMode: OpenFMVExecutionMode;
  selectedCliAgentId: OpenFMVAgentId;
  cliSelections: OpenFMVCliSelection[];
  selectedByokProviderId: OpenFMVByokProviderId;
  byokProviders: OpenFMVByokProviderConfig[];
  mediaProviders: OpenFMVMediaProviderConfig[];
}

export interface OpenFMVConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface OpenFMVChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpenFMVChatRequest {
  messages: OpenFMVChatMessage[];
}

export interface OpenFMVChatResponse {
  ok: boolean;
  content: string;
  agentId: OpenFMVAgentId;
  model: string;
  error?: string;
}

export type AppNode = Node<NodeData, NodeType>;

export interface NodeTimeline {
  version: 1;
  duration?: number;
  tracks: TimelineTrack[];
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'interaction' | 'logic';
  name: string;
  locked?: boolean;
  hidden?: boolean;
  clips: TimelineClip[];
}

export type TimelineClipType = 'button' | 'hotspot' | 'pauseGate';

export type TimelineClip = ButtonChoiceClip | HotspotClip | PauseGateClip;

export interface BaseTimelineClip {
  id: string;
  type: TimelineClipType;
  startTime: number;
  endTime?: number;
  name?: string;
  enabled: boolean;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineAction {
  type: 'goToHandle' | 'goToNode' | 'continue' | 'setVariable';
  handleId?: string | null;
  nodeId?: string | null;
  key?: string;
  value?: unknown;
}

export interface ButtonChoiceClip extends BaseTimelineClip {
  type: 'button';
  label: string;
  rect: OverlayRect;
  action: TimelineAction;
  pauseOnShow: boolean;
  timeoutAction?: TimelineAction;
}

export interface HotspotClip extends BaseTimelineClip {
  type: 'hotspot';
  rect: OverlayRect;
  hint?: string;
  showHint: boolean;
  action: TimelineAction;
  pauseOnShow: boolean;
}

export interface PauseGateClip extends BaseTimelineClip {
  type: 'pauseGate';
  label: string;
  rect?: OverlayRect;
  action?: TimelineAction;
  resumeOnClick: boolean;
}

export type NodeData = 
  | { type: 'story'; title: string; content: string; fullText?: string; image?: string; video?: string; videoPlaybackId?: string; videoThumbnail?: string; timeline?: NodeTimeline }
  | { type: 'interaction'; title?: string; rules: InteractionRule[]; elseLabel?: string; video?: string; videoPlaybackId?: string; image?: string; videoThumbnail?: string; prompt?: string; buttonText?: string; interactionMode?: InteractionMode; sliderConfig?: SliderConfig; content?: string; fullText?: string; timeLimit?: number; timeline?: NodeTimeline }
  | { type: 'start'; label?: string; video?: string; videoPlaybackId?: string; videoThumbnail?: string; content?: string; fullText?: string; image?: string; rules?: InteractionRule[]; elseLabel?: string; prompt?: string; buttonText?: string; interactionMode?: InteractionMode; sliderConfig?: SliderConfig; timeLimit?: number; timeline?: NodeTimeline }
  | { type: 'end'; label?: string; video?: string; videoPlaybackId?: string; videoThumbnail?: string; content?: string; fullText?: string; image?: string; timeline?: NodeTimeline };

export interface InteractionRule {
  id: string;
  keyword: string;
  condition?: string;
  handleId: string;
  generated?: boolean;
  style?: 'aggressive' | 'defensive' | 'clever' | 'neutral';
}

export type AppEdge = Edge;

export type InteractionMode = 'choice' | 'input' | 'slider';

export interface SliderConfig {
  label?: string;
}
