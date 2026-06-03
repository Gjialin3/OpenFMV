import { describe, expect, it } from 'vitest';

import { AppEdge, AppNode, OpenFMVGraph } from '@/app/_types';
import { createRuntime, getActiveTimelineClips, getEntryNodeId, getNodeText, getNodeTitle, getRuntimeChoiceRules, getRuntimeInteractionMode, getVisibleRules, resolveNextNodeId, resolveTimelineActionNodeId, shouldShowRuntimeControls } from '@/app/_utils/graphRuntime';

const node = (id: string, type: AppNode['type'], data: AppNode['data']): AppNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const startNode = node('start', 'start', { type: 'start', label: 'Start' });
const interactiveStartNode = node('start', 'start', {
  type: 'start',
  label: 'Start',
  rules: [
    { id: 'intro', keyword: 'intro', condition: 'Watch intro', handleId: 'intro' },
    { id: 'skip', keyword: 'skip', condition: 'Skip', handleId: 'skip' },
  ],
});
const storyNode = node('story', 'story', { type: 'story', title: 'Story', content: 'Scene text' });
const interactionNode = node('interaction', 'interaction', {
  type: 'interaction',
  rules: [
    { id: 'first', keyword: 'left', condition: 'Go left', handleId: 'left' },
    { id: 'else', keyword: 'else', condition: 'Else', handleId: 'else' },
  ],
});

