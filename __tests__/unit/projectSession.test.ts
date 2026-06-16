import { create } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEdge, AppNode, NodeTimeline, OpenFMVProject } from '@/app/_types';
import { getNodeOutputs, getTimelineClipOutputHandleId } from '@/app/_utils/timelineOutputEdges';
import { createProjectSessionStateCreator, ProjectSessionRepository, ProjectSessionState } from '@/app/_features/project-session/store';

const startNode: AppNode = {
  id: 'start-node',
  type: 'start',
  position: { x: 0, y: 0 },
  data: { type: 'start', label: 'Start' },
};

const storyNode: AppNode = {
  id: 'story',
  type: 'scene',
  position: { x: 300, y: 0 },
  data: { type: 'scene', title: 'Story', bodyText: '' },
};

const createSceneNode = (id: string, x = 300): AppNode => ({
  id,
  type: 'scene',
  position: { x, y: 0 },
  data: { type: 'scene', title: id, bodyText: '' },
});

const buttonTimeline = (): NodeTimeline => ({
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
          startTime: 0,
          duration: 4,
          rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
          pauseOnShow: false,
          enabled: true,
        },
      ],
    },
  ],
});

const project: OpenFMVProject = {
  schemaVersion: 1,
  id: 'project-1',
  title: 'Project',
  graphData: {
    nodes: [startNode, storyNode],
    edges: [],
  },
  assets: [],
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const createTestStore = (repository: ProjectSessionRepository) => (
  create<ProjectSessionState>()(createProjectSessionStateCreator(repository))
);

describe('ProjectSession', () => {
  let savedProjects: OpenFMVProject[];
  let repository: ProjectSessionRepository;

  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'generated-id'),
    });
    savedProjects = [{ ...project, graphData: { nodes: [...project.graphData.nodes], edges: [] } }];
    repository = {
      getProject: vi.fn((id) => savedProjects.find((item) => item.id === id) ?? null),
      saveProject: vi.fn(async (nextProject) => {
        savedProjects = savedProjects.map((item) => (item.id === nextProject.id ? nextProject : item));
        return nextProject;
      }),
    };
  });

  it('loads a project as a clean session with matching revision counters', async () => {
    const store = createTestStore(repository);

    await store.getState().loadProject('project-1');

    const state = store.getState();
    expect(state.projectId).toBe('project-1');
    expect(state.title).toBe('Project');
    expect(state.nodes).toEqual([startNode, storyNode]);
    expect(state.edges).toEqual([]);
    expect(state.revision).toBe(0);
    expect(state.savedRevision).toBe(0);
    expect(state.dirty).toBe(false);
    expect(state.status).toBe('ready');
  });

  it('updates a node timeline, prunes invalid output edges, and marks the session dirty', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');

    store.getState().setEdges([
      {
        id: 'stale-edge',
        source: 'start-node',
        sourceHandle: getTimelineClipOutputHandleId('missing-button'),
        target: 'story',
      },
    ] as AppEdge[]);
    store.getState().updateNodeTimeline('start-node', buttonTimeline());

    const state = store.getState();
    expect(state.dirty).toBe(true);
    expect(state.revision).toBe(2);
    expect(state.edges).toHaveLength(0);
  });

  it('runs graph commands through the project session revision boundary', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');

    store.getState().addNode(createSceneNode('next'));
    store.getState().updateNodeData('start-node', { label: 'Updated Start' });
    store.getState().updateNodeTimeline('start-node', buttonTimeline());
    store.getState().onConnect({
      source: 'start-node',
      target: 'next',
      sourceHandle: getTimelineClipOutputHandleId('button-1'),
      targetHandle: null,
    });
    store.getState().removeNode('next');

    const state = store.getState();
    expect(state.nodes.find((node) => node.id === 'start-node')?.data).toMatchObject({ label: 'Updated Start' });
    expect(state.nodes.some((node) => node.id === 'next')).toBe(false);
    expect(state.edges).toHaveLength(0);
    expect(state.revision).toBe(5);
    expect(state.dirty).toBe(true);
  });

  it('only allows connections from derived node outputs', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().addNode(createSceneNode('target-1'));
    store.getState().addNode(createSceneNode('target-2', 600));
    store.getState().updateNodeTimeline('start-node', buttonTimeline());

    store.getState().onConnect({
      source: 'start-node',
      target: 'target-1',
      sourceHandle: getTimelineClipOutputHandleId('button-1'),
      targetHandle: null,
    });
    store.getState().onConnect({
      source: 'start-node',
      target: 'target-2',
      sourceHandle: getTimelineClipOutputHandleId('button-1'),
      targetHandle: null,
    });
    store.getState().onConnect({
      source: 'start-node',
      target: 'target-2',
      sourceHandle: 'invalid-output',
      targetHandle: null,
    });
    store.getState().onConnect({
      source: 'start-node',
      target: 'start-node',
      sourceHandle: null,
      targetHandle: null,
    });

    const edges = store.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ sourceHandle: getTimelineClipOutputHandleId('button-1'), target: 'target-2' });
  });

  it('labels timeline button outputs as success and fail while preserving stable handles', async () => {
    const timeline = buttonTimeline();
    const clip = timeline.tracks[0].clips[0];
    if (clip.type !== 'button') throw new Error('Expected button clip');
    timeline.tracks[0].clips[0] = {
      ...clip,
      mode: 'qte',
    };
    const nodeWithQte = {
      ...startNode,
      data: {
        ...startNode.data,
        timeline,
      },
    } as AppNode;

    const outputs = getNodeOutputs(nodeWithQte);

    expect(outputs.map((output) => ({ id: output.id, label: output.label }))).toEqual([
      { id: 'node:default', label: 'Default' },
      { id: getTimelineClipOutputHandleId('button-1'), label: 'Choice success' },
      { id: getTimelineClipOutputHandleId('button-1', 'timeout'), label: 'Choice fail' },
    ]);
  });

  it('stores timeline output editor connections as edges without mutating button clips', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().addNode(createSceneNode('target-1'));
    store.getState().addNode(createSceneNode('target-2', 600));
    store.getState().updateNodeTimeline('start-node', buttonTimeline());
    const handleId = getTimelineClipOutputHandleId('button-1');

    store.getState().onConnect({
      source: 'start-node',
      sourceHandle: handleId,
      target: 'target-1',
      targetHandle: null,
    });
    store.getState().onConnect({
      source: 'start-node',
      sourceHandle: handleId,
      target: 'target-2',
      targetHandle: null,
    });

    const state = store.getState();
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({ sourceHandle: handleId, target: 'target-2' });
    const clip = state.nodes.find((node) => node.id === 'start-node')?.data.timeline?.tracks[0]?.clips[0];
    expect(clip).not.toHaveProperty('action');
  });

  it('removes timeline output edges without mutating button clips', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().updateNodeTimeline('start-node', buttonTimeline());
    store.getState().onConnect({
      source: 'start-node',
      sourceHandle: getTimelineClipOutputHandleId('button-1'),
      target: 'story',
      targetHandle: null,
    });

    store.getState().setEdges([]);

    const state = store.getState();
    expect(state.edges).toHaveLength(0);
    const clip = state.nodes.find((node) => node.id === 'start-node')?.data.timeline?.tracks[0]?.clips[0];
    expect(clip).not.toHaveProperty('action');
  });

  it('saves the current graph snapshot and marks the current revision clean', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().setTitle('Next title');
    store.getState().updateNodeTimeline('start-node', buttonTimeline());

    const savedProject = await store.getState().saveNow();

    expect(repository.saveProject).toHaveBeenCalledTimes(1);
    expect(savedProject?.title).toBe('Next title');
    expect(savedProject?.graphData.nodes.find((node) => node.id === 'start-node')?.data.timeline).toEqual(buttonTimeline());
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().savedRevision).toBe(store.getState().revision);
  });

  it('preserves assets added outside the active graph session when saving', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().setTitle('Next title');

    savedProjects = savedProjects.map((item) => ({
      ...item,
      assets: [
        {
          id: 'asset-1',
          type: 'video',
          name: 'Imported video',
          path: 'C:\\assets\\video.mp4',
          relativePath: 'assets/video.mp4',
          importedAt: '2026-01-01T00:00:00.000Z',
          metadata: {},
        },
      ],
    }));

    const savedProject = await store.getState().saveNow();

    expect(savedProject?.assets).toHaveLength(1);
    expect(savedProject?.assets[0].id).toBe('asset-1');
  });

  it('can save with an explicit project directory', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().setTitle('Next title');

    const savedProject = await store.getState().saveNow({ projectDirectory: 'D:\\OpenFMV\\Project' });

    expect(savedProject?.metadata.projectDirectory).toBe('D:\\OpenFMV\\Project');
  });

  it('flushes only when the session has pending changes', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');

    await store.getState().flushPendingChanges();
    expect(repository.saveProject).not.toHaveBeenCalled();

    store.getState().setTitle('Changed');
    await store.getState().flushPendingChanges();
    expect(repository.saveProject).toHaveBeenCalledTimes(1);
  });

  it('does not reload and discard dirty state when the active project id is requested again', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');
    store.getState().setTitle('Unsaved title');

    savedProjects = savedProjects.map((item) => ({ ...item, title: 'Disk title' }));
    await store.getState().loadProject('project-1');

    expect(store.getState().title).toBe('Unsaved title');
    expect(store.getState().dirty).toBe(true);
    expect(repository.getProject).toHaveBeenCalledTimes(1);
  });

  it('does not reset a dirty unsaved session when an id-less route mounts again', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject(null);
    store.getState().updateNodeTimeline('start-node', buttonTimeline());

    await store.getState().loadProject(null);

    const state = store.getState();
    expect(state.projectId).toBeNull();
    expect(state.dirty).toBe(true);
    expect(state.nodes.find((node) => node.id === 'start-node')?.data.timeline).toEqual(buttonTimeline());
  });

  it('does not reset an id-less session after autosave creates a project id during navigation', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject(null);
    store.getState().updateNodeTimeline('start-node', buttonTimeline());

    await store.getState().flushPendingChanges();
    await store.getState().loadProject(null);

    const state = store.getState();
    expect(state.projectId).toBe('generated-id');
    expect(state.nodes.find((node) => node.id === 'start-node')?.data.timeline).toEqual(buttonTimeline());
  });

  it('returns a detached graph snapshot for preview runtime startup', async () => {
    const store = createTestStore(repository);
    await store.getState().loadProject('project-1');

    const graph = store.getState().getGraphSnapshot();
    graph.nodes[0].data = { type: 'start', label: 'Mutated preview copy' };

    expect(store.getState().nodes[0].data).toEqual({ type: 'start', label: 'Start' });
  });
});
