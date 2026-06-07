import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useEditorStore } from '@/app/_store/useEditorStore';
import { AppNode, AppEdge, NodeTimeline } from '@/app/_types';
import { getTimelineClipOutputHandleId } from '@/app/_utils/timelineOutputEdges';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware');
  return {
    ...actual,
    persist: vi.fn((fn) => fn),
    createJSONStorage: vi.fn(() => ({
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })),
  };
});

const storyNode = (id: string, x = 200): AppNode => ({
  id,
  type: 'story',
  position: { x, y: 200 },
  data: { type: 'story', title: id, content: '' },
});

const buttonTimeline = (nodeId?: string | null): NodeTimeline => ({
  version: 2,
  duration: 10,
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
          label: 'Choice',
          name: 'Choice',
          startTime: 0,
          duration: 4,
          rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
          action: nodeId ? { type: 'goToNode', nodeId } : { type: 'continue' },
          pauseOnShow: false,
          enabled: true,
        },
      ],
    },
  ],
});

const getStartButtonAction = () => {
  const startNode = useEditorStore.getState().nodes.find((node) => node.id === 'start-node');
  const clip = startNode?.data.timeline?.tracks[0]?.clips[0];
  return clip && 'action' in clip ? clip.action : null;
};

describe('group', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  describe('group', () => {
    it('works', () => {
      const node = storyNode('test-node-1');

      useEditorStore.getState().addNode(node);

      expect(useEditorStore.getState().nodes).toHaveLength(2);
      expect(useEditorStore.getState().nodes[1]).toEqual(node);
    });

    it('works', () => {
      useEditorStore.getState().updateNodeData('start-node', { label: 'Updated Start' });

      const updatedNode = useEditorStore.getState().nodes.find((node) => node.id === 'start-node');
      expect(updatedNode?.data).toMatchObject({ label: 'Updated Start' });
    });

    it('works', () => {
      const node = storyNode('node-1');
      useEditorStore.getState().addNode(node);
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'node-1',
        sourceHandle: null,
        targetHandle: null,
      });

      useEditorStore.getState().removeNode('node-1');

      expect(useEditorStore.getState().nodes).toHaveLength(1);
      expect(useEditorStore.getState().edges).toHaveLength(0);
    });
  });

  describe('group', () => {
    beforeEach(() => {
      useEditorStore.getState().addNode(storyNode('target-1'));
      useEditorStore.getState().addNode(storyNode('target-2', 300));
    });

    it('works', () => {
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'target-1',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });

      const edges = useEditorStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        source: 'start-node',
        target: 'target-1',
        sourceHandle: 'handle-1',
      });
    });

    it('works', () => {
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'target-1',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'target-2',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });

      const edges = useEditorStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].target).toBe('target-1');
    });

    it('works', () => {
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'target-1',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'target-2',
        sourceHandle: 'handle-2',
        targetHandle: null,
      });

      expect(useEditorStore.getState().edges).toHaveLength(2);
    });

    it('works', () => {
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'start-node',
        sourceHandle: null,
        targetHandle: null,
      });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'missing',
        sourceHandle: 'missing',
        targetHandle: null,
      });

      expect(useEditorStore.getState().edges).toHaveLength(0);
    });
  });

  describe('group', () => {
    it('works', () => {
      useEditorStore.getState().setSelectedNodeId('start-node');

      const state = useEditorStore.getState();
      expect(state.selectedNodeId).toBe('start-node');
      expect(state.selectedNode?.id).toBe('start-node');
    });

    it('works', () => {
      useEditorStore.getState().setSelectedNodeId('start-node');
      useEditorStore.getState().setSelectedNodeId(null);

      expect(useEditorStore.getState().selectedNodeId).toBeNull();
      expect(useEditorStore.getState().selectedNode).toBeNull();
    });

    it('works', () => {
      useEditorStore.getState().setSelectedNodeId('non-existent');

      expect(useEditorStore.getState().selectedNodeId).toBe('non-existent');
      expect(useEditorStore.getState().selectedNode).toBeNull();
    });
  });

  describe('group', () => {
    it('works', () => {
      useEditorStore.getState().setCurrentProjectId('project-123');
      expect(useEditorStore.getState().currentProjectId).toBe('project-123');
    });

    it('works', () => {
      useEditorStore.getState().setCurrentProjectId('project-123');
      useEditorStore.getState().setCurrentProjectId(null);
      expect(useEditorStore.getState().currentProjectId).toBeNull();
    });
  });

  describe('group', () => {
    it('works', () => {
      useEditorStore.getState().setNodes([]);

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].type).toBe('start');
      expect(state.nodes[0].data).toMatchObject({ label: 'Start' });
    });

    it('works', () => {
      useEditorStore.getState().addNode(storyNode('node-1'));
      useEditorStore.getState().setEdges([
        { id: 'valid', source: 'start-node', target: 'node-1' },
        { id: 'invalid', source: 'start-node', target: 'missing' },
      ] as AppEdge[]);

      useEditorStore.getState().setNodes([useEditorStore.getState().nodes[0]]);

      expect(useEditorStore.getState().edges).toHaveLength(0);
    });

    it('works', () => {
      const node = storyNode('new-node', 300);

      useEditorStore.getState().addNodeAndConnect(node, {
        source: 'start-node',
        target: 'new-node',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toHaveLength(1);
      expect(state.nodes[1].id).toBe('new-node');
      expect(state.edges[0].target).toBe('new-node');
    });

    it('works', () => {
      useEditorStore.getState().addNodeAndConnect(storyNode('node-1'), {
        source: 'start-node',
        target: 'node-1',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });
      useEditorStore.getState().addNodeAndConnect(storyNode('node-2'), {
        source: 'start-node',
        target: 'node-2',
        sourceHandle: 'handle-1',
        targetHandle: null,
      });

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].target).toBe('node-1');
    });
  });

  describe('group', () => {
    it('works', () => {
      useEditorStore.getState().addNode(storyNode('test-node'));
      useEditorStore.getState().setSelectedNodeId('start-node');
      useEditorStore.getState().setCurrentProjectId('project-123');
      useEditorStore.getState().onConnect({
        source: 'start-node',
        target: 'test-node',
        sourceHandle: null,
        targetHandle: null,
      });

      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(0);
      expect(state.selectedNodeId).toBeNull();
      expect(state.currentProjectId).toBeNull();
    });
  });

  describe('group', () => {
    it('works', () => {
      expect(useEditorStore.getState().isAssetPickerOpen).toBe(false);

      useEditorStore.getState().setAssetPickerOpen(true);
      expect(useEditorStore.getState().isAssetPickerOpen).toBe(true);

      useEditorStore.getState().setAssetPickerOpen(false);
      expect(useEditorStore.getState().isAssetPickerOpen).toBe(false);
    });

    it('works', () => {
      useEditorStore.getState().setTargetNodeIdForAsset('node-123');
      expect(useEditorStore.getState().targetNodeIdForAsset).toBe('node-123');

      useEditorStore.getState().setTargetNodeIdForAsset(null);
      expect(useEditorStore.getState().targetNodeIdForAsset).toBeNull();
    });

    it('works', () => {
      expect(useEditorStore.getState().edgeCurveStyle).toBe('bezier');

      useEditorStore.getState().setEdgeCurveStyle('smoothstep');
      expect(useEditorStore.getState().edgeCurveStyle).toBe('smoothstep');

      useEditorStore.getState().setEdgeCurveStyle('straight');
      expect(useEditorStore.getState().edgeCurveStyle).toBe('straight');
    });

    it('works', () => {
      expect(useEditorStore.getState().autoSaveEnabled).toBe(true);

      useEditorStore.getState().setAutoSaveEnabled(false);
      expect(useEditorStore.getState().autoSaveEnabled).toBe(false);
    });
  });

  describe('timeline output edge sync', () => {
    const handleId = getTimelineClipOutputHandleId('button-1');

    beforeEach(() => {
      useEditorStore.getState().addNode(storyNode('target-1'));
      useEditorStore.getState().addNode(storyNode('target-2', 300));
    });

    it('creates editor edges from timeline goToNode actions', () => {
      useEditorStore.getState().updateNodeData('start-node', { timeline: buttonTimeline('target-1') });

      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0]).toMatchObject({
        source: 'start-node',
        sourceHandle: handleId,
        target: 'target-1',
      });
    });

    it('writes editor connections back to the timeline action', () => {
      useEditorStore.getState().updateNodeData('start-node', { timeline: buttonTimeline() });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        sourceHandle: handleId,
        target: 'target-1',
        targetHandle: null,
      });

      expect(useEditorStore.getState().edges[0]).toMatchObject({ sourceHandle: handleId, target: 'target-1' });
      expect(getStartButtonAction()).toEqual({ type: 'goToNode', nodeId: 'target-1' });
    });

    it('replaces an existing timeline output connection from the same handle', () => {
      useEditorStore.getState().updateNodeData('start-node', { timeline: buttonTimeline() });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        sourceHandle: handleId,
        target: 'target-1',
        targetHandle: null,
      });
      useEditorStore.getState().onConnect({
        source: 'start-node',
        sourceHandle: handleId,
        target: 'target-2',
        targetHandle: null,
      });

      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].target).toBe('target-2');
      expect(getStartButtonAction()).toEqual({ type: 'goToNode', nodeId: 'target-2' });
    });

    it('clears the timeline action when the synced editor edge is removed', () => {
      useEditorStore.getState().updateNodeData('start-node', { timeline: buttonTimeline('target-1') });
      useEditorStore.getState().setEdges([]);

      expect(useEditorStore.getState().edges).toHaveLength(0);
      expect(getStartButtonAction()).toEqual({ type: 'continue' });
    });
  });
});
