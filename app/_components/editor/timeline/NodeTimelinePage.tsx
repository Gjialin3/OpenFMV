'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { AppNode } from '@/app/_types';
import { useEditorStore } from '@/app/_store/useEditorStore';
import AssetPicker from '@/app/_components/editor/AssetPicker';
import PlayerOverlay from '@/app/_components/player/PlayerOverlay';
import TopBar from '@/app/_components/editor/TopBar';
import { getPickerAssetUpdate, PickerAsset } from '@/app/_components/editor/canvas/assetBinding';
import NodeTimelinePanel from './NodeTimelinePanel';

export default function NodeTimelinePage() {
  const assetsT = useTranslations('assets');
  const nodes = useEditorStore((state) => state.nodes);
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const isAssetPickerOpen = useEditorStore((state) => state.isAssetPickerOpen);
  const setAssetPickerOpen = useEditorStore((state) => state.setAssetPickerOpen);
  const targetNodeIdForAsset = useEditorStore((state) => state.targetNodeIdForAsset);
  const setTargetNodeIdForAsset = useEditorStore((state) => state.setTargetNodeIdForAsset);

  const handleAssetSelect = useCallback((asset: PickerAsset) => {
    if (!targetNodeIdForAsset) {
      setAssetPickerOpen(false);
      return;
    }

    const targetNode = nodes.find((node) => node.id === targetNodeIdForAsset);
    if (!targetNode) {
      setTargetNodeIdForAsset(null);
      setAssetPickerOpen(false);
      return;
    }

    const update = getPickerAssetUpdate(targetNode, asset);
    if (!update) {
      alert(assetsT('audioCannotBind'));
      return;
    }

    updateNodeData(targetNode.id, update as Partial<AppNode['data']>);
    setTargetNodeIdForAsset(null);
    setAssetPickerOpen(false);
  }, [assetsT, nodes, setAssetPickerOpen, setTargetNodeIdForAsset, targetNodeIdForAsset, updateNodeData]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#020202]">
      <TopBar />
      <div className="absolute inset-x-0 bottom-0 top-14">
        <NodeTimelinePanel />
      </div>
      <PlayerOverlay />

      <AssetPicker
        isOpen={isAssetPickerOpen}
        onClose={() => {
          setAssetPickerOpen(false);
          setTargetNodeIdForAsset(null);
        }}
        onSelect={handleAssetSelect}
      />
    </main>
  );
}
