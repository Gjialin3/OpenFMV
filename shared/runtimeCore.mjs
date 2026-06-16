export function getEntryNodeId(graph, preferredEntryNodeId) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  if (preferredEntryNodeId && nodes.some((node) => node.id === preferredEntryNodeId)) {
    return preferredEntryNodeId;
  }

  return nodes.find((node) => node.type === 'start')?.id ?? nodes[0]?.id ?? null;
}

export function getNodeText(node) {
  const data = node?.data || {};
  return String(data.bodyText || '');
}

export function getNodeTitle(node) {
  const data = node?.data || {};
  if (node?.type === 'start') return String(data.label || 'Start');
  if (node?.type === 'end') return String(data.label || '结束');
  return String(data.title || 'Scene');
}

export function getOutgoingEdges(nodeId, edges) {
  return (Array.isArray(edges) ? edges : []).filter((edge) => edge.source === nodeId);
}

export function resolveNextNodeId(node, edges, choice = {}) {
  const outgoing = getOutgoingEdges(node?.id, edges);
  if (outgoing.length === 0) return null;

  if (choice.handleId) {
    const exactEdge = outgoing.find((edge) => edge.sourceHandle === choice.handleId);
    if (exactEdge) return exactEdge.target;
  }

  return outgoing.find((edge) => edge.sourceHandle === 'node:default')?.target ?? null;
}

export function getNodeById(nodes, nodeId) {
  if (!nodeId) return null;
  return (Array.isArray(nodes) ? nodes : []).find((node) => node.id === nodeId) ?? null;
}

export function isTimelineMediaClipType(type) {
  return type === 'video' || type === 'image' || type === 'audio';
}

export function isTimelineInteractionClipType(type) {
  return type === 'button';
}

export function getTimelineClipOutputHandleId(clipId, kind = 'click') {
  return kind === 'timeout' ? `button:${clipId}:timeout` : `button:${clipId}:click`;
}

export function resolveOutputTargetNodeId(node, edges, outputId) {
  if (!node || !outputId) return null;
  return getOutgoingEdges(node.id, edges).find((edge) => edge.sourceHandle === outputId)?.target ?? null;
}

export function getTimelineTracks(node) {
  return Array.isArray(node?.data?.timeline?.tracks) ? node.data.timeline.tracks : [];
}

export function getVisibleTimelineTracks(node) {
  return getTimelineTracks(node).filter((track) => track?.hidden !== true);
}

export function getTimelineClips(node) {
  return getTimelineTracks(node).flatMap((track) => (Array.isArray(track.clips) ? track.clips : []));
}

export function getVisibleTimelineClips(node) {
  return getVisibleTimelineTracks(node)
    .flatMap((track) => (Array.isArray(track.clips) ? track.clips : []))
    .filter((clip) => clip?.hidden !== true);
}

export function getTimelineMediaClips(node) {
  return getVisibleTimelineTracks(node)
    .filter((track) => track?.type === 'media')
    .flatMap((track) => (Array.isArray(track.clips) ? track.clips.map((clip) => ({ ...clip, muted: track.muted === true || clip?.muted === true || (clip?.type === 'video' && clip?.sourceAudioEnabled === false) })) : []))
    .filter((clip) => clip?.enabled !== false && clip?.hidden !== true && isTimelineMediaClipType(clip?.type) && typeof clip.src === 'string' && clip.src.length > 0)
    .sort((first, second) => (Number(first.startTime) || 0) - (Number(second.startTime) || 0));
}

export function getTimelineInteractionClips(node) {
  return getVisibleTimelineTracks(node)
    .filter((track) => track?.type === 'interaction')
    .flatMap((track) => (Array.isArray(track.clips) ? track.clips : []))
    .filter((clip) => clip?.enabled !== false && clip?.hidden !== true && isTimelineInteractionClipType(clip?.type))
    .sort((first, second) => (Number(first.startTime) || 0) - (Number(second.startTime) || 0));
}

