export function getEntryNodeId(graph, preferredEntryNodeId) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  if (preferredEntryNodeId && nodes.some((node) => node.id === preferredEntryNodeId)) {
    return preferredEntryNodeId;
  }

  return nodes.find((node) => node.type === 'start')?.id ?? nodes[0]?.id ?? null;
}

export function getNodeText(node) {
  const data = node?.data || {};
  return String(data.fullText || data.content || '');
}

export function getNodeTitle(node) {
  const data = node?.data || {};
  if (node?.type === 'start') return String(data.label || 'Start');
  if (node?.type === 'end') return String(data.label || '结束');
  return String(data.title || data.prompt || '剧情');
}

export function getVisibleRules(node) {
  const data = node?.data || {};
  return (data.rules || []).filter((rule) => rule.id !== 'else' && rule.handleId !== 'else');
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

  const normalizedInput = choice.input?.trim().toLowerCase();
  if (normalizedInput) {
    const matchedRule = getVisibleRules(node).find((rule) => {
      const condition = (rule.condition || rule.keyword || '').toLowerCase();
      return condition && (normalizedInput.includes(condition) || condition.includes(normalizedInput));
    });
    if (matchedRule) {
      const matchedEdge = outgoing.find((edge) => edge.sourceHandle === matchedRule.handleId);
      if (matchedEdge) return matchedEdge.target;
    }
  }

  return outgoing.find((edge) => edge.sourceHandle === 'else')?.target ?? outgoing[0]?.target ?? null;
}

export function getNodeById(nodes, nodeId) {
  if (!nodeId) return null;
  return (Array.isArray(nodes) ? nodes : []).find((node) => node.id === nodeId) ?? null;
}

export function getRuntimeInteractionMode(node) {
  const mode = node?.data?.interactionMode;
  return mode === 'input' || mode === 'slider' ? mode : 'choice';
}

export function shouldShowRuntimeControls(node, edges) {
  return Boolean(node && (node.type === 'interaction' || getOutgoingEdges(node.id, edges).length > 0));
}

export function getRuntimeChoiceRules(node) {
  const rules = getVisibleRules(node);
  return rules.length > 0 ? rules : [{ id: 'continue', keyword: '继续', condition: '继续', handleId: '' }];
}

export function isTimelineMediaClipType(type) {
  return type === 'video' || type === 'image' || type === 'audio';
}

