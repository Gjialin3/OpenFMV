import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenFMVAsset, OpenFMVProject } from '@/app/_types';
import { addAssetsToLocalProject, importAssetFromFile, removeAssetFromLocalProject, saveLocalProject } from '@/app/_utils/localProjects';

vi.mock('@/app/_utils/browserAssets', () => ({
  saveBrowserAssetFile: vi.fn(async () => 'openfmv-idb://asset-2'),
}));

const PROJECTS_KEY = 'openfmv-local-projects';

const project: OpenFMVProject = {
  schemaVersion: 1,
  id: 'project-1',
  title: 'Project',
  graphData: {
    nodes: [
      {
        id: 'start-node',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { type: 'start', label: 'Start' },
      },
    ],
    edges: [],
  },
  assets: [
    {
      id: 'asset-1',
      type: 'image',
      name: 'Scene',
      path: 'file:///D:/scene.png',
      relativePath: 'assets/scene.png',
      importedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const nextAsset: OpenFMVAsset = {
  id: 'asset-2',
  type: 'video',
  name: 'Clip',
  path: 'file:///D:/clip.mp4',
  relativePath: 'assets/clip.mp4',
  importedAt: '2026-01-02T00:00:00.000Z',
};

describe('localProjects', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'asset-id'),
    });

    storage = {
      [PROJECTS_KEY]: JSON.stringify([project]),
    };

    const localStorageMock = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
      key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
      get length() {
        return Object.keys(storage).length;
      },
    };

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    Object.defineProperty(window, 'openfmv', {
      configurable: true,
      value: undefined,
    });
  });

  it('adds editor imported assets to the current local project with de-duplication', async () => {
    await addAssetsToLocalProject('project-1', [
      { ...nextAsset, id: 'duplicate-id', path: 'file:///other/scene.png', relativePath: 'assets/scene.png' },
      nextAsset,
    ]);

    const savedProjects = JSON.parse(storage[PROJECTS_KEY]) as OpenFMVProject[];

    expect(savedProjects[0].assets).toHaveLength(2);
    expect(savedProjects[0].assets.map((asset) => asset.id)).toEqual(['asset-1', 'asset-2']);
  });

  it('does not duplicate assets copied from the same original source', async () => {
    storage[PROJECTS_KEY] = JSON.stringify([{
      ...project,
      assets: [
        {
          ...nextAsset,
          id: 'asset-existing',
          path: 'file:///D:/OpenFMV/assets/a.mp4',
          relativePath: 'file:///D:/OpenFMV/assets/a.mp4',
          metadata: { originalPath: 'D:\\media\\clip.mp4', duration: 7.06 },
        },
      ],
    }]);

    await addAssetsToLocalProject('project-1', {
      ...nextAsset,
      id: 'asset-copy',
      path: 'file:///D:/OpenFMV/assets/b.mp4',
      relativePath: 'file:///D:/OpenFMV/assets/b.mp4',
      metadata: { originalPath: 'D:/media/clip.mp4', duration: 7.06 },
    });

    const savedProjects = JSON.parse(storage[PROJECTS_KEY]) as OpenFMVProject[];

    expect(savedProjects[0].assets).toHaveLength(1);
    expect(savedProjects[0].assets[0].id).toBe('asset-existing');
  });

  it('removes an asset from the library without mutating graph timeline clips', async () => {
    storage[PROJECTS_KEY] = JSON.stringify([{
      ...project,
      graphData: {
        ...project.graphData,
        nodes: [
          {
            ...project.graphData.nodes[0],
            data: {
              ...project.graphData.nodes[0].data,
              timeline: {
                version: 2,
                duration: 6,
                zoom: 64,
                bookmarks: [],
                tracks: [
                  {
                    id: 'media-track-main',
                    type: 'media',
                    name: 'Media',
                    clips: [
                      {
                        id: 'clip-1',
                        type: 'image',
                        src: 'assets/scene.png',
                        assetId: 'asset-1',
                        startTime: 0,
                        duration: 6,
                        enabled: true,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    } satisfies OpenFMVProject]);

    await removeAssetFromLocalProject('project-1', 'asset-1');

    const savedProjects = JSON.parse(storage[PROJECTS_KEY]) as OpenFMVProject[];
    const timeline = savedProjects[0].graphData.nodes[0].data.timeline as { tracks: Array<{ clips: Array<{ assetId?: string }> }> };

    expect(savedProjects[0].assets).toEqual([]);
    expect(timeline.tracks[0].clips[0].assetId).toBe('asset-1');
  });

  it('returns editor-resolved native project asset paths while storing raw project-relative paths', async () => {
    const nativeProject: OpenFMVProject = {
      ...project,
      metadata: {
        projectDirectory: 'D:\\OpenFMVProject',
        projectPath: 'D:\\OpenFMVProject\\project.openfmv.json',
      },
      assets: [
        {
          ...nextAsset,
          path: 'assets/videos/clip.mp4',
          relativePath: 'assets/videos/clip.mp4',
          metadata: {
            poster: 'assets/images/poster.jpg',
            thumbnail: 'assets/images/poster.jpg',
          },
        },
      ],
      graphData: {
        nodes: [
          {
            ...project.graphData.nodes[0],
            data: {
              ...project.graphData.nodes[0].data,
              timeline: {
                version: 2,
                duration: 6,
                zoom: 64,
                bookmarks: [],
                tracks: [
                  {
                    id: 'media-track-main',
                    type: 'media',
                    name: 'Media',
                    clips: [
                      {
                        id: 'clip-1',
                        type: 'video',
                        src: 'assets/videos/clip.mp4',
                        poster: 'assets/images/poster.jpg',
                        assetId: 'asset-2',
                        startTime: 0,
                        duration: 6,
                        enabled: true,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      },
    };
    Object.defineProperty(window, 'openfmv', {
      configurable: true,
      value: {
        saveProject: vi.fn(async () => nativeProject),
      },
    });

    const savedProject = await saveLocalProject(project);
    const savedTimeline = savedProject.graphData.nodes[0].data.timeline as { tracks: Array<{ clips: Array<{ src: string; poster?: string }> }> };
    const storedProjects = JSON.parse(storage[PROJECTS_KEY]) as OpenFMVProject[];
    const storedTimeline = storedProjects[0].graphData.nodes[0].data.timeline as { tracks: Array<{ clips: Array<{ src: string; poster?: string }> }> };

    expect(savedProject.assets[0].relativePath).toBe('file:///D:/OpenFMVProject/assets/videos/clip.mp4');
    expect(savedProject.assets[0].metadata?.poster).toBe('file:///D:/OpenFMVProject/assets/images/poster.jpg');
    expect(savedTimeline.tracks[0].clips[0].src).toBe('file:///D:/OpenFMVProject/assets/videos/clip.mp4');
    expect(savedTimeline.tracks[0].clips[0].poster).toBe('file:///D:/OpenFMVProject/assets/images/poster.jpg');
    expect(storedProjects[0].assets[0].relativePath).toBe('assets/videos/clip.mp4');
    expect(storedProjects[0].assets[0].metadata?.poster).toBe('assets/images/poster.jpg');
    expect(storedTimeline.tracks[0].clips[0].src).toBe('assets/videos/clip.mp4');
    expect(storedTimeline.tracks[0].clips[0].poster).toBe('assets/images/poster.jpg');
  });

  it('reads browser video metadata during asset import', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:clip'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName !== 'video') return originalCreateElement(tagName, options);
      const video = {
        duration: 12.345,
        videoWidth: 1920,
        videoHeight: 1080,
        preload: '',
        src: '',
        onloadedmetadata: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        removeAttribute: vi.fn(),
        load: vi.fn(function load(this: { onloadedmetadata: ((event: Event) => void) | null }) {
          this.onloadedmetadata?.(new Event('loadedmetadata'));
        }),
      };
      return video as unknown as HTMLVideoElement;
    }) as typeof document.createElement);

    const asset = await importAssetFromFile(new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' }));

    expect(asset).toMatchObject({
      id: 'asset-id',
      type: 'video',
      name: 'clip.mp4',
      path: 'openfmv-idb://asset-2',
      metadata: {
        duration: 12.345,
        width: 1920,
        height: 1080,
        size: 3,
        mimeType: 'video/mp4',
      },
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');
  });
});
