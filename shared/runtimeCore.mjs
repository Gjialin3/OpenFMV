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

export function getTimelineClips(node) {
  const tracks = Array.isArray(node?.data?.timeline?.tracks) ? node.data.timeline.tracks : [];
  return tracks.flatMap((track) => Array.isArray(track.clips) ? track.clips : []).filter((clip) => clip && clip.enabled !== false);
}

export function getTimelineClipEndTime(clip) {
  const endTime = Number(clip?.endTime);
  if (Number.isFinite(endTime) && endTime > Number(clip?.startTime || 0)) return endTime;
  return Number(clip?.startTime || 0) + 0.1;
}

export function isTimelineClipActive(clip, time) {
  const startTime = Number(clip?.startTime);
  if (!Number.isFinite(startTime) || clip?.enabled === false) return false;
  return time >= startTime && time <= getTimelineClipEndTime(clip);
}

export function getActiveTimelineClips(node, time) {
  return getTimelineClips(node).filter((clip) => isTimelineClipActive(clip, Number(time) || 0));
}

export function resolveTimelineActionNodeId(node, edges, action = {}) {
  if (!action || action.type === 'continue' || action.type === 'setVariable') return null;
  if (action.type === 'goToNode') return action.nodeId || null;
  if (action.type === 'goToHandle') return resolveNextNodeId(node, edges, { handleId: action.handleId || undefined });
  return null;
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
  return {
    status: currentNodeId ? 'running' : 'ended',
    currentNodeId,
    history: currentNodeId ? [currentNodeId] : [],
    variables: { ...(seed.variables || {}) },
  };
}

export function buildNodeEffects(node, edges) {
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

  if (data.video) {
    effects.push({
      type: 'playMedia',
      mediaType: 'video',
      src: data.video,
      playbackId: data.videoPlaybackId,
      poster: data.videoThumbnail,
    });
  } else if (data.image) {
    effects.push({
      type: 'playMedia',
      mediaType: 'image',
      src: data.image,
    });
  }

  const timelineClips = getTimelineClips(node);
  if (timelineClips.length > 0) {
    effects.push({
      type: 'timelineOverlay',
      nodeId: node.id,
      clips: timelineClips,
    });
  }

  if (node.type === 'end') {
    effects.push({ type: 'showRestart' });
    return effects;
  }

  if (shouldShowRuntimeControls(node, edges)) {
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
  } else {
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
  return {
    status: state.status,
    currentNodeId: state.currentNodeId,
    currentNode: node,
    history: [...state.history],
    variables: { ...state.variables },
    effects: buildNodeEffects(node, program.graph.edges),
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
  } else if (type === 'timeline.clip.triggered' || type === 'timeline.clip.timeout') {
    const clip = getTimelineClips(currentNode).find((item) => item.id === event.clipId);
    const action = event.action || (type === 'timeline.clip.timeout' ? clip?.timeoutAction : clip?.action);
    if (!action || action.type === 'continue') {
      return { ...state, variables };
    }
    if (action.type === 'setVariable' && action.key) {
      return {
        ...state,
        variables: { ...variables, [action.key]: action.value },
      };
    }
    choice = { targetNodeId: resolveTimelineActionNodeId(currentNode, program.graph.edges, action) };
  }

  const targetNodeId = choice.targetNodeId ?? resolveNextNodeId(currentNode, program.graph.edges, choice);
  const targetNode = getNodeById(program.graph.nodes, targetNodeId);
  if (!targetNode) {
    return {
      ...state,
      status: 'ended',
      currentNodeId: null,
      variables,
    };
  }

  return {
    ...state,
    status: 'running',
    currentNodeId: targetNode.id,
    history: [...state.history, targetNode.id],
    variables,
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
  getTimelineClips,
  getTimelineClipEndTime,
  isTimelineClipActive,
  getActiveTimelineClips,
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
  const getTimelineClips = ${getTimelineClips.toString()};
  const getTimelineClipEndTime = ${getTimelineClipEndTime.toString()};
  const isTimelineClipActive = ${isTimelineClipActive.toString()};
  const getActiveTimelineClips = ${getActiveTimelineClips.toString()};
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
    getTimelineClips,
    getTimelineClipEndTime,
    isTimelineClipActive,
    getActiveTimelineClips,
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