export function getTimelineClipEndTime(clip) {
  const startTime = Number(clip?.startTime) || 0;
  const duration = Number(clip?.duration);
  if (Number.isFinite(duration) && duration > 0) return startTime + duration;
  const endTime = Number(clip?.endTime);
  return Number.isFinite(endTime) && endTime > startTime ? endTime : startTime + 0.1;
}

export function getTimelineMediaPlaybackRate(clip) {
  const playbackRate = Number(clip?.playbackRate);
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return 1;
  return Math.max(0.01, Math.min(5, playbackRate));
}

export function getTimelineClipRuntimeEndTime(clip) {
  const clipEndTime = getTimelineClipEndTime(clip);
  if (clip?.type !== 'video' && clip?.type !== 'audio') return clipEndTime;
  if (clip.type === 'video' && Number.isFinite(Number(clip.freezeFrameTime))) return clipEndTime;

  const sourceDuration = Number(clip.sourceDuration);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return clipEndTime;

  const startTime = Number(clip.startTime) || 0;
  return Math.min(clipEndTime, startTime + sourceDuration / getTimelineMediaPlaybackRate(clip));
}

export function isTimelineClipActive(clip, time) {
  if (!clip || clip.enabled === false || clip.hidden === true) return false;
  const startTime = Number(clip.startTime) || 0;
  return time >= startTime && time < getTimelineClipEndTime(clip);
}

function clampTimelineClipOpacity(opacity) {
  const value = Number(opacity);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

function clampTimelineKeyframeValue(property, value) {
  if (property === 'opacity') return clampTimelineClipOpacity(value);
  if (property === 'volume') {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? Math.max(0, Math.min(2, nextValue)) : 1;
  }
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return property === 'width' || property === 'height' ? 0.1 : 0;
  if (property === 'width' || property === 'height') return Math.max(0.01, Math.min(1, nextValue));
  if (property === 'x' || property === 'y') return Math.max(0, Math.min(1, nextValue));
  return nextValue;
}

function getTimelineClipLocalTime(clip, timelineTime) {
  const startTime = Number(clip?.startTime) || 0;
  const duration = Math.max(0, Number(clip?.duration) || 0);
  return Math.max(0, Math.min(duration, (Number(timelineTime) || 0) - startTime));
}

function getTimelineClipKeyframesForProperty(clip, property) {
  return (Array.isArray(clip?.keyframes) ? clip.keyframes : [])
    .filter((keyframe) => keyframe?.property === property)
    .sort((first, second) => (Number(first.time) || 0) - (Number(second.time) || 0));
}

function resolveTimelineKeyframedValue({ clip, property, timelineTime, fallback }) {
  const keyframes = getTimelineClipKeyframesForProperty(clip, property);
  if (keyframes.length === 0) return fallback;
  const localTime = getTimelineClipLocalTime(clip, timelineTime);
  const previous = [...keyframes].reverse().find((keyframe) => Number(keyframe.time) <= localTime);
  const next = keyframes.find((keyframe) => Number(keyframe.time) >= localTime);
  if (!previous) return clampTimelineKeyframeValue(property, keyframes[0]?.value);
  if (!next) return clampTimelineKeyframeValue(property, keyframes[keyframes.length - 1]?.value);
  if (previous.id === next.id || Number(previous.time) === Number(next.time)) return clampTimelineKeyframeValue(property, previous.value);
  const progress = (localTime - Number(previous.time)) / (Number(next.time) - Number(previous.time));
  return clampTimelineKeyframeValue(property, Number(previous.value) + (Number(next.value) - Number(previous.value)) * progress);
}

export function resolveTimelineClipKeyframes(clip, timelineTime) {
  if (!Array.isArray(clip?.keyframes) || clip.keyframes.length === 0) return clip;
  const resolved = {
    ...clip,
    opacity: resolveTimelineKeyframedValue({ clip, property: 'opacity', timelineTime, fallback: clampTimelineClipOpacity(clip.opacity) }),
    rotation: resolveTimelineKeyframedValue({ clip, property: 'rotation', timelineTime, fallback: Number.isFinite(Number(clip.rotation)) ? Number(clip.rotation) : 0 }),
  };
  if (clip.type === 'video' || clip.type === 'image' || clip.type === 'button') {
    const rect = clip.rect || (clip.type === 'video' || clip.type === 'image' ? { x: 0, y: 0, width: 1, height: 1 } : { x: 0.38, y: 0.76, width: 0.24, height: 0.1 });
    resolved.rect = {
      x: resolveTimelineKeyframedValue({ clip, property: 'x', timelineTime, fallback: Number(rect.x) || 0 }),
      y: resolveTimelineKeyframedValue({ clip, property: 'y', timelineTime, fallback: Number(rect.y) || 0 }),
      width: resolveTimelineKeyframedValue({ clip, property: 'width', timelineTime, fallback: Number(rect.width) || 1 }),
      height: resolveTimelineKeyframedValue({ clip, property: 'height', timelineTime, fallback: Number(rect.height) || 1 }),
    };
  }
  if (clip.type === 'video' || clip.type === 'audio') {
    resolved.volume = resolveTimelineKeyframedValue({ clip, property: 'volume', timelineTime, fallback: Number.isFinite(Number(clip.volume)) ? Number(clip.volume) : 1 });
  }
  return resolved;
}

export function getActiveTimelineClips(node, time) {
  const timelineTime = Number(time) || 0;
  return getTimelineInteractionClips(node)
    .filter((clip) => isTimelineClipActive(clip, timelineTime))
    .map((clip) => resolveTimelineClipKeyframes(clip, timelineTime));
}

export function getActiveTimelineMediaClips(node, time) {
  const timelineTime = Number(time) || 0;
  return getTimelineMediaClips(node)
    .filter((clip) => isTimelineClipActive(clip, timelineTime))
    .map((clip) => resolveTimelineClipKeyframes(clip, timelineTime));
}

export function clampRuntimeTimelineTime(time, duration = 0) {
  const normalizedTime = Number(time);
  const normalizedDuration = Number(duration);
  if (!Number.isFinite(normalizedTime)) return 0;
  if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0) return Math.max(0, normalizedTime);
  return Math.max(0, Math.min(normalizedDuration, normalizedTime));
}