describe('graphRuntime', () => {
  it('resolves the preferred entry node when it exists', () => {
    const graph: OpenFMVGraph = { nodes: [startNode, storyNode], edges: [] };

    expect(getEntryNodeId(graph, 'story')).toBe('story');
  });

  it('falls back to the start node and then first node', () => {
    expect(getEntryNodeId({ nodes: [startNode, storyNode], edges: [] })).toBe('start');
    expect(getEntryNodeId({ nodes: [storyNode], edges: [] })).toBe('story');
    expect(getEntryNodeId({ nodes: [], edges: [] })).toBeNull();
  });

  it('normalizes node display text and title for runtime UI', () => {
    expect(getNodeTitle(startNode)).toBe('Start');
    expect(getNodeTitle(storyNode)).toBe('Story');
    expect(getNodeText(storyNode)).toBe('Scene text');
  });

  it('hides else rules from player choices', () => {
    expect(getVisibleRules(interactionNode)).toEqual([
      { id: 'first', keyword: 'left', condition: 'Go left', handleId: 'left' },
    ]);
  });

  it('normalizes shared player control state', () => {
    const edges = [
      { id: 'story-next', source: 'story', target: 'next-target' },
    ] as AppEdge[];

    expect(getRuntimeInteractionMode(interactionNode)).toBe('choice');
    expect(shouldShowRuntimeControls(storyNode, edges)).toBe(true);
    expect(shouldShowRuntimeControls(storyNode, [])).toBe(false);
    expect(getRuntimeChoiceRules(node('empty', 'interaction', { type: 'interaction', rules: [] }))).toEqual([
      { id: 'continue', keyword: '继续', condition: '继续', handleId: '' },
    ]);
  });

  it('prefers exact handle routing over input matching', () => {
    const edges = [
      { id: 'left-edge', source: 'interaction', sourceHandle: 'left', target: 'left-target' },
      { id: 'right-edge', source: 'interaction', sourceHandle: 'right', target: 'right-target' },
    ] as AppEdge[];

    expect(resolveNextNodeId(interactionNode, edges, { input: 'go left', handleId: 'right' })).toBe('right-target');
  });

  it('matches text input to interaction rules and falls back to else', () => {
    const edges = [
      { id: 'left-edge', source: 'interaction', sourceHandle: 'left', target: 'left-target' },
      { id: 'else-edge', source: 'interaction', sourceHandle: 'else', target: 'else-target' },
    ] as AppEdge[];

    expect(resolveNextNodeId(interactionNode, edges, { input: 'I should go left now' })).toBe('left-target');
    expect(resolveNextNodeId(interactionNode, edges, { input: 'unknown' })).toBe('else-target');
  });

  it('routes start node choices through interaction handles', () => {
    const edges = [
      { id: 'intro-edge', source: 'start', sourceHandle: 'intro', target: 'intro-target' },
      { id: 'skip-edge', source: 'start', sourceHandle: 'skip', target: 'skip-target' },
    ] as AppEdge[];

    expect(getVisibleRules(interactiveStartNode)).toHaveLength(2);
    expect(resolveNextNodeId(interactiveStartNode, edges, { handleId: 'skip' })).toBe('skip-target');
    expect(resolveNextNodeId(interactiveStartNode, edges, { input: 'watch intro' })).toBe('intro-target');
  });

  it('falls back to the first outgoing edge when no rule matches', () => {
    const edges = [
      { id: 'first-edge', source: 'story', target: 'first-target' },
      { id: 'second-edge', source: 'story', target: 'second-target' },
    ] as AppEdge[];

    expect(resolveNextNodeId(storyNode, edges)).toBe('first-target');
  });

  it('runs graph playback through the runtime core dispatch loop', () => {
    const graph: OpenFMVGraph = {
      nodes: [
        interactiveStartNode,
        storyNode,
        node('end', 'end', { type: 'end', label: 'Finished' }),
      ],
      edges: [
        { id: 'skip-edge', source: 'start', sourceHandle: 'skip', target: 'story' },
        { id: 'finish-edge', source: 'story', target: 'end' },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'start' });

    const start = runtime.start();
    expect(start.currentNodeId).toBe('start');
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'showChoices' }));

    const story = runtime.dispatch({ type: 'choice.selected', input: 'Skip', handleId: 'skip' });
    expect(story.currentNodeId).toBe('story');
    expect(story.history).toEqual(['start', 'story']);
    expect(story.effects).toContainEqual(expect.objectContaining({ type: 'showContinue' }));

    const finished = runtime.dispatch({ type: 'continue' });
    expect(finished.currentNodeId).toBe('end');
    expect(finished.effects).toContainEqual(expect.objectContaining({ type: 'showRestart' }));
  });

  it('stores text input in runtime variables before resolving routes', () => {
    const graph: OpenFMVGraph = {
      nodes: [
        interactionNode,
        storyNode,
      ],
      edges: [
        { id: 'left-edge', source: 'interaction', sourceHandle: 'left', target: 'story' },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'interaction' });
    runtime.start();

    const snapshot = runtime.dispatch({ type: 'input.submitted', value: 'go left' });

    expect(snapshot.currentNodeId).toBe('story');
    expect(snapshot.variables.lastInput).toBe('go left');
  });

  it('builds timeline overlay effects and filters active clips by video time', () => {
    const timelineNode = node('timeline', 'story', {
      type: 'story',
      title: 'Timeline',
      content: '',
      video: 'scene.mp4',
      timeline: {
        version: 1,
        tracks: [
          {
            id: 'interaction-track',
            type: 'interaction',
            name: 'Interaction',
            clips: [
              {
                id: 'clip-a',
                type: 'button',
                label: 'Go',
                startTime: 2,
                endTime: 5,
                rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
                action: { type: 'goToHandle', handleId: 'go' },
                pauseOnShow: true,
                enabled: true,
              },
              {
                id: 'clip-disabled',
                type: 'hotspot',
                startTime: 2,
                endTime: 5,
                rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                action: { type: 'continue' },
                showHint: true,
                pauseOnShow: false,
                enabled: false,
              },
            ],
          },
        ],
      },
    });
    const runtime = createRuntime({ nodes: [timelineNode], edges: [] }, { entryNodeId: 'timeline' });

    const snapshot = runtime.start();
    const timelineEffect = snapshot.effects.find((effect) => effect.type === 'timelineOverlay');

    expect(timelineEffect).toEqual(expect.objectContaining({ type: 'timelineOverlay', nodeId: 'timeline' }));
    expect(getActiveTimelineClips(timelineNode, 3).map((clip) => clip.id)).toEqual(['clip-a']);
    expect(getActiveTimelineClips(timelineNode, 6)).toEqual([]);
  });

  it('routes timeline clip actions through current node handles', () => {
    const timelineNode = node('timeline', 'story', {
      type: 'story',
      title: 'Timeline',
      content: '',
      video: 'scene.mp4',
      timeline: {
        version: 1,
        tracks: [
          {
            id: 'interaction-track',
            type: 'interaction',
            name: 'Interaction',
            clips: [
              {
                id: 'clip-go',
                type: 'button',
                label: 'Go',
                startTime: 0,
                endTime: 4,
                rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
                action: { type: 'goToHandle', handleId: 'go' },
                pauseOnShow: true,
                enabled: true,
              },
              {
                id: 'clip-continue',
                type: 'pauseGate',
                label: 'Continue',
                startTime: 5,
                endTime: 6,
                action: { type: 'continue' },
                resumeOnClick: true,
                enabled: true,
              },
            ],
          },
        ],
      },
    });
    const targetNode = node('target', 'story', { type: 'story', title: 'Target', content: '' });
    const edges = [
      { id: 'go-edge', source: 'timeline', sourceHandle: 'go', target: 'target' },
    ] as AppEdge[];
    const runtime = createRuntime({ nodes: [timelineNode, targetNode], edges }, { entryNodeId: 'timeline' });

    runtime.start();

    expect(resolveTimelineActionNodeId(timelineNode, edges, { type: 'goToHandle', handleId: 'go' })).toBe('target');
    expect(runtime.dispatch({ type: 'timeline.clip.triggered', clipId: 'clip-continue' }).currentNodeId).toBe('timeline');
    expect(runtime.dispatch({ type: 'timeline.clip.triggered', clipId: 'clip-go' }).currentNodeId).toBe('target');
  });
});
