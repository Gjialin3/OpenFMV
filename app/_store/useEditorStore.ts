import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Connection,
} from '@xyflow/react';

import { AppNode, AppEdge } from '../_types';
import { addGraphEdge, filterEdgesForNodes } from '../_utils/graphRules';
import {
  isTimelineOutputHandleId,
  syncTimelineOutputEdges,
  updateTimelineOutputActionForConnection,
  updateTimelineOutputActionsForEdges,
  upsertTimelineOutputEdge,
} from '../_utils/timelineOutputEdges';

export type EdgeCurveStyle = 'smoothstep' | 'bezier' | 'straight';

const isQuotaExceededError = (error: unknown) => {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

const createSafeLocalStorage = () => ({
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
      localStorage.removeItem(name);
      try {
        localStorage.setItem(name, value);
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) throw retryError;
      }
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
});

const createInitialNodes = (): AppNode[] => [
  {
    id: 'start-node',
    type: 'start',
    position: { x: 100, y: 100 },
    data: { type: 'start', label: 'Start' },
  },
];

const DEFAULT_AUTO_SAVE_ENABLED = true;

const ensureNodes = (nodes: AppNode[] | undefined): AppNode[] => {
  return Array.isArray(nodes) && nodes.length > 0 ? nodes : createInitialNodes();
};

const getSelectedNode = (nodes: AppNode[], selectedNodeId: string | null) => {
  return selectedNodeId ? (nodes.find((node) => node.id === selectedNodeId) ?? null) : null;
};

