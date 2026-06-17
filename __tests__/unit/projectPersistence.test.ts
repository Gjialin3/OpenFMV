import { describe, expect, it, vi } from 'vitest';

import { AppEdge, AppNode, OpenFMVProject } from '@/app/_types';
import { collectProjectAssetsFromGraph, createProjectSnapshot, defaultGraphData, ensureGraphData } from '@/app/_utils/projectPersistence';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'generated-id'),
});

const storyNode: AppNode = {
  id: 'story',
  type: 'scene',
  position: { x: 0, y: 0 },
  data: {
    type: 'scene',
    title: 'Story',
    bodyText: '',
    timeline: {
      version: 2,
      duration: 24,
      bookmarks: [],
      tracks: [
        {
          id: 'media-track',
          type: 'media',
          name: 'Media',
          clips: [{ id: 'scene-clip', type: 'image', src: 'assets/scene.png', startTime: 0, duration: 4, enabled: true }],
        },
      ],
    },
  },
};

describe('projectPersistence', () => {
  it('creates a valid default graph', () => {
    const graph = defaultGraphData();

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe('start');
    expect(graph.edges).toEqual([]);
  });

  it('normalizes empty graphs and removes invalid edges', () => {
    const graph = ensureGraphData({
      nodes: [storyNode],
      edges: [
        { id: 'valid', source: 'story', target: 'story-2' },
        { id: 'self', source: 'story', target: 'story' },
      ] as AppEdge[],
    });

    expect(graph.nodes).toEqual([storyNode]);
    expect(graph.edges).toEqual([]);
    expect(ensureGraphData({ nodes: [], edges: [] }).nodes[0].type).toBe('start');
  });

  it('indexes only media bound to playable graph nodes', () => {
    const assets = collectProjectAssetsFromGraph({ nodes: [storyNode], edges: [] });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      type: 'image',
      name: 'scene.png',
      path: 'assets/scene.png',
    });
  });

  it('indexes button background images from interaction styles', () => {
    const assets = collectProjectAssetsFromGraph({
      nodes: [
        {
          ...storyNode,
          data: {
            ...storyNode.data,
            timeline: {
              version: 2,
              duration: 24,
              bookmarks: [],
              tracks: [
                {
                  id: 'interaction-track',
                  type: 'interaction',
                  name: 'Interaction',
                  clips: [
                    {
                      id: 'choice',
                      type: 'button',
                      startTime: 0,
                      duration: 4,
                      enabled: true,
                      label: 'Choice',
                      rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.1 },
                      pauseOnShow: false,
                      style: { backgroundImageSrc: 'assets/button-background.png' },
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
      edges: [],
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      type: 'image',
      name: 'button-background.png',
      path: 'assets/button-background.png',
    });
  });

  it('does not index transient, remote, data, or unknown asset sources', () => {
    const assets = collectProjectAssetsFromGraph({
      nodes: [
        {
          ...storyNode,
          data: {
            ...storyNode.data,
            timeline: {
              version: 2,
              duration: 24,
              bookmarks: [],
              tracks: [
                {
                  id: 'media-track',
                  type: 'media',
                  name: 'Media',
                  clips: [
                    { id: 'blob-clip', type: 'image', src: 'blob:http://localhost/1', startTime: 0, duration: 4, enabled: true },
                    { id: 'data-clip', type: 'video', src: 'data:video/mp4;base64,AAAA', poster: 'https://example.com/poster.png', startTime: 4, duration: 4, enabled: true },
                  ],
                },
              ],
            },
          },
        },
        {
          ...storyNode,
          id: 'unknown-relative',
          data: {
            ...storyNode.data,
            timeline: {
              version: 2,
              duration: 24,
              bookmarks: [],
              tracks: [
                {
                  id: 'media-track',
                  type: 'media',
                  name: 'Media',
                  clips: [{ id: 'unknown-clip', type: 'image', src: 'scene.png', startTime: 0, duration: 4, enabled: true }],
                },
              ],
            },
          },
        },
      ],
      edges: [],
    });

    expect(assets).toEqual([]);
  });

  it('creates a project snapshot with normalized graph, entry node, cover and existing assets', () => {
    const project: OpenFMVProject = {
      schemaVersion: 1,
      id: 'project',
      title: 'Old',
      graphData: { nodes: [], edges: [] },
      assets: [{ id: 'existing', type: 'image', name: 'Existing', path: 'assets/scene.png', relativePath: 'assets/scene.png', importedAt: '2026-01-01T00:00:00.000Z' }],
      metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const snapshot = createProjectSnapshot(project, 'Next', [storyNode], [], project.assets);

    expect(snapshot.title).toBe('Next');
    expect(snapshot.graphData.nodes).toEqual([storyNode]);
    expect(snapshot.assets).toEqual(project.assets);
    expect(snapshot.metadata.coverImage).toBe('assets/scene.png');
    expect(snapshot.metadata.entryNodeId).toBe('story');
  });
});
