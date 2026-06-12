'use client';

import React from 'react';
import dynamic from 'next/dynamic';

import PlayerOverlay from '@/app/_components/player/PlayerOverlay';
import TopBar from './TopBar';

const EditorCanvas = dynamic(() => import('./EditorCanvas'), {
  ssr: false,
  loading: () => null,
});

export default function EditorPageClient({ projectId }: { projectId?: string }) {
  return (
    <main className="openfmv-editor-shell relative h-full w-full overflow-hidden bg-[#020202]">
      <TopBar />
      <div className="absolute inset-0">
        <EditorCanvas projectId={projectId} />
      </div>
      <PlayerOverlay />
    </main>
  );
}