export function getTimelineDuration(node) {
  const mediaDuration = getTimelineMediaClips(node).reduce((duration, clip) => Math.max(duration, getTimelineClipRuntimeEndTime(clip)), 0);
  const interactionDuration = getTimelineInteractionClips(node).reduce((duration, clip) => Math.max(duration, getTimelineClipEndTime(clip)), 0);
  return Math.max(mediaDuration, interactionDuration);
}

export function compileNodeTimeline(node) {
  const mediaClips = getTimelineMediaClips(node);
  const visualMediaClips = mediaClips.filter((clip) => clip.type === 'video' || clip.type === 'image');
  const interactionClips = getTimelineInteractionClips(node);
  return {
    nodeId: node?.id,
    duration: getTimelineDuration(node),
    mediaClips,
    visualMediaClips,
    interactionClips,
    primaryMediaClip: visualMediaClips[0] ?? mediaClips[0] ?? null,
  };
}

export function compileRuntimeGraph(graph, options = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  return {
    graph: { nodes, edges },
    entryNodeId: getEntryNodeId({ nodes, edges }, options.entryNodeId ?? graph?.metadata?.entryNodeId),
  };
}

export function createRuntimeState(program, seed = {}) {
  const currentNodeId = seed.currentNodeId ?? program.entryNodeId ?? null;
  const currentNode = getNodeById(program.graph.nodes, currentNodeId);
  return {
    status: currentNodeId ? 'running' : 'ended',
    currentNodeId,
    history: currentNodeId ? [currentNodeId] : [],
    variables: { ...(seed.variables || {}) },
    timelineTime: clampRuntimeTimelineTime(seed.timelineTime, getTimelineDuration(currentNode)),
  };
}

