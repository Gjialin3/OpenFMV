import { create } from 'zustand';

import { OpenFMVGraph } from '@/app/_types';
import { createRuntime, RuntimeController, RuntimeEvent, RuntimeSnapshot, RuntimeState } from '@/app/_utils/graphRuntime';

export interface RuntimeSessionStartOptions {
  entryNodeId?: string | null;
  initialState?: Partial<RuntimeState>;
}

export interface RuntimeSessionState {
  runtime: RuntimeController | null;
  snapshot: RuntimeSnapshot | null;
  snapshotVersion: number;
  isActive: boolean;
  start: (graph: OpenFMVGraph, options?: RuntimeSessionStartOptions) => RuntimeSnapshot | null;
  dispatch: (event: RuntimeEvent) => RuntimeSnapshot | null;
  stop: () => void;
}

const TIMELINE_UPDATE_EPSILON = 0.02;

const cloneGraph = (graph: OpenFMVGraph): OpenFMVGraph => (
  JSON.parse(JSON.stringify(graph)) as OpenFMVGraph
);

const getSnapshotSignature = (snapshot: RuntimeSnapshot | null) => {
  if (!snapshot) return '';
  return JSON.stringify({
    status: snapshot.status,
    currentNodeId: snapshot.currentNodeId,
    history: snapshot.history,
    variables: snapshot.variables,
    timelineTime: snapshot.timelineTime,
    effects: snapshot.effects,
  });
};

const shouldIgnoreRuntimeEvent = (snapshot: RuntimeSnapshot | null, event: RuntimeEvent) => {
  if (event.type !== 'timeline.time.update') return false;
  if (!snapshot) return false;
  return Number.isFinite(event.time) && Math.abs(event.time - snapshot.timelineTime) <= TIMELINE_UPDATE_EPSILON;
};

export const createRuntimeSessionStateCreator = () => (
  set: (partial: RuntimeSessionState | Partial<RuntimeSessionState> | ((state: RuntimeSessionState) => RuntimeSessionState | Partial<RuntimeSessionState>)) => void,
  get: () => RuntimeSessionState
): RuntimeSessionState => ({
  runtime: null,
  snapshot: null,
  snapshotVersion: 0,
  isActive: false,

  start: (graph, options = {}) => {
    if (graph.nodes.length === 0) {
      set({ runtime: null, snapshot: null, snapshotVersion: 0, isActive: false });
      return null;
    }

    const runtime = createRuntime(cloneGraph(graph), options);
    const snapshot = runtime.start();
    set({
      runtime,
      snapshot,
      snapshotVersion: 1,
      isActive: true,
    });
    return snapshot;
  },

  dispatch: (event) => {
    const current = get();
    if (!current.runtime || !current.snapshot) return current.snapshot;
    if (shouldIgnoreRuntimeEvent(current.snapshot, event)) return current.snapshot;

    const nextSnapshot = current.runtime.dispatch(event);
    if (getSnapshotSignature(nextSnapshot) === getSnapshotSignature(current.snapshot)) {
      return current.snapshot;
    }

    set({
      snapshot: nextSnapshot,
      snapshotVersion: current.snapshotVersion + 1,
      isActive: true,
    });
    return nextSnapshot;
  },

  stop: () => {
    set({
      runtime: null,
      snapshot: null,
      snapshotVersion: 0,
      isActive: false,
    });
  },
});

export const useRuntimeSessionStore = create<RuntimeSessionState>()(
  createRuntimeSessionStateCreator()
);
