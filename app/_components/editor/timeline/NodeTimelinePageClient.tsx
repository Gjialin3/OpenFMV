'use client';

import React from 'react';
import dynamic from 'next/dynamic';

import EditorLoading from '@/app/_components/editor/EditorLoading';

const NodeTimelinePage = dynamic(() => import('./NodeTimelinePage'), {
  ssr: false,
  loading: () => <EditorLoading />,
});

export default function NodeTimelinePageClient() {
  return <NodeTimelinePage />;
}