export function buildNodeEffects(node, edges, timelineTime = 0) {
  if (!node) {
    return [{ type: 'end' }];
  }

  const data = node.data || {};
  const effects = [
    {
      type: 'scene',
      nodeId: node.id,
      nodeType: node.type,
      title: getNodeTitle(node),
      text: getNodeText(node),
    },
  ];

  const compiledTimeline = compileNodeTimeline(node);
  const hasNodeTimeline = Array.isArray(data.timeline?.tracks);
  const currentTimelineTime = clampRuntimeTimelineTime(timelineTime, compiledTimeline.duration);
  const shouldDeferRuntimeControls = hasNodeTimeline && compiledTimeline.duration > 0 && currentTimelineTime < compiledTimeline.duration;
  if (hasNodeTimeline && compiledTimeline.duration > 0) {
    effects.push({ type: 'timelinePlayback', nodeId: node.id, duration: compiledTimeline.duration });
  }
  const activeTimelineMediaClips = hasNodeTimeline
    ? compiledTimeline.mediaClips
      .filter((clip) => isTimelineClipActive(clip, currentTimelineTime))
      .map((clip) => resolveTimelineClipKeyframes(clip, currentTimelineTime))
    : [];
  const activeVisualTimelineMediaClips = activeTimelineMediaClips.filter((clip) => clip.type === 'video' || clip.type === 'image');
  const activeAudioTimelineMediaClips = activeTimelineMediaClips.filter((clip) => clip.type === 'audio');

  const pushMediaEffect = (timelineMediaClip) => {
    if (!timelineMediaClip) return;
    if (timelineMediaClip.type === 'video') {
      effects.push({
        type: 'playMedia',
        mediaType: 'video',
        src: timelineMediaClip.src,
        playbackId: timelineMediaClip.playbackId,
        poster: timelineMediaClip.poster,
        timelineStartTime: Number(timelineMediaClip.startTime) || 0,
        sourceStart: Number(timelineMediaClip.sourceStart) || 0,
        sourceDuration: Number.isFinite(Number(timelineMediaClip.sourceDuration)) ? Math.max(0, Number(timelineMediaClip.sourceDuration)) : undefined,
        duration: Number(timelineMediaClip.duration) || undefined,
        timelineDuration: compiledTimeline.duration,
        muted: timelineMediaClip.muted === true,
        rect: timelineMediaClip.rect,
        fit: timelineMediaClip.fit,
        opacity: Number.isFinite(Number(timelineMediaClip.opacity)) ? Math.max(0, Math.min(1, Number(timelineMediaClip.opacity))) : undefined,
        rotation: Number.isFinite(Number(timelineMediaClip.rotation)) ? Number(timelineMediaClip.rotation) : undefined,
        playbackRate: Number.isFinite(Number(timelineMediaClip.playbackRate)) ? Math.max(0.01, Math.min(5, Number(timelineMediaClip.playbackRate))) : undefined,
        preservePitch: timelineMediaClip.preservePitch !== false,
        freezeFrameTime: Number.isFinite(Number(timelineMediaClip.freezeFrameTime)) ? Math.max(0, Number(timelineMediaClip.freezeFrameTime)) : undefined,
      });
      return;
    }
    if (timelineMediaClip.type === 'image') {
      effects.push({
        type: 'playMedia',
        mediaType: 'image',
        src: timelineMediaClip.src,
        timelineStartTime: Number(timelineMediaClip.startTime) || 0,
        duration: Number(timelineMediaClip.duration) || undefined,
        timelineDuration: compiledTimeline.duration,
        rect: timelineMediaClip.rect,
        fit: timelineMediaClip.fit,
        opacity: Number.isFinite(Number(timelineMediaClip.opacity)) ? Math.max(0, Math.min(1, Number(timelineMediaClip.opacity))) : undefined,
        rotation: Number.isFinite(Number(timelineMediaClip.rotation)) ? Number(timelineMediaClip.rotation) : undefined,
      });
      return;
    }
    effects.push({
      type: 'playMedia',
      mediaType: 'audio',
      src: timelineMediaClip.src,
      timelineStartTime: Number(timelineMediaClip.startTime) || 0,
      sourceStart: Number(timelineMediaClip.sourceStart) || 0,
      sourceDuration: Number.isFinite(Number(timelineMediaClip.sourceDuration)) ? Math.max(0, Number(timelineMediaClip.sourceDuration)) : undefined,
      duration: Number(timelineMediaClip.duration) || undefined,
      timelineDuration: compiledTimeline.duration,
      muted: timelineMediaClip.muted === true,
      volume: Number.isFinite(Number(timelineMediaClip.volume)) ? Math.max(0, Math.min(2, Number(timelineMediaClip.volume))) : undefined,
      playbackRate: Number.isFinite(Number(timelineMediaClip.playbackRate)) ? Math.max(0.01, Math.min(5, Number(timelineMediaClip.playbackRate))) : undefined,
      preservePitch: timelineMediaClip.preservePitch !== false,
    });
  };

  activeVisualTimelineMediaClips.forEach(pushMediaEffect);
  activeAudioTimelineMediaClips.forEach(pushMediaEffect);

  if (compiledTimeline.interactionClips.length > 0) {
    effects.push({ type: 'timelineOverlay', nodeId: node.id, clips: compiledTimeline.interactionClips, duration: compiledTimeline.duration });
  }

  if (node.type === 'end') {
    if (!shouldDeferRuntimeControls) effects.push({ type: 'showRestart' });
    return effects;
  }

  const defaultEdge = getOutgoingEdges(node.id, edges).find((edge) => edge.sourceHandle === 'node:default');
  if (hasNodeTimeline && compiledTimeline.duration > 0 && !shouldDeferRuntimeControls && defaultEdge) {
    effects.push({ type: 'autoNavigate', targetNodeId: defaultEdge.target });
  } else if (!shouldDeferRuntimeControls && defaultEdge) {
    effects.push({ type: 'showContinue', label: '继续', targetNodeId: defaultEdge.target });
  }

  return effects;
}

