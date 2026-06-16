import { create } from 'zustand';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';

import { AppEdge, AppNode, NodeTimeline, OpenFMVGraph, OpenFMVProject } from '@/app/_types';
import { filterEdgesForNodes } from '@/app/_utils/graphRules';
import { getLocalProject, saveLocalProject } from '@/app/_utils/localProjects';
import { createProjectSnapshot, defaultGraphData, ensureGraphData } from '@/app/_utils/projectPersistence';
import { syncTimelineOutputEdges, upsertTimelineOutputEdge } from '@/app/_utils/timelineOutputEdges';

type MaybePromise<T> = T | Promise<T>;

export interface ProjectSessionSaveOptions {
  projectDirectory?: string;
}

export interface ProjectSessionRepository {
  getProject: (id: string) => MaybePromise<OpenFMVProject | null>;
  saveProject: (project: OpenFMVProject) => MaybePromise<OpenFMVProject>;
}

export type ProjectSessionStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface ProjectSessionState {
  project: OpenFMVProject | null;
  projectId: string | null;
  title: string;
  nodes: AppNode[];
  edges: AppEdge[];
  assets: OpenFMVProject['assets'];
  status: ProjectSessionStatus;
  error: string | null;
  revision: number;
  savedRevision: number;
  dirty: boolean;
  loadProject: (projectId: string | null | undefined) => Promise<void>;
  loadProjectSnapshot: (project: OpenFMVProject | null) => void;
  setTitle: (title: string) => void;
  setGraph: (graph: OpenFMVGraph) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  addNode: (node: AppNode) => void;
  addNodeAndConnect: (node: AppNode, connection: Connection) => void;
  updateNodeData: (id: string, data: Partial<AppNode['data']>) => void;
  updateNodeTimeline: (id: string, timeline: NodeTimeline) => void;
  removeNode: (id: string) => void;
  saveNow: (options?: ProjectSessionSaveOptions) => Promise<OpenFMVProject | null>;
  flushPendingChanges: () => Promise<OpenFMVProject | null>;
  getGraphSnapshot: () => OpenFMVGraph;
  resetSession: () => void;
}

const DEFAULT_TITLE = 'Untitled project';

const cloneGraph = (graph: OpenFMVGraph): OpenFMVGraph => (
  JSON.parse(JSON.stringify(graph)) as OpenFMVGraph
);

const normalizeGraph = (graph?: Partial<OpenFMVGraph> | null): OpenFMVGraph => {
  const normalized = ensureGraphData(graph);
  return {
    nodes: normalized.nodes,
    edges: syncTimelineOutputEdges(normalized.nodes, filterEdgesForNodes(normalized.edges, normalized.nodes)),
  };
};

const createInitialSessionGraph = () => normalizeGraph(defaultGraphData());

const createDirtyPatch = (revision: number) => ({
  revision: revision + 1,
  dirty: true,
});

const createCleanProjectPatch = (project: OpenFMVProject | null) => {
  const graph = normalizeGraph(project?.graphData ?? defaultGraphData());
  return {
    project,
    projectId: project?.id ?? null,
    title: project?.title ?? DEFAULT_TITLE,
    nodes: graph.nodes,
    edges: graph.edges,
    assets: project?.assets ?? [],
    status: 'ready' as const,
    error: null,
    revision: 0,
    savedRevision: 0,
    dirty: false,
  };
};

export const localProjectSessionRepository: ProjectSessionRepository = {
  getProject: (id) => getLocalProject(id),
  saveProject: (project) => saveLocalProject(project),
};

