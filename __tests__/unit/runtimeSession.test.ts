import { create } from 'zustand';
import { describe, expect, it } from 'vitest';

import { AppNode, OpenFMVGraph } from '@/app/_types';
import { createRuntimeSessionStateCreator, RuntimeSessionState } from '@/app/_features/runtime-session/store';

const timelineNode: AppNode = {
  id: 'start-node',
  type: 'start',
  position: { x: 0, y: 0 },
  data: {
    type: 'start',
    label: 'Start',
    timeline: {
      version: 2,
      duration: 4,
      bookmarks: [],
      tracks: [
        {
          id: 'interaction-track',
          type: 'interaction',
          name: 'Interactions',
          clips: [
            {
              id: 'button-1',
              type: 'button',
              label: 'Continue',
              startTime: 0,
              duration: 2,
              rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
              pauseOnShow: false,
              enabled: true,
            },
          ],
        },
      ],
    },
  },
};

const graph: OpenFMVGraph = {
  nodes: [timelineNode],
  edges: [],
};

const createTestStore = () => create<RuntimeSessionState>()(createRuntimeSessionStateCreator());

describe('RuntimeSession', () => {
  it('starts runtime from a detached graph snapshot', () => {
    const store = createTestStore();
    const mutableGraph: OpenFMVGraph = JSON.parse(JSON.stringify(graph));

    store.getState().start(mutableGraph, { entryNodeId: 'start-node' });
    mutableGraph.nodes[0].data = { type: 'start', label: 'Mutated after preview start' };
    store.getState().dispatch({ type: 'restart' });

    expect(store.getState().snapshot?.currentNode?.data).toEqual(timelineNode.data);
  });

  it('does not publish snapshot updates for redundant timeline time events', () => {
    const store = createTestStore();
    store.getState().start(graph, { entryNodeId: 'start-node' });
    const firstSnapshot = store.getState().snapshot;

    const redundantSnapshot = store.getState().dispatch({ type: 'timeline.time.update', time: 0.01 });

    expect(redundantSnapshot).toBe(firstSnapshot);
    expect(store.getState().snapshot).toBe(firstSnapshot);
    expect(store.getState().snapshotVersion).toBe(1);
  });

  it('does not publish snapshot updates for runtime no-op events', () => {
    const store = createTestStore();
    store.getState().start(graph, { entryNodeId: 'start-node' });
    const firstSnapshot = store.getState().snapshot;

    const nextSnapshot = store.getState().dispatch({ type: 'timeline.clip.triggered', clipId: 'button-1' });

    expect(nextSnapshot).toBe(firstSnapshot);
    expect(store.getState().snapshot).toBe(firstSnapshot);
    expect(store.getState().snapshotVersion).toBe(1);
  });
});