export function getRuntimeSnapshot(program, state) {
  const node = state.status === 'running' ? getNodeById(program.graph.nodes, state.currentNodeId) : null;
  const timelineTime = clampRuntimeTimelineTime(state.timelineTime, getTimelineDuration(node));
  return {
    status: state.status,
    currentNodeId: state.currentNodeId,
    currentNode: node,
    history: [...state.history],
    variables: { ...state.variables },
    timelineTime,
    effects: buildNodeEffects(node, program.graph.edges, timelineTime),
  };
}

export function dispatchRuntimeEvent(program, state, event) {
  const type = event?.type || 'continue';
  if (type === 'restart' || type === 'runtime.start') {
    return createRuntimeState(program);
  }

  const isNodeScopedTimelineEvent = type === 'timeline.time.update' || type === 'timeline.clip.triggered' || type === 'timeline.clip.timeout';
  if (isNodeScopedTimelineEvent && event?.nodeId && event.nodeId !== state.currentNodeId) {
    return state;
  }

  if (type === 'timeline.time.update') {
    const currentNode = getNodeById(program.graph.nodes, state.currentNodeId);
    if (!currentNode || state.status !== 'running') return state;
    return {
      ...state,
      timelineTime: clampRuntimeTimelineTime(event.time, getTimelineDuration(currentNode)),
    };
  }

  if (type === 'timeline.clip.triggered' || type === 'timeline.clip.timeout') {
    const currentNode = getNodeById(program.graph.nodes, state.currentNodeId);
    if (!currentNode || state.status !== 'running') return state;
    const compiledTimeline = compileNodeTimeline(currentNode);
    const currentTimelineTime = clampRuntimeTimelineTime(state.timelineTime, compiledTimeline.duration);
    const interactionClip = compiledTimeline.interactionClips.find((item) => item.id === event.clipId);
    const isQteInteractionClip = interactionClip?.type === 'button' && interactionClip.mode === 'qte';

    if (type === 'timeline.clip.triggered' && (!interactionClip || !isTimelineClipActive(interactionClip, currentTimelineTime))) return state;
    if (type === 'timeline.clip.timeout' && (!interactionClip || !isQteInteractionClip)) return state;
    if (type === 'timeline.clip.timeout' && isQteInteractionClip && currentTimelineTime < (interactionClip.startTime || 0)) return state;

    const outputId = getTimelineClipOutputHandleId(interactionClip.id, type === 'timeline.clip.timeout' ? 'timeout' : 'click');
    const targetNodeId = resolveOutputTargetNodeId(currentNode, program.graph.edges, outputId);
    const targetNode = getNodeById(program.graph.nodes, targetNodeId);
    if (!targetNode) return state;
    return {
      ...state,
      status: 'running',
      currentNodeId: targetNode.id,
      history: [...state.history, targetNode.id],
      timelineTime: 0,
    };
  }

  const currentNode = getNodeById(program.graph.nodes, state.currentNodeId);
  if (!currentNode || state.status !== 'running') return state;

  const targetNodeId = type === 'navigate'
    ? event.nodeId
    : resolveNextNodeId(currentNode, program.graph.edges, { handleId: 'node:default' });
  const targetNode = getNodeById(program.graph.nodes, targetNodeId);
  if (!targetNode) {
    return {
      ...state,
      status: 'ended',
      currentNodeId: null,
      timelineTime: 0,
    };
  }

  return {
    ...state,
    status: 'running',
    currentNodeId: targetNode.id,
    history: [...state.history, targetNode.id],
    timelineTime: 0,
  };
}

