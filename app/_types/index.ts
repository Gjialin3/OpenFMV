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

export interface OpenFMVChatAttachment {
  name: string;
  type: string;
  size: number;
  content?: string;
  truncated?: boolean;
}

export interface OpenFMVChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: OpenFMVChatAttachment[];
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
  version: 2;
  duration: number;
  tracks: TimelineTrack[];
  bookmarks: TimelineBookmark[];
  playheadTime?: number;
  zoom?: number;
}

export type TimelineTrackType = 'media' | 'interaction';

export interface TimelineBookmark {
  id: string;
  time: number;
  label?: string;
  color?: string;
}

export interface TimelineTrack {
  id: string;
  type: TimelineTrackType;
  name: string;
  mediaRole?: 'main' | 'overlay' | 'audio';
  locked?: boolean;
  hidden?: boolean;
  muted?: boolean;
  collapsed?: boolean;
  clips: TimelineClip[];
}

export type TimelineMediaClipType = 'video' | 'image' | 'audio';
export type TimelineInteractionClipType = 'button';
export type TimelineClipType = TimelineMediaClipType | TimelineInteractionClipType;
export type TimelineKeyframeProperty = 'opacity' | 'rotation' | 'x' | 'y' | 'width' | 'height' | 'volume';
export type TimelineKeyframeInterpolation = 'linear' | 'hold';
export type ButtonMode = 'normal' | 'qte';
export type ButtonQteInput = 'click' | 'space';
export type ButtonStylePreset = 'solid' | 'outline' | 'glass' | 'ghost';
export type ButtonStyleShape = 'rounded' | 'pill' | 'square';
export type ButtonStyleShadow = 'none' | 'soft' | 'strong';

export interface TimelineClipKeyframe {
  id: string;
  property: TimelineKeyframeProperty;
  time: number;
  value: number;
  interpolation?: TimelineKeyframeInterpolation;
}

export type TimelineClip = TimelineMediaClip | TimelineInteractionClip;

export interface BaseTimelineClip {
  id: string;
  type: TimelineClipType;
  startTime: number;
  duration: number;
  sourceStart?: number;
  sourceDuration?: number;
  name?: string;
  enabled: boolean;
  hidden?: boolean;
  opacity?: number;
  rotation?: number;
  linkGroupId?: string;
  keyframes?: TimelineClipKeyframe[];
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineAction {
  type: 'goToHandle' | 'goToNode' | 'continue' | 'pause';
  handleId?: string | null;
  nodeId?: string | null;
}

export interface TimelineMediaClip extends BaseTimelineClip {
  type: TimelineMediaClipType;
  src: string;
  assetId?: string;
  poster?: string;
  playbackId?: string;
  muted?: boolean;
  volume?: number;
  playbackRate?: number;
  preservePitch?: boolean;
  freezeFrameTime?: number;
  fit?: 'contain' | 'cover';
  rect?: OverlayRect;
  sourceAudioEnabled?: boolean;
  sourceVideoClipId?: string;
}

export interface ButtonQteConfig {
  input: ButtonQteInput;
  prompt?: string;
  clickCount?: number;
  keyLabel?: string;
  showCountdown?: boolean;
}

export interface ButtonStyleConfig {
  preset?: ButtonStylePreset;
  shape?: ButtonStyleShape;
  fillColor?: string;
  textColor?: string;
  borderColor?: string;
  fillOpacity?: number;
  borderOpacity?: number;
  borderWidth?: number;
  shadow?: ButtonStyleShadow;
}

export interface ButtonChoiceClip extends BaseTimelineClip {
  type: 'button';
  mode?: ButtonMode;
  label: string;
  rect: OverlayRect;
  action: TimelineAction;
  pauseOnShow: boolean;
  timeoutAction?: TimelineAction;
  qte?: ButtonQteConfig;
  style?: ButtonStyleConfig;
}

export type TimelineInteractionClip = ButtonChoiceClip;

export type NodeData = 
  | { type: 'story'; title: string; content: string; fullText?: string; timeline?: NodeTimeline }
  | { type: 'interaction'; title?: string; rules: InteractionRule[]; elseLabel?: string; prompt?: string; buttonText?: string; interactionMode?: InteractionMode; sliderConfig?: SliderConfig; content?: string; fullText?: string; timeLimit?: number; timeline?: NodeTimeline }
  | { type: 'start'; label?: string; content?: string; fullText?: string; rules?: InteractionRule[]; elseLabel?: string; prompt?: string; buttonText?: string; interactionMode?: InteractionMode; sliderConfig?: SliderConfig; timeLimit?: number; timeline?: NodeTimeline }
  | { type: 'end'; label?: string; content?: string; fullText?: string; timeline?: NodeTimeline };

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
