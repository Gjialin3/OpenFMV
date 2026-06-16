import { describe, expect, it } from 'vitest';

import { AppEdge, AppNode, OpenFMVGraph } from '@/app/_types';
import {
  createRuntime,
  getEntryNodeId,
  getNodeText,
  getNodeTitle,
  getTimelineClipOutputHandleId,
  resolveNextNodeId,
  resolveOutputTargetNodeId,
} from '@/app/_utils/graphRuntime';

const node = (id: string, type: AppNode['type'], data: AppNode['data']): AppNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const startNode = node('start', 'start', { type: 'start', label: 'Start' });
const storyNode = node('story', 'scene', { type: 'scene', title: 'Story', bodyText: 'Scene text' });
const endNode = node('end', 'end', { type: 'end', label: 'Finished' });

const timelineNode = node('timeline', 'scene', {
  type: 'scene',
  title: 'Timeline',
  bodyText: '',
  timeline: {
    version: 2,
    duration: 4,
    bookmarks: [],
    tracks: [
      {
        id: 'interaction-track',
        type: 'interaction',
        name: 'Interaction',
        clips: [
          {
            id: 'button-1',
            type: 'button',
            label: 'Open door',
            startTime: 0,
            duration: 4,
            rect: { x: 0.35, y: 0.7, width: 0.3, height: 0.1 },
            pauseOnShow: false,
            enabled: true,
          },
        ],
      },
    ],
  },
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

  it('routes default continuation only through node:default', () => {
    const edges = [
      { id: 'invalid-old-edge', source: 'story', sourceHandle: 'old-handle', target: 'end' },
      { id: 'default-edge', source: 'story', sourceHandle: 'node:default', target: 'start' },
    ] as AppEdge[];

    expect(resolveNextNodeId(storyNode, edges)).toBe('start');
    expect(resolveNextNodeId(storyNode, edges, { handleId: 'old-handle' })).toBe('end');
    expect(resolveNextNodeId(storyNode, [{ id: 'old', source: 'story', target: 'end' }] as AppEdge[])).toBeNull();
  });

  it('resolves timeline button outputs through graph edges', () => {
    const outputId = getTimelineClipOutputHandleId('button-1');
    const edges = [
      { id: 'button-edge', source: 'timeline', sourceHandle: outputId, target: 'end' },
    ] as AppEdge[];

    expect(outputId).toBe('button:button-1:click');
    expect(resolveOutputTargetNodeId(timelineNode, edges, outputId)).toBe('end');
    expect(resolveOutputTargetNodeId(timelineNode, edges, getTimelineClipOutputHandleId('missing'))).toBeNull();
  });

  it('runs default graph playback through node:default', () => {
    const graph: OpenFMVGraph = {
      nodes: [startNode, storyNode, endNode],
      edges: [
        { id: 'start-edge', source: 'start', sourceHandle: 'node:default', target: 'story' },
        { id: 'finish-edge', source: 'story', sourceHandle: 'node:default', target: 'end' },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'start' });

    const start = runtime.start();
    expect(start.currentNodeId).toBe('start');
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'showContinue', targetNodeId: 'story' }));

    const story = runtime.dispatch({ type: 'continue' });
    expect(story.currentNodeId).toBe('story');
    expect(story.history).toEqual(['start', 'story']);

    const finished = runtime.dispatch({ type: 'continue' });
    expect(finished.currentNodeId).toBe('end');
    expect(finished.effects).toContainEqual(expect.objectContaining({ type: 'showRestart' }));
  });

  it('runs timeline button playback through button output edges', () => {
    const graph: OpenFMVGraph = {
      nodes: [timelineNode, endNode],
      edges: [
        {
          id: 'button-edge',
          source: 'timeline',
          sourceHandle: getTimelineClipOutputHandleId('button-1'),
          target: 'end',
        },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'timeline' });

    const start = runtime.start();
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'timelineOverlay' }));

    const finished = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: 'button-1' });
    expect(finished.currentNodeId).toBe('end');
    expect(finished.history).toEqual(['timeline', 'end']);
  });

  it('ignores stale timeline events from a previous node after navigation', () => {
    const startWithTimeline = node('timeline-start', 'start', {
      type: 'start',
      label: 'Start',
      timeline: {
        version: 2,
        duration: 8,
        bookmarks: [],
        tracks: [],
      },
    });
    const graph: OpenFMVGraph = {
      nodes: [startWithTimeline, storyNode],
      edges: [
        { id: 'to-story', source: 'timeline-start', sourceHandle: 'node:default', target: 'story' },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'timeline-start' });

    runtime.start();
    const story = runtime.dispatch({ type: 'navigate', nodeId: 'story' });
    expect(story.currentNodeId).toBe('story');

    const staleUpdate = runtime.dispatch({ type: 'timeline.time.update', nodeId: 'timeline-start', time: 7 });
    expect(staleUpdate.currentNodeId).toBe('story');
    expect(staleUpdate.timelineTime).toBe(0);

    const staleContinue = runtime.dispatch({ type: 'timeline.clip.triggered', nodeId: 'timeline-start', clipId: 'button-1' });
    expect(staleContinue.currentNodeId).toBe('story');
    expect(staleContinue.timelineTime).toBe(0);
  });
});
