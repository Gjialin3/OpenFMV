'use client';

import React from 'react';

import NodeTimelineEditor, { NodeTimelineAssetRequest } from '@/app/_features/node-timeline/components/NodeTimelineEditor';

export default function NodeTimelinePanel({ onRequestMediaClip }: { onRequestMediaClip: (request: NodeTimelineAssetRequest) => void }) {
  return <NodeTimelineEditor onRequestMediaClip={onRequestMediaClip} />;
}
