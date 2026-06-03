import React from 'react';
import dynamic from 'next/dynamic';

import EditorLoading from '@/app/_components/editor/EditorLoading';

const NodeTimelinePage = dynamic(() => import('@/app/_components/editor/timeline/NodeTimelinePage'), {
  ssr: false,
  loading: () => <EditorLoading />,
});

export default function NodesPage() {
  return <NodeTimelinePage />;
}