export function createRuntime(graph, options = {}) {
  const program = compileRuntimeGraph(graph, options);
  let state = createRuntimeState(program, options.initialState || {});

  return {
    program,
    start() {
      state = createRuntimeState(program, options.initialState || {});
      return getRuntimeSnapshot(program, state);
    },
    dispatch(event) {
      state = dispatchRuntimeEvent(program, state, event);
      return getRuntimeSnapshot(program, state);
    },
    getSnapshot() {
      return getRuntimeSnapshot(program, state);
    },
  };
}

const runtimeFunctions = [
  getEntryNodeId,
  getNodeText,
  getNodeTitle,
  getOutgoingEdges,
  resolveNextNodeId,
  getNodeById,
  isTimelineMediaClipType,
  isTimelineInteractionClipType,
  getTimelineClipOutputHandleId,
  resolveOutputTargetNodeId,
  getTimelineTracks,
  getTimelineClips,
  getTimelineMediaClips,
  getTimelineInteractionClips,
  getTimelineClipEndTime,
  getTimelineMediaPlaybackRate,
  getTimelineClipRuntimeEndTime,
  isTimelineClipActive,
  resolveTimelineClipKeyframes,
  getActiveTimelineClips,
  getActiveTimelineMediaClips,
  clampRuntimeTimelineTime,
  getTimelineDuration,
  compileNodeTimeline,
  compileRuntimeGraph,
  createRuntimeState,
  buildNodeEffects,
  getRuntimeSnapshot,
  dispatchRuntimeEvent,
  createRuntime,
];

