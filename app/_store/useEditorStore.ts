import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type EdgeCurveStyle = 'smoothstep' | 'bezier' | 'straight';

const DEFAULT_AUTO_SAVE_ENABLED = true;

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

interface EditorState {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  isAssetPickerOpen: boolean;
  setAssetPickerOpen: (isOpen: boolean) => void;
  targetNodeIdForAsset: string | null;
  setTargetNodeIdForAsset: (id: string | null) => void;
  edgeCurveStyle: EdgeCurveStyle;
  setEdgeCurveStyle: (style: EdgeCurveStyle) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      selectedNodeId: null,
      autoSaveEnabled: DEFAULT_AUTO_SAVE_ENABLED,
      isAssetPickerOpen: false,
      targetNodeIdForAsset: null,
      edgeCurveStyle: 'bezier',

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setAssetPickerOpen: (isOpen) => set({ isAssetPickerOpen: isOpen }),
      setTargetNodeIdForAsset: (id) => set({ targetNodeIdForAsset: id }),
      setEdgeCurveStyle: (style) => set({ edgeCurveStyle: style }),
      reset: () => set({
        selectedNodeId: null,
        isAssetPickerOpen: false,
        targetNodeIdForAsset: null,
      }),
    }),
    {
      name: 'openfmv-editor-storage',
      version: 3,
      storage: createJSONStorage(createSafeLocalStorage),
      partialize: (state) => ({
        autoSaveEnabled: state.autoSaveEnabled,
        edgeCurveStyle: state.edgeCurveStyle,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<EditorState>;
        return {
          autoSaveEnabled: state.autoSaveEnabled ?? DEFAULT_AUTO_SAVE_ENABLED,
          edgeCurveStyle: state.edgeCurveStyle ?? 'bezier',
        };
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<EditorState>),
        selectedNodeId: null,
        isAssetPickerOpen: false,
        targetNodeIdForAsset: null,
      }),
    }
  )
);