interface EditorState {
  nodes: AppNode[];
  edges: AppEdge[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  addNode: (node: AppNode) => void;
  addNodeAndConnect: (node: AppNode, connection: Connection) => void;
  updateNodeData: (id: string, data: Partial<AppNode['data']>) => void;
  removeNode: (id: string) => void;
  selectedNodeId: string | null;
  selectedNode: AppNode | null;
  setSelectedNodeId: (id: string | null) => void;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  reset: () => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  isAssetPickerOpen: boolean;
  setAssetPickerOpen: (isOpen: boolean) => void;
  targetNodeIdForAsset: string | null;
  setTargetNodeIdForAsset: (id: string | null) => void;
  edgeCurveStyle: EdgeCurveStyle;
  setEdgeCurveStyle: (style: EdgeCurveStyle) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      nodes: createInitialNodes(),
      edges: [],
      selectedNodeId: null,
      selectedNode: null,
      currentProjectId: null,
      autoSaveEnabled: DEFAULT_AUTO_SAVE_ENABLED,
      isAssetPickerOpen: false,
      targetNodeIdForAsset: null,
      edgeCurveStyle: 'bezier',

      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setAssetPickerOpen: (isOpen) => set({ isAssetPickerOpen: isOpen }),
      setTargetNodeIdForAsset: (id) => set({ targetNodeIdForAsset: id }),
      setEdgeCurveStyle: (style) => set({ edgeCurveStyle: style }),
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setNodes: (nodes) => {
        const ensuredNodes = ensureNodes(nodes);
        const edges = syncTimelineOutputEdges(ensuredNodes, filterEdgesForNodes(get().edges, ensuredNodes));
        set({ nodes: ensuredNodes, edges, selectedNode: getSelectedNode(ensuredNodes, get().selectedNodeId) });
      },
      setEdges: (edges) => {
        const { nodes, edges: previousEdges, selectedNodeId } = get();
        const filteredEdges = filterEdgesForNodes(edges, nodes);
        const nextNodes = updateTimelineOutputActionsForEdges(nodes, previousEdges, filteredEdges);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, filteredEdges),
          selectedNode: getSelectedNode(nextNodes, selectedNodeId),
        });
      },

      onNodesChange: (changes) => {
        const { edges: previousEdges, selectedNodeId } = get();
        const nodes = applyNodeChanges(changes, get().nodes) as AppNode[];
        const filteredEdges = filterEdgesForNodes(previousEdges, nodes);
        const nextNodes = updateTimelineOutputActionsForEdges(nodes, previousEdges, filteredEdges);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, filteredEdges),
          selectedNode: getSelectedNode(nextNodes, selectedNodeId),
        });
      },

      onEdgesChange: (changes) => {
        const { nodes, edges: previousEdges, selectedNodeId } = get();
        const filteredEdges = filterEdgesForNodes(applyEdgeChanges(changes, previousEdges) as AppEdge[], nodes);
        const nextNodes = updateTimelineOutputActionsForEdges(nodes, previousEdges, filteredEdges);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, filteredEdges),
          selectedNode: getSelectedNode(nextNodes, selectedNodeId),
        });
      },

      onConnect: (connection) => {
        const { nodes, edges, selectedNodeId } = get();
        const nextNodes = updateTimelineOutputActionForConnection(nodes, connection);
        const nextEdges = isTimelineOutputHandleId(connection.sourceHandle)
          ? upsertTimelineOutputEdge(connection, edges, nextNodes)
          : addGraphEdge(connection, edges, nextNodes);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, nextEdges),
          selectedNode: getSelectedNode(nextNodes, selectedNodeId),
        });
      },

      addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
      },

      addNodeAndConnect: (node, connection) => {
        const { nodes, edges, selectedNodeId } = get();
        if (isTimelineOutputHandleId(connection.sourceHandle)) {
          const nodesWithNewNode = [...nodes, node];
          const nextNodes = updateTimelineOutputActionForConnection(nodesWithNewNode, connection);
          set({
            nodes: nextNodes,
            edges: syncTimelineOutputEdges(nextNodes, upsertTimelineOutputEdge(connection, edges, nextNodes)),
            selectedNode: getSelectedNode(nextNodes, selectedNodeId),
          });
          return;
        }

        const nextEdges = addGraphEdge(connection, edges, [...nodes, node]);
        if (nextEdges === edges) return;
        const nextNodes = updateTimelineOutputActionForConnection([...nodes, node], connection);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, nextEdges),
          selectedNode: getSelectedNode(nextNodes, selectedNodeId),
        });
      },

      updateNodeData: (id, data) => {
        const { selectedNodeId } = get();
        const updatedNodes = get().nodes.map((node) => {
          if (node.id !== id) return node;
          return {
            ...node,
            data: { ...node.data, ...data } as AppNode['data'],
          };
        });
        set({
          nodes: updatedNodes,
          edges: syncTimelineOutputEdges(updatedNodes, get().edges),
          selectedNode: getSelectedNode(updatedNodes, selectedNodeId),
        });
      },

      removeNode: (id) => {
        const { edges, selectedNodeId } = get();
        const nodes = get().nodes.filter((node) => node.id !== id);
        const filteredEdges = edges.filter((edge) => edge.source !== id && edge.target !== id);
        const nextNodes = updateTimelineOutputActionsForEdges(nodes, edges, filteredEdges);
        set({
          nodes: nextNodes,
          edges: syncTimelineOutputEdges(nextNodes, filteredEdges),
          ...(selectedNodeId === id ? { selectedNodeId: null, selectedNode: null } : {}),
          ...(selectedNodeId !== id ? { selectedNode: getSelectedNode(nextNodes, selectedNodeId) } : {}),
        });
      },

      setSelectedNodeId: (id) => {
        const selectedNode = id ? (get().nodes.find((node) => node.id === id) ?? null) : null;
        set({ selectedNodeId: id, selectedNode });
      },

      reset: () => {
        set({
          nodes: createInitialNodes(),
          edges: [],
          selectedNodeId: null,
          selectedNode: null,
          currentProjectId: null,
        });
      },
    }),
    {
      name: 'openfmv-editor-storage',
      version: 2,
      storage: createJSONStorage(createSafeLocalStorage),
      partialize: (state) => ({
        autoSaveEnabled: state.autoSaveEnabled,
        currentProjectId: state.currentProjectId,
        edgeCurveStyle: state.edgeCurveStyle,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<EditorState>;
        return {
          autoSaveEnabled: state.autoSaveEnabled ?? DEFAULT_AUTO_SAVE_ENABLED,
          currentProjectId: state.currentProjectId,
          edgeCurveStyle: state.edgeCurveStyle,
        };
      },
      merge: (persistedState, currentState) => {
        const state = { ...currentState, ...(persistedState as Partial<EditorState>) };
        const nodes = ensureNodes(state.nodes);
        const edges = syncTimelineOutputEdges(nodes, filterEdgesForNodes(state.edges, nodes));
        return {
          ...state,
          nodes,
          edges,
          selectedNodeId: null,
          selectedNode: null,
        };
      },
    }
  )
);