export const createProjectSessionStateCreator = (repository: ProjectSessionRepository) => (
  set: (partial: ProjectSessionState | Partial<ProjectSessionState> | ((state: ProjectSessionState) => ProjectSessionState | Partial<ProjectSessionState>)) => void,
  get: () => ProjectSessionState
): ProjectSessionState => {
  const applyGraph = (nodes: AppNode[], edges: AppEdge[]) => {
    const normalizedGraph = normalizeGraph({ nodes, edges });
    set((state) => ({
      nodes: normalizedGraph.nodes,
      edges: normalizedGraph.edges,
      ...createDirtyPatch(state.revision),
    }));
  };

  return {
    project: null,
    projectId: null,
    title: DEFAULT_TITLE,
    ...createInitialSessionGraph(),
    assets: [],
    status: 'idle',
    error: null,
    revision: 0,
    savedRevision: 0,
    dirty: false,

    loadProject: async (projectId) => {
      if (!projectId) {
        const current = get();
        if (current.status !== 'idle' && current.status !== 'error') return;
        set(createCleanProjectPatch(null));
        return;
      }

      const current = get();
      if (current.projectId === projectId && current.status !== 'idle' && current.status !== 'error') {
        return;
      }

      set({ status: 'loading', error: null });
      try {
        const project = await repository.getProject(projectId);
        set(createCleanProjectPatch(project));
        if (!project) set({ projectId, status: 'ready' });
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to load project',
        });
      }
    },

    loadProjectSnapshot: (project) => {
      set(createCleanProjectPatch(project));
    },

    setTitle: (title) => {
      set((state) => (
        state.title === title
          ? {}
          : {
              title,
              ...createDirtyPatch(state.revision),
            }
      ));
    },

    setGraph: (graph) => {
      applyGraph(graph.nodes, graph.edges);
    },

    setNodes: (nodes) => {
      const current = get();
      const nextNodes = Array.isArray(nodes) && nodes.length > 0 ? nodes : defaultGraphData().nodes;
      applyGraph(nextNodes, filterEdgesForNodes(current.edges, nextNodes));
    },

    setEdges: (edges) => {
      const current = get();
      const filteredEdges = filterEdgesForNodes(edges, current.nodes);
      applyGraph(current.nodes, filteredEdges);
    },

    onNodesChange: (changes) => {
      const current = get();
      const nodes = applyNodeChanges(changes, current.nodes) as AppNode[];
      const filteredEdges = filterEdgesForNodes(current.edges, nodes);
      applyGraph(nodes, filteredEdges);
    },

    onEdgesChange: (changes) => {
      const current = get();
      const filteredEdges = filterEdgesForNodes(applyEdgeChanges(changes, current.edges) as AppEdge[], current.nodes);
      applyGraph(current.nodes, filteredEdges);
    },

    onConnect: (connection) => {
      const current = get();
      const nextEdges = upsertTimelineOutputEdge(connection, current.edges, current.nodes);
      if (nextEdges === current.edges) return;
      applyGraph(current.nodes, nextEdges);
    },

    addNode: (node) => {
      const current = get();
      applyGraph([...current.nodes, node], current.edges);
    },

    addNodeAndConnect: (node, connection) => {
      const current = get();
      const nodesWithNewNode = [...current.nodes, node];

      const nextEdges = upsertTimelineOutputEdge(connection, current.edges, nodesWithNewNode);
      applyGraph(nodesWithNewNode, nextEdges);
    },

    updateNodeData: (id, data) => {
      const current = get();
      const nextNodes = current.nodes.map((node) => (
        node.id === id
          ? { ...node, data: { ...node.data, ...data } as AppNode['data'] }
          : node
      ));
      applyGraph(nextNodes, current.edges);
    },

    updateNodeTimeline: (id, timeline) => {
      get().updateNodeData(id, { timeline });
    },

    removeNode: (id) => {
      const current = get();
      const nodes = current.nodes.filter((node) => node.id !== id);
      const filteredEdges = current.edges.filter((edge) => edge.source !== id && edge.target !== id);
      applyGraph(nodes, filteredEdges);
    },

    saveNow: async (options) => {
      const current = get();
      set({ status: 'saving', error: null });
      try {
        const latestProject = current.projectId ? await repository.getProject(current.projectId) : null;
        const baseProject = latestProject ?? current.project;
        const snapshot = createProjectSnapshot(
          baseProject,
          current.title,
          current.nodes,
          current.edges,
          latestProject?.assets ?? current.assets
        );
        const projectToSave = options?.projectDirectory
          ? {
              ...snapshot,
              metadata: {
                ...snapshot.metadata,
                projectDirectory: options.projectDirectory,
              },
            }
          : snapshot;
        const savedProject = await repository.saveProject(projectToSave);
        const graph = normalizeGraph(savedProject.graphData);
        set((state) => ({
          project: savedProject,
          projectId: savedProject.id,
          title: savedProject.title,
          nodes: graph.nodes,
          edges: graph.edges,
          assets: savedProject.assets ?? [],
          status: 'ready',
          error: null,
          savedRevision: state.revision,
          dirty: false,
        }));
        return savedProject;
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to save project',
        });
        throw error;
      }
    },

    flushPendingChanges: async () => {
      const current = get();
      if (!current.dirty) return current.project;
      return current.saveNow();
    },

    getGraphSnapshot: () => {
      const current = get();
      return cloneGraph({ nodes: current.nodes, edges: current.edges });
    },

    resetSession: () => {
      set({
        ...createCleanProjectPatch(null),
        status: 'idle',
      });
    },
  };
};

export const useProjectSessionStore = create<ProjectSessionState>()(
  createProjectSessionStateCreator(localProjectSessionRepository)
);
