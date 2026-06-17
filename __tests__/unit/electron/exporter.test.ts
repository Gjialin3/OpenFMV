import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { Script } from 'vm';
import { describe, expect, it } from 'vitest';

import { graphRuntimeFunctionNames } from '@/app/_utils/graphRuntimeCore.mjs';

const require = createRequire(import.meta.url);
const { exportGamePackage, exportWebGamePackage, saveProjectToDirectory } = require('../../../electron/exporter');

const expectExportPlayerScriptToParse = (html: string) => {
  const playerScript = html.split('<script>').at(-1)?.split('</script>')[0] || '';
  expect(playerScript).toContain('const appRoot');
  expect(() => new Script(playerScript)).not.toThrow();
};

describe('game exporter', () => {
  it('exports a playable web package with local graph media rewritten to relative assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-'));
    const sourceImage = join(root, 'source.png');
    await writeFile(sourceImage, Buffer.from([137, 80, 78, 71]));

    const project = {
      schemaVersion: 1,
      id: 'project-1',
      title: 'Offline Game',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
              bodyText: 'Hello local game',
              timeline: {
                version: 2,
                duration: 24,
                bookmarks: [],
                tracks: [
                  {
                    id: 'media-track',
                    type: 'media',
                    name: 'Media',
                    clips: [{ id: 'image-clip', type: 'image', src: pathToFileURL(sourceImage).href, startTime: 0, duration: 4, enabled: true }],
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      },
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          name: 'source.png',
          path: pathToFileURL(sourceImage).href,
          relativePath: pathToFileURL(sourceImage).href,
          importedAt: new Date().toISOString(),
        },
      ],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'Offline Game',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const gameJson = JSON.parse(await readFile(join(result.outputDirectory, 'game.json'), 'utf8'));
    const rewrittenImage = gameJson.graphData.nodes[0].data.timeline.tracks[0].clips[0].src;
    expect(rewrittenImage).toBe('assets/source.png');
    expect(gameJson.assets[0].path).toBe('assets/source.png');
    expect(gameJson.assets[0].relativePath).toBe('assets/source.png');

    await expect(stat(join(result.outputDirectory, rewrittenImage))).resolves.toBeTruthy();
    await expect(stat(join(result.outputDirectory, 'resources'))).rejects.toBeTruthy();

    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    expect(html).toContain('id="game-data"');
    expect(html).toContain('assets/source.png');
    expect(html).not.toContain("fetch('game.json')");
    expect(html).toContain('class="content"');
    expect(html).toContain('class="scene-copy"');
    expect(html).not.toContain('class="panel"');
    expectExportPlayerScriptToParse(html);
  });

  it('leaves non-project asset sources out of export copying', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-sources-'));
    const localImage = join(root, 'local.png');
    await writeFile(localImage, Buffer.from([137, 80, 78, 71]));

    const project = {
      schemaVersion: 1,
      id: 'project-sources',
      title: 'Asset Sources',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
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
                      { id: 'remote-clip', type: 'image', src: 'https://example.com/remote.png', startTime: 0, duration: 4, enabled: true },
                      { id: 'data-clip', type: 'video', src: 'data:video/mp4;base64,AAAA', poster: 'blob:http://localhost/thumb', startTime: 4, duration: 4, enabled: true },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'local',
            type: 'scene',
            position: { x: 100, y: 0 },
            data: {
              type: 'scene',
              title: 'Local',
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
                    clips: [{ id: 'local-clip', type: 'image', src: localImage, startTime: 0, duration: 4, enabled: true }],
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      },
      assets: [
        {
          id: 'remote',
          type: 'image',
          name: 'Remote',
          path: 'https://example.com/remote.png',
          relativePath: 'https://example.com/remote.png',
          importedAt: new Date().toISOString(),
        },
        {
          id: 'data',
          type: 'text',
          name: 'Data',
          path: 'data:text/plain;base64,SGVsbG8=',
          relativePath: 'data:text/plain;base64,SGVsbG8=',
          importedAt: new Date().toISOString(),
        },
        {
          id: 'local',
          type: 'image',
          name: 'Local',
          path: localImage,
          relativePath: localImage,
          importedAt: new Date().toISOString(),
        },
      ],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'Asset Sources',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const gameJson = JSON.parse(await readFile(join(result.outputDirectory, 'game.json'), 'utf8'));

    expect(gameJson.graphData.nodes[0].data.timeline.tracks[0].clips[0].src).toBe('https://example.com/remote.png');
    expect(gameJson.graphData.nodes[0].data.timeline.tracks[0].clips[1].src).toBe('data:video/mp4;base64,AAAA');
    expect(gameJson.graphData.nodes[0].data.timeline.tracks[0].clips[1].poster).toBe('blob:http://localhost/thumb');
    expect(gameJson.graphData.nodes[1].data.timeline.tracks[0].clips[0].src).toBe('assets/local.png');
    expect(gameJson.assets.find((asset: { id: string; path: string }) => asset.id === 'remote').path).toBe('https://example.com/remote.png');
    expect(gameJson.assets.find((asset: { id: string; path: string }) => asset.id === 'data').path).toBe('data:text/plain;base64,SGVsbG8=');
    expect(gameJson.assets.find((asset: { id: string; path: string }) => asset.id === 'local').path).toBe('assets/local.png');
    await expect(stat(join(result.outputDirectory, 'assets', 'local.png'))).resolves.toBeTruthy();
    await expect(readdir(join(result.outputDirectory, 'assets'))).resolves.toEqual(['local.png']);
  });

  it('does not export legacy countdown runtime support for timed interactions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-countdown-'));
    const project = {
      schemaVersion: 1,
      id: 'project-countdown',
      title: 'Timed Game',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: { type: 'start', label: 'Start' },
          },
        ],
        edges: [],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportGamePackage({
      project,
      config: {
        gameTitle: 'Timed Game',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'borderless',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
      isDev: false,
    });

    const html = await readFile(join(result.outputDirectory, 'resources', 'app', 'index.html'), 'utf8');
    const main = await readFile(join(result.outputDirectory, 'resources', 'app', 'main.js'), 'utf8');
    expect(html).not.toContain('countdownTimer');
    expect(html).not.toContain('timer.timeout');
    expect(html).not.toContain('class="timer"');
    expect(html).not.toContain('startTimer');
    expect(main).toContain('frame: false');
  });

  it('exports QTE timeline support with a non-video timeline clock', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-qte-'));
    const project = {
      schemaVersion: 1,
      id: 'project-qte',
      title: 'QTE Game',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
              timeline: {
                version: 2,
                duration: 4,
                bookmarks: [],
                tracks: [
                  {
                    id: 'interaction-track',
                    type: 'interaction',
                    name: 'Interaction',
                    clips: [
                      {
                        id: 'space-qte',
                        type: 'button',
                        mode: 'qte',
                        startTime: 0,
                        duration: 2,
                        enabled: true,
                        label: 'Dodge',
                        rect: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
                        pauseOnShow: true,
                        qte: { input: 'space', prompt: 'Press Space', keyLabel: 'Space', showCountdown: true },
                        opacity: 0.65,
                        rotation: 8,
                        style: {
                          preset: 'glass',
                          shape: 'diamond',
                          fillColor: '#22c55e',
                          textColor: '#111827',
                          borderColor: '#ffffff',
                          fillOpacity: 0.4,
                          borderWidth: 2,
                          shadow: 'soft',
                          backgroundImageSrc: 'assets/button-background.png',
                          backgroundImageFit: 'contain',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'success',
            type: 'scene',
            position: { x: 200, y: 0 },
            data: { type: 'scene', title: 'Success', bodyText: '' },
          },
          {
            id: 'fail',
            type: 'scene',
            position: { x: 400, y: 0 },
            data: { type: 'scene', title: 'Fail', bodyText: '' },
          },
        ],
        edges: [
          { id: 'success-edge', source: 'start', sourceHandle: 'button:space-qte:click', target: 'success' },
          { id: 'fail-edge', source: 'start', sourceHandle: 'button:space-qte:timeout', target: 'fail' },
        ],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'QTE Game',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    expect(html).toContain('timelineResolvedQteClipIds');
    expect(html).toContain('timelineClockTimer = setInterval');
    expect(html).toContain("const autoNext = effect('autoNavigate')");
    expect(html).toContain('timelineButtonCssText');
    expect(html).toContain('min-height: 40px');
    expect(html).toContain('font-size: 12px');
    expect(html).toContain("'transform:rotate(' + (Number.isFinite(rotation) ? rotation : 0) + 'deg)'");
    expect(html).toContain("'transform-origin:center'");
    expect(html).toContain('"preset": "glass"');
    expect(html).toContain('"shape": "diamond"');
    expect(html).toContain('"fillOpacity": 0.4');
    expect(html).toContain('"backgroundImageSrc": "assets/button-background.png"');
    expect(html).toContain('"backgroundImageFit": "contain"');
    expect(html).toContain('background-image:url');
    expect(html).toContain('clip-path:');
    expect(html).toContain('data-qte-input');
    expect(html).toContain("document.addEventListener('keydown'");
    expect(html).toContain("send({ type: reason === 'timeout' ? 'timeline.clip.timeout' : 'timeline.clip.triggered'");
    expect(html).toContain('button.dataset.timelineClip');
    expect(html).toContain('event.stopPropagation()');
    expect(html).toContain('timelineQteMatchesKeyEvent');
    expect(html).toContain('clip.pauseOnShow');
    expect(html).not.toContain("action.type === 'pause'");
  });

  it('exports a preview-parity web player shell for layered timeline media', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-layered-media-'));
    const sourceImage = join(root, 'card.png');
    const sourceVideo = join(root, 'clip.mp4');
    const sourceAudio = join(root, 'bed.mp3');
    await writeFile(sourceImage, Buffer.from([137, 80, 78, 71]));
    await writeFile(sourceVideo, Buffer.from('video'));
    await writeFile(sourceAudio, Buffer.from('audio'));

    const project = {
      schemaVersion: 1,
      id: 'project-layered-media',
      title: 'Layered Media',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
              timeline: {
                version: 2,
                duration: 6,
                bookmarks: [],
                tracks: [
                  {
                    id: 'media-track',
                    type: 'media',
                    name: 'Media',
                    clips: [
                      { id: 'image-clip', type: 'image', src: sourceImage, startTime: 0, duration: 4, enabled: true, rect: { x: 0, y: 0, width: 1, height: 1 }, fit: 'cover', opacity: 0.75, rotation: 4 },
                      { id: 'video-clip', type: 'video', src: sourceVideo, poster: sourceImage, startTime: 1, duration: 4, enabled: true, sourceStart: 0.5, sourceDuration: 2, playbackRate: 1.25, rect: { x: 0.1, y: 0.12, width: 0.8, height: 0.76 }, fit: 'contain' },
                      { id: 'audio-clip', type: 'audio', src: sourceAudio, startTime: 0, duration: 6, enabled: true, volume: 0.4, sourceStart: 0.2 },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'next',
            type: 'scene',
            position: { x: 200, y: 0 },
            data: { type: 'scene', title: 'Next', bodyText: '' },
          },
        ],
        edges: [{ id: 'default-edge', source: 'start', sourceHandle: 'node:default', target: 'next' }],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'Layered Media',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    const gameJson = JSON.parse(await readFile(join(result.outputDirectory, 'game.json'), 'utf8'));
    const clips = gameJson.graphData.nodes[0].data.timeline.tracks[0].clips;

    expect(clips.map((clip: { src: string }) => clip.src)).toEqual(['assets/card.png', 'assets/clip.mp4', 'assets/bed.mp3']);
    expect(clips[1].poster).toBe('assets/card.png');
    expect(html).toContain('class="runtime-stage"');
    expect(html).toContain('data-visual-layer');
    expect(html).toContain('data-audio-index');
    expect(html).toContain('timelinePlaybackEffect');
    expect(html).toContain('syncTimelineClock');
    expect(html).toContain('updateVisualMediaLayers');
    expect(html).toContain('updateAudioMediaLayers');
    expect(html).toContain('getMediaPlaybackTarget');
    expect(html).toContain('media-cover');
    expect(html).not.toContain("effect('playMedia')");
    expect(html).not.toContain('video.media');
    expectExportPlayerScriptToParse(html);
  });

  it('exports the shared graph runtime for edge-based navigation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-runtime-edges-'));
    const project = {
      schemaVersion: 1,
      id: 'project-runtime-edges',
      title: 'Runtime Edges',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: { type: 'start', label: 'Start' },
          },
          {
            id: 'next',
            type: 'scene',
            position: { x: 100, y: 0 },
            data: { type: 'scene', title: 'Next', bodyText: '' },
          },
        ],
        edges: [
          { id: 'to-next', source: 'start', sourceHandle: 'node:default', target: 'next' },
        ],
      },
      assets: [],
      metadata: { entryNodeId: 'start' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'Runtime Edges',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    expect(html).toContain('window.OpenFMVGraphRuntime');
    expect(html).toContain('window.OpenFMVRuntimeCore');
    for (const functionName of graphRuntimeFunctionNames) {
      expect(html).toContain(functionName);
    }
    expect(html).toContain('runtime = runtimeCore.createRuntime(game.graphData');
    expect(html).toContain('snapshot = runtime.start()');
    expect(html).toContain('snapshot = runtime.dispatch(event)');
    expect(html).toContain('dispatchRuntimeEvent');
    expect(html).toContain('buildNodeEffects');
    expect(html).toContain("sourceHandle === 'node:default'");
    expect(html).not.toContain('normalizedInput.includes(condition) || condition.includes(normalizedInput)');
    expect(html).not.toContain("sourceHandle === 'else'");
    expect(html).not.toContain("send({ type: 'input.submitted'");
    expect(html).toContain("send({ type: 'restart' })");
  });

  it('uses shared continue controls for node default outputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-export-default-output-'));
    const project = {
      schemaVersion: 1,
      id: 'project-default-output',
      title: 'Default Output',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
            },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 200, y: 0 },
            data: { type: 'end', label: 'End' },
          },
        ],
        edges: [
          { id: 'end-edge', source: 'start', sourceHandle: 'node:default', target: 'end' },
        ],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportWebGamePackage({
      project,
      config: {
        gameTitle: 'Default Output',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
    });

    const html = await readFile(join(result.outputDirectory, 'index.html'), 'utf8');
    expect(html).toContain("const next = effect('showContinue')");
    expect(html).toContain('next.targetNodeId');
    expect(html).toContain("send({ type: 'navigate', nodeId: button.dataset.next })");
    expect(html).not.toContain('data-next="1"');
    expect(html).not.toContain("const choices = effect('showChoices')");
    expect(html).not.toContain('data-choice-input');
    expect(html).not.toContain('button.dataset.choiceInput');
    expect(html).not.toContain('actions actions-grid');
    expect(html).not.toContain('actions actions-single actions-center');
    expect(html).toContain('actions actions-single actions-start');
    expect(html).toContain('class="action-button"');
    expect(html).toContain('class="action-arrow"');
    expect(html).toContain('<main class="content">');
    expect(html).toContain('播放结束');
  });

  it('copies packaged electron runtime without leaking editor resources into exported game', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-packaged-runtime-'));
    const runtimeDir = join(root, 'runtime');
    await mkdir(join(runtimeDir, 'resources', 'app'), { recursive: true });
    await writeFile(join(runtimeDir, 'OpenFMV.exe'), Buffer.from('client-exe'));
    await writeFile(join(runtimeDir, 'electron.exe'), Buffer.from('electron-exe'));
    await writeFile(join(runtimeDir, 'resources', 'app', 'editor-only.txt'), 'editor');

    const project = {
      schemaVersion: 1,
      id: 'project-runtime',
      title: 'Runtime Clean Game',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: { type: 'start', label: 'Start' },
          },
        ],
        edges: [],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await exportGamePackage({
      project,
      config: {
        gameTitle: 'Runtime Clean Game',
        outputDirectory: root,
        entryNodeId: 'start',
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      },
      electronExecutablePath: join(runtimeDir, 'OpenFMV.exe'),
      electronRuntimeDir: runtimeDir,
      isDev: false,
    });

    await expect(stat(join(result.outputDirectory, 'Runtime Clean Game.exe'))).resolves.toBeTruthy();
    await expect(stat(join(result.outputDirectory, 'resources', 'app', 'main.js'))).resolves.toBeTruthy();
    await expect(stat(join(result.outputDirectory, 'resources', 'app', 'editor-only.txt'))).rejects.toBeTruthy();
    await expect(stat(join(result.outputDirectory, 'OpenFMV.exe'))).rejects.toBeTruthy();
    await expect(stat(join(result.outputDirectory, 'electron.exe'))).rejects.toBeTruthy();
    expect((await readdir(result.outputDirectory)).filter((entry) => entry.endsWith('.exe'))).toEqual(['Runtime Clean Game.exe']);
  });

  it('saves project JSON with project-relative media paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-project-save-'));
    const sourceImage = join(root, 'source.png');
    const projectDir = join(root, 'Saved Project');
    await writeFile(sourceImage, Buffer.from([137, 80, 78, 71]));

    const project = {
      schemaVersion: 1,
      id: 'project-save',
      title: 'Saved Project',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: {
              type: 'start',
              label: 'Start',
              timeline: {
                version: 2,
                duration: 24,
                bookmarks: [],
                tracks: [
                  {
                    id: 'media-track',
                    type: 'media',
                    name: 'Media',
                    clips: [{ id: 'image-clip', type: 'image', src: sourceImage, startTime: 0, duration: 4, enabled: true }],
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      },
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          name: 'source.png',
          path: sourceImage,
          relativePath: pathToFileURL(sourceImage).href,
          importedAt: new Date().toISOString(),
        },
      ],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedProject = await saveProjectToDirectory(project, projectDir);
    const savedJson = JSON.parse(await readFile(join(projectDir, 'project.openfmv.json'), 'utf8'));

    expect(savedProject.graphData.nodes[0].data.timeline.tracks[0].clips[0].src).toBe('assets/images/source.png');
    expect(savedJson.graphData.nodes[0].data.timeline.tracks[0].clips[0].src).toBe('assets/images/source.png');
    expect(savedJson.assets[0].path).toBe('assets/images/source.png');
    expect(savedJson.assets[0].relativePath).toBe('assets/images/source.png');
    await expect(stat(join(projectDir, 'assets', 'images', 'source.png'))).resolves.toBeTruthy();
  });

  it('does not persist unknown AI settings or API keys into project JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openfmv-project-secret-'));
    const projectDir = join(root, 'Secret Project');

    const project = {
      schemaVersion: 1,
      id: 'project-secret',
      title: 'Secret Project',
      graphData: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            data: { type: 'start', label: 'Start' },
          },
        ],
        edges: [],
      },
      assets: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSettings: {
        byokProviders: [
          { providerId: 'anthropic', apiKey: 'secret-api-key', baseUrl: 'https://api.test', model: 'claude-test' },
        ],
      },
    };

    await saveProjectToDirectory(project, projectDir);
    const rawJson = await readFile(join(projectDir, 'project.openfmv.json'), 'utf8');
    const savedJson = JSON.parse(rawJson);

    expect(rawJson).not.toContain('secret-api-key');
    expect(rawJson).not.toContain('aiSettings');
    expect(savedJson.aiSettings).toBeUndefined();
  });
});