export function isTimelineInteractionClipType(type) {
  return type === 'button';
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
  const explicitDuration = Number(node?.data?.timeline?.duration);
  const clipDuration = getTimelineClips(node).reduce((duration, clip) => Math.max(duration, getTimelineClipEndTime(clip)), 0);
  return Number.isFinite(explicitDuration) && explicitDuration > 0 ? Math.max(explicitDuration, clipDuration) : clipDuration;
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

export function resolveTimelineActionNodeId(node, edges, action = {}) {
  if (!action || action.type === 'continue') return node?.id ?? null;
  if (action.type === 'pause') return node?.id ?? null;
  if (action.type === 'goToNode') return action.nodeId ?? null;
  if (action.type === 'goToHandle') return resolveNextNodeId(node, edges, { handleId: action.handleId ?? null });
  return node?.id ?? null;
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

  if (!shouldDeferRuntimeControls && shouldShowRuntimeControls(node, edges)) {
    const mode = getRuntimeInteractionMode(node);
    if (mode === 'input') {
      effects.push({
        type: 'showInput',
        prompt: data.prompt || '',
        placeholder: data.buttonText || '输入你的回答...',
      });
    } else if (mode === 'slider') {
      effects.push({
        type: 'showSlider',
        prompt: data.prompt || '',
        label: data.sliderConfig?.label || '滑动解锁',
        handleId: 'slider',
      });
    } else if (node.type !== 'interaction' && getVisibleRules(node).length === 0) {
      effects.push({ type: 'showContinue', label: '继续' });
    } else {
      effects.push({
        type: 'showChoices',
        prompt: data.prompt || '',
        choices: getRuntimeChoiceRules(node).map((rule) => ({
          id: rule.id,
          label: rule.condition || rule.keyword || '选项',
          input: rule.condition || rule.keyword || '',
          handleId: rule.handleId || '',
          rule,
        })),
      });
    }
  } else if (!shouldDeferRuntimeControls) {
    effects.push({ type: 'showContinue', label: '继续' });
  }

  const seconds = Math.max(0, Math.floor(Number(data.timeLimit) || 0));
  if (seconds > 0) {
    effects.push({ type: 'startTimer', seconds, key: node.id });
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

  if (type === 'variable.set') {
    return {
      ...state,
      variables: { ...state.variables, [event.key]: event.value },
    };
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
    if (type === 'timeline.clip.timeout' && !interactionClip) return state;
    if (type === 'timeline.clip.timeout' && isQteInteractionClip && currentTimelineTime < (interactionClip.startTime || 0)) return state;
    if (type === 'timeline.clip.timeout' && !isQteInteractionClip && currentTimelineTime < getTimelineClipEndTime(interactionClip)) return state;

    const action = event.action || (type === 'timeline.clip.timeout' ? interactionClip?.timeoutAction : interactionClip?.action);
    if (!action || action.type === 'continue') return state;
    if (action.type === 'pause') return state;
    const targetNodeId = resolveTimelineActionNodeId(currentNode, program.graph.edges, action);
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

  let choice = {};
  let variables = state.variables;

  if (type === 'choice.selected') {
    choice = { input: event.input, handleId: event.handleId };
  } else if (type === 'input.submitted') {
    variables = { ...variables, lastInput: event.value || '' };
    choice = { input: event.value || '' };
  } else if (type === 'slider.unlocked') {
    choice = { input: event.input || 'unlocked', handleId: event.handleId || 'slider' };
  } else if (type === 'navigate') {
    choice = { targetNodeId: event.nodeId };
  }

  const targetNodeId = choice.targetNodeId ?? resolveNextNodeId(currentNode, program.graph.edges, choice);
  const targetNode = getNodeById(program.graph.nodes, targetNodeId);
  if (!targetNode) {
    return {
      ...state,
      status: 'ended',
      currentNodeId: null,
      variables,
      timelineTime: 0,
    };
  }

  return {
    ...state,
    status: 'running',
    currentNodeId: targetNode.id,
    history: [...state.history, targetNode.id],
    variables,
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
  getVisibleRules,
  getOutgoingEdges,
  resolveNextNodeId,
  getNodeById,
  getRuntimeInteractionMode,
  shouldShowRuntimeControls,
  getRuntimeChoiceRules,
  isTimelineMediaClipType,
  isTimelineInteractionClipType,
  getTimelineTracks,
  getTimelineClips,
  getTimelineMediaClips,
  getTimelineInteractionClips,
  getTimelineClipEndTime,
  isTimelineClipActive,
  resolveTimelineClipKeyframes,
  getActiveTimelineClips,
  getActiveTimelineMediaClips,
  clampRuntimeTimelineTime,
  getTimelineDuration,
  compileNodeTimeline,
  resolveTimelineActionNodeId,
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
  const getVisibleRules = ${getVisibleRules.toString()};
  const getOutgoingEdges = ${getOutgoingEdges.toString()};
  const resolveNextNodeId = ${resolveNextNodeId.toString()};
  const getNodeById = ${getNodeById.toString()};
  const getRuntimeInteractionMode = ${getRuntimeInteractionMode.toString()};
  const shouldShowRuntimeControls = ${shouldShowRuntimeControls.toString()};
  const getRuntimeChoiceRules = ${getRuntimeChoiceRules.toString()};
  const isTimelineMediaClipType = ${isTimelineMediaClipType.toString()};
  const isTimelineInteractionClipType = ${isTimelineInteractionClipType.toString()};
  const getTimelineTracks = ${getTimelineTracks.toString()};
  const getVisibleTimelineTracks = ${getVisibleTimelineTracks.toString()};
  const getTimelineClips = ${getTimelineClips.toString()};
  const getVisibleTimelineClips = ${getVisibleTimelineClips.toString()};
  const getTimelineMediaClips = ${getTimelineMediaClips.toString()};
  const getTimelineInteractionClips = ${getTimelineInteractionClips.toString()};
  const getTimelineClipEndTime = ${getTimelineClipEndTime.toString()};
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
  const resolveTimelineActionNodeId = ${resolveTimelineActionNodeId.toString()};
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
    getVisibleRules,
    getOutgoingEdges,
    resolveNextNodeId,
    getNodeById,
    getRuntimeInteractionMode,
    shouldShowRuntimeControls,
    getRuntimeChoiceRules,
    isTimelineMediaClipType,
    isTimelineInteractionClipType,
    getTimelineTracks,
    getVisibleTimelineTracks,
    getTimelineClips,
    getVisibleTimelineClips,
    getTimelineMediaClips,
    getTimelineInteractionClips,
    getTimelineClipEndTime,
    isTimelineClipActive,
    resolveTimelineClipKeyframes,
    getActiveTimelineClips,
    getActiveTimelineMediaClips,
    clampRuntimeTimelineTime,
    getTimelineDuration,
    compileNodeTimeline,
    resolveTimelineActionNodeId,
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
