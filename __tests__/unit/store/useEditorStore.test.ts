import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore } from '@/app/_store/useEditorStore';

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

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().setAutoSaveEnabled(true);
    useEditorStore.getState().setEdgeCurveStyle('bezier');
    useEditorStore.getState().reset();
  });

  it('tracks the selected node id without owning graph data', () => {
    useEditorStore.getState().setSelectedNodeId('start-node');

    expect(useEditorStore.getState().selectedNodeId).toBe('start-node');

    useEditorStore.getState().setSelectedNodeId(null);
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });

  it('tracks asset picker UI state', () => {
    useEditorStore.getState().setAssetPickerOpen(true);
    useEditorStore.getState().setTargetNodeIdForAsset('node-123');

    expect(useEditorStore.getState().isAssetPickerOpen).toBe(true);
    expect(useEditorStore.getState().targetNodeIdForAsset).toBe('node-123');

    useEditorStore.getState().reset();
    expect(useEditorStore.getState().isAssetPickerOpen).toBe(false);
    expect(useEditorStore.getState().targetNodeIdForAsset).toBeNull();
  });

  it('tracks editor preferences', () => {
    expect(useEditorStore.getState().autoSaveEnabled).toBe(true);
    expect(useEditorStore.getState().edgeCurveStyle).toBe('bezier');

    useEditorStore.getState().setAutoSaveEnabled(false);
    useEditorStore.getState().setEdgeCurveStyle('straight');

    expect(useEditorStore.getState().autoSaveEnabled).toBe(false);
    expect(useEditorStore.getState().edgeCurveStyle).toBe('straight');
  });
});
