'use client';

import React, { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';

import AssetPicker from '@/app/_components/editor/AssetPicker';
import { PickerAsset } from '@/app/_components/editor/canvas/assetBinding';
import TopBar from '@/app/_components/editor/TopBar';
import PlayerOverlay from '@/app/_components/player/PlayerOverlay';
import { createMediaClipFromTimelineAsset, ensureNodeTimeline, insertTimelineClip } from '@/app/_features/node-timeline';
import NodeTimelineEditor, { NodeTimelineAssetRequest } from '@/app/_features/node-timeline/components/NodeTimelineEditor';
import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { useEditorStore } from '@/app/_store/useEditorStore';
import { TimelineMediaClipType } from '@/app/_types';

export default function NodeTimelinePage() {
  const assetsT = useTranslations('assets');
  const [assetRequest, setAssetRequest] = useState<NodeTimelineAssetRequest | null>(null);
  const { nodes, updateNodeTimeline } = useProjectSessionStore(
    useShallow((state) => ({
      nodes: state.nodes,
      updateNodeTimeline: state.updateNodeTimeline,
    }))
  );
  const {
    isAssetPickerOpen,
    setAssetPickerOpen,
  } = useEditorStore(
    useShallow((state) => ({
      isAssetPickerOpen: state.isAssetPickerOpen,
      setAssetPickerOpen: state.setAssetPickerOpen,
    }))
  );

  const handleAssetSelect = useCallback((asset: PickerAsset) => {
    const request = assetRequest;
    const targetNode = request ? nodes.find((node) => node.id === request.nodeId) : null;
    if (!request || !targetNode) {
      setAssetRequest(null);
      setAssetPickerOpen(false);
      return;
    }

    if (asset.type !== 'image' && asset.type !== 'video' && asset.type !== 'audio') {
      alert(assetsT('audioCannotBind'));
      setAssetRequest(null);
      setAssetPickerOpen(false);
      return;
    }

    const clip = createMediaClipFromTimelineAsset({
      type: asset.type as TimelineMediaClipType,
      src: asset.url,
      name: asset.prompt || asset.url,
      assetId: asset.id,
      startTime: request.startTime,
      metadata: asset.metadata,
    });
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline(targetNode.data.timeline),
      clip,
      trackId: request.trackId,
    });
    updateNodeTimeline(targetNode.id, timeline);

    setAssetRequest(null);
    setAssetPickerOpen(false);
  }, [assetRequest, assetsT, nodes, setAssetPickerOpen, updateNodeTimeline]);

  const handleRequestMediaClip = useCallback((request: NodeTimelineAssetRequest) => {
    setAssetRequest(request);
    setAssetPickerOpen(true);
  }, [setAssetPickerOpen]);

  const closeAssetPicker = () => {
    setAssetRequest(null);
    setAssetPickerOpen(false);
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#020202]">
      <TopBar />
      <div className="absolute inset-0">
        <NodeTimelineEditor onRequestMediaClip={handleRequestMediaClip} />
      </div>
      <AssetPicker isOpen={isAssetPickerOpen} onClose={closeAssetPicker} onSelect={handleAssetSelect} allowAudio />
      <PlayerOverlay />
    </main>
  );
}
