'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const NodeTimelinePage = dynamic(() => import('./NodeTimelinePage'), {
  ssr: false,
  loading: () => null,
});

export default function NodeTimelinePageClient() {
  return <NodeTimelinePage />;
}