export function buildRuntimeCoreBrowserScript() {
  return `(() => {
  const getEntryNodeId = ${getEntryNodeId.toString()};
  const getNodeText = ${getNodeText.toString()};
  const getNodeTitle = ${getNodeTitle.toString()};
  const getOutgoingEdges = ${getOutgoingEdges.toString()};
  const resolveNextNodeId = ${resolveNextNodeId.toString()};
  const getNodeById = ${getNodeById.toString()};
  const isTimelineMediaClipType = ${isTimelineMediaClipType.toString()};
  const isTimelineInteractionClipType = ${isTimelineInteractionClipType.toString()};
  const getTimelineClipOutputHandleId = ${getTimelineClipOutputHandleId.toString()};
  const resolveOutputTargetNodeId = ${resolveOutputTargetNodeId.toString()};
  const getTimelineTracks = ${getTimelineTracks.toString()};
  const getVisibleTimelineTracks = ${getVisibleTimelineTracks.toString()};
  const getTimelineClips = ${getTimelineClips.toString()};
  const getVisibleTimelineClips = ${getVisibleTimelineClips.toString()};
  const getTimelineMediaClips = ${getTimelineMediaClips.toString()};
  const getTimelineInteractionClips = ${getTimelineInteractionClips.toString()};
  const getTimelineClipEndTime = ${getTimelineClipEndTime.toString()};
  const getTimelineMediaPlaybackRate = ${getTimelineMediaPlaybackRate.toString()};
  const getTimelineClipRuntimeEndTime = ${getTimelineClipRuntimeEndTime.toString()};
  const isTimelineClipActive = ${isTimelineClipActive.toString()};
  const clampTimelineClipOpacity = ${clampTimelineClipOpacity.toString()};
  const clampTimelineKeyframeValue = ${clampTimelineKeyframeValue.toString()};
  const getTimelineClipLocalTime = ${getTimelineClipLocalTime.toString()};
  const getTimelineClipKeyframesForProperty = ${getTimelineClipKeyframesForProperty.toString()};
  const resolveTimelineKeyframedValue = ${resolveTimelineKeyframedValue.toString()};
  const resolveTimelineClipKeyframes = ${resolveTimelineClipKeyframes.toString()};
  const getActiveTimelineClips = ${getActiveTimelineClips.toString()};
  const getActiveTimelineMediaClips = ${getActiveTimelineMediaClips.toString()};
  const clampRuntimeTimelineTime = ${clampRuntimeTimelineTime.toString()};
  const getTimelineDuration = ${getTimelineDuration.toString()};
  const compileNodeTimeline = ${compileNodeTimeline.toString()};
  const compileRuntimeGraph = ${compileRuntimeGraph.toString()};
  const createRuntimeState = ${createRuntimeState.toString()};
  const buildNodeEffects = ${buildNodeEffects.toString()};
  const getRuntimeSnapshot = ${getRuntimeSnapshot.toString()};
  const dispatchRuntimeEvent = ${dispatchRuntimeEvent.toString()};
  const createRuntime = ${createRuntime.toString()};
  window.OpenFMVRuntimeCore = {
    getEntryNodeId,
    getNodeText,
    getNodeTitle,
    getOutgoingEdges,
    resolveNextNodeId,
    getNodeById,
    isTimelineMediaClipType,
    isTimelineInteractionClipType,
    getTimelineClipOutputHandleId,
    resolveOutputTargetNodeId,
    getTimelineTracks,
    getVisibleTimelineTracks,
    getTimelineClips,
    getVisibleTimelineClips,
    getTimelineMediaClips,
    getTimelineInteractionClips,
    getTimelineClipEndTime,
    getTimelineMediaPlaybackRate,
    getTimelineClipRuntimeEndTime,
    isTimelineClipActive,
    resolveTimelineClipKeyframes,
    getActiveTimelineClips,
    getActiveTimelineMediaClips,
    clampRuntimeTimelineTime,
    getTimelineDuration,
    compileNodeTimeline,
    compileRuntimeGraph,
    createRuntimeState,
    buildNodeEffects,
    getRuntimeSnapshot,
    dispatchRuntimeEvent,
    createRuntime,
  };
  window.OpenFMVGraphRuntime = window.OpenFMVRuntimeCore;
})();`;
}

export const runtimeCoreFunctionNames = runtimeFunctions.map((runtimeFunction) => runtimeFunction.name);
export const graphRuntimeFunctionNames = runtimeCoreFunctionNames;
export const buildGraphRuntimeBrowserScript = buildRuntimeCoreBrowserScript;
