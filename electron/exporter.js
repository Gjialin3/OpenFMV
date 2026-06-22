let fs;
try {
  fs = require('original-fs').promises;
} catch {
  fs = require('fs/promises');
}
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath, pathToFileURL } = require('url');
const { classifyAssetSource, isProjectAssetSourceKind } = require('../shared/assetPaths');

const ensureDir = async (target) => {
  await fs.mkdir(target, { recursive: true });
  return target;
};

let graphRuntimeCorePromise = null;

const getGraphRuntimeCore = () => {
  if (!graphRuntimeCorePromise) {
    graphRuntimeCorePromise = import(pathToFileURL(path.join(__dirname, '..', 'shared', 'graphRuntimeCore.mjs')).href);
  }
  return graphRuntimeCorePromise;
};

const sanitizeName = (value) => {
  return String(value || 'OpenFMVGame')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim() || 'OpenFMVGame';
};

const toPosixPath = (value) => {
  return value.replace(/\\/g, '/');
};

const copyDir = async (source, target) => {
  await ensureDir(target);
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
};

const copyElectronRuntime = async (electronRuntimeDir, electronExecutablePath, gameDir, gameTitle) => {
  if (!electronRuntimeDir) return;

  await copyDir(electronRuntimeDir, gameDir);
  await fs.rm(path.join(gameDir, 'resources', 'app'), { recursive: true, force: true });
  await fs.rm(path.join(gameDir, 'resources', 'default_app.asar'), { force: true });

  const sourceExeName = electronExecutablePath ? path.basename(electronExecutablePath) : 'electron.exe';
  const copiedSourceExe = path.join(gameDir, sourceExeName);
  const electronExe = path.join(gameDir, 'electron.exe');
  const sourceExe = await fs.access(copiedSourceExe).then(() => copiedSourceExe).catch(() => electronExe);
  const gameExe = path.join(gameDir, `${gameTitle}.exe`);
  await fs.copyFile(sourceExe, gameExe).catch(() => {});
  for (const extraExe of new Set([copiedSourceExe, electronExe])) {
    if (path.resolve(extraExe) !== path.resolve(gameExe)) {
      await fs.rm(extraExe, { force: true }).catch(() => {});
    }
  }
};

const isLocalFilePath = (value) => {
  return isProjectAssetSourceKind(classifyAssetSource(value));
};

const isExportableAssetPath = (value) => {
  return isLocalFilePath(value);
};

const resolveLocalPath = (sourcePath, baseDir) => {
  if (sourcePath.startsWith('file://')) {
    return fileURLToPath(sourcePath);
  }
  if (path.isAbsolute(sourcePath)) {
    return sourcePath;
  }
  return path.resolve(baseDir || process.cwd(), sourcePath);
};

const assetFolderForPath = (sourcePath) => {
  const ext = path.extname(sourcePath).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) return 'videos';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'images';
  return 'files';
};

const collectGraphMediaPaths = (graphData) => {
  const paths = new Set();
  for (const node of graphData.nodes || []) {
    for (const track of node.data?.timeline?.tracks || []) {
      for (const clip of track.clips || []) {
        if (isExportableAssetPath(clip?.src)) paths.add(clip.src);
        if (isExportableAssetPath(clip?.poster)) paths.add(clip.poster);
        if (isExportableAssetPath(clip?.style?.backgroundImageSrc)) paths.add(clip.style.backgroundImageSrc);
      }
    }
  }
  return Array.from(paths);
};

const copyExportAsset = async (sourcePath, targetDir, usedNames, baseDir) => {
  const absoluteSource = resolveLocalPath(sourcePath, baseDir);
  await fs.access(absoluteSource);

  const parsed = path.parse(absoluteSource);
  let fileName = parsed.base;
  let index = 1;
  while (usedNames.has(fileName.toLowerCase())) {
    fileName = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  usedNames.add(fileName.toLowerCase());

  await fs.copyFile(absoluteSource, path.join(targetDir, fileName));
  return `assets/${fileName}`;
};

const copyProjectAsset = async (sourcePath, projectDir, usedNames, baseDir) => {
  const normalizedRelative = toPosixPath(sourcePath);
  if (!path.isAbsolute(sourcePath) && normalizedRelative.startsWith('assets/')) {
    await fs.access(path.join(projectDir, normalizedRelative));
    return normalizedRelative;
  }

  const absoluteSource = resolveLocalPath(sourcePath, baseDir || projectDir);
  await fs.access(absoluteSource);

  const parsed = path.parse(absoluteSource);
  const folder = assetFolderForPath(absoluteSource);
  const targetDir = await ensureDir(path.join(projectDir, 'assets', folder));
  let fileName = parsed.base;
  let index = 1;
  while (usedNames.has(`${folder}/${fileName}`.toLowerCase())) {
    fileName = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  usedNames.add(`${folder}/${fileName}`.toLowerCase());

  const targetPath = path.join(targetDir, fileName);
  if (path.resolve(absoluteSource) !== path.resolve(targetPath)) {
    await fs.copyFile(absoluteSource, targetPath);
  }
  return toPosixPath(path.join('assets', folder, fileName));
};

const rewriteGraphMediaPaths = (graphData, pathMap) => {
  for (const node of graphData.nodes || []) {
    if (!node.data) continue;
    for (const track of node.data.timeline?.tracks || []) {
      for (const clip of track.clips || []) {
        if (pathMap.has(clip?.src)) {
          clip.src = pathMap.get(clip.src);
        }
        if (pathMap.has(clip?.poster)) {
          clip.poster = pathMap.get(clip.poster);
        }
        if (pathMap.has(clip?.style?.backgroundImageSrc)) {
          clip.style.backgroundImageSrc = pathMap.get(clip.style.backgroundImageSrc);
        }
      }
    }
  }
};

const normalizeProjectAssets = async (project, projectDir) => {
  const nextProject = JSON.parse(JSON.stringify(project));
  const baseDir = project.metadata?.projectDirectory || projectDir;
  const pathMap = new Map();
  const usedNames = new Set();

  const normalizePath = async (sourcePath) => {
    if (!isExportableAssetPath(sourcePath)) return sourcePath;
    if (pathMap.has(sourcePath)) return pathMap.get(sourcePath);
    const relativePath = await copyProjectAsset(sourcePath, projectDir, usedNames, baseDir);
    pathMap.set(sourcePath, relativePath);
    return relativePath;
  };

  nextProject.assets = await Promise.all((nextProject.assets || []).map(async (asset) => {
    const sourcePath = asset.path || asset.relativePath;
    if (!sourcePath) return asset;
    try {
      const relativePath = await normalizePath(sourcePath);
      if (asset.relativePath) pathMap.set(asset.relativePath, relativePath);
      return {
        ...asset,
        path: relativePath,
        relativePath,
      };
    } catch {
      return asset;
    }
  }));

  for (const mediaPath of collectGraphMediaPaths(nextProject.graphData)) {
    try {
      await normalizePath(mediaPath);
    } catch {
    }
  }

  rewriteGraphMediaPaths(nextProject.graphData, pathMap);
  return nextProject;
};

const saveProjectToDirectory = async (project, projectDir) => {
  await ensureDir(projectDir);
  const projectPath = path.join(projectDir, 'project.openfmv.json');
  const normalizedProject = await normalizeProjectAssets(project, projectDir);
  const nextProject = {
    schemaVersion: normalizedProject.schemaVersion,
    id: normalizedProject.id,
    title: normalizedProject.title,
    graphData: normalizedProject.graphData,
    assets: normalizedProject.assets || [],
    metadata: {
      ...normalizedProject.metadata,
      projectDirectory: projectDir,
      projectPath,
    },
    createdAt: normalizedProject.createdAt,
    updatedAt: normalizedProject.updatedAt,
  };
  await fs.writeFile(projectPath, JSON.stringify(nextProject, null, 2), 'utf8');
  return nextProject;
};

const escapeScriptJson = (value) => {
  return value.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
};

const createGameShellMain = (config) => `
const { app, BrowserWindow } = require('electron');
const path = require('path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: ${Number(config.resolution?.width) || 1280},
    height: ${Number(config.resolution?.height) || 720},
    fullscreen: ${config.windowMode === 'fullscreen'},
    frame: ${config.windowMode !== 'borderless'},
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
};

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

const exportPlayerMessages = {
  'zh-CN': {
    playEnded: '播放结束',
    restart: '重新开始',
    continue: '继续',
    answerPlaceholder: '输入你的回答...',
    swipeUnlock: '滑动解锁',
  },
  en: {
    playEnded: 'Playback ended',
    restart: 'Restart',
    continue: 'Continue',
    answerPlaceholder: 'Enter your answer...',
    swipeUnlock: 'Swipe to unlock',
  },
  ja: {
    playEnded: '再生が終了しました',
    restart: '最初から',
    continue: '続ける',
    answerPlaceholder: '回答を入力...',
    swipeUnlock: 'スワイプして解除',
  },
  ko: {
    playEnded: '재생 종료',
    restart: '다시 시작',
    continue: '계속',
    answerPlaceholder: '답변을 입력하세요...',
    swipeUnlock: '밀어서 잠금 해제',
  },
};

const getExportLocale = (config) => Object.prototype.hasOwnProperty.call(exportPlayerMessages, config?.locale) ? config.locale : 'zh-CN';

const createGameShellHtml = (gameJson, graphRuntimeScript = '') => {
  const game = JSON.parse(gameJson);
  const locale = getExportLocale({ locale: game.metadata?.locale });
  return `
<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenFMV Game</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #050505; color: white; font-family: Inter, Arial, sans-serif; overflow: hidden; }
    #app { position: fixed; inset: 0; background: linear-gradient(135deg,#090b10,#15110d); }
    .scene { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; }
    .stage-wrap { position: absolute; inset: 0; display: grid; place-items: center; background: #000; }
    .runtime-stage { position: relative; max-width: 100vw; max-height: 100vh; overflow: hidden; background: #000; }
    .media-layer { position: absolute; overflow: hidden; }
    .media-item { display: block; width: 100%; height: 100%; background: #000; }
    .media-contain { object-fit: contain; }
    .media-cover { object-fit: cover; }
    .empty-stage { position: absolute; inset: 0; background: radial-gradient(circle at 50% 24%, rgba(249,115,22,.22), transparent 34%), radial-gradient(circle at 78% 12%, rgba(255,255,255,.09), transparent 30%), linear-gradient(135deg,#151821,#070a10 62%,#17120f); }
    .audio-layer { display: none; }
    .shade { pointer-events: none; position: absolute; inset: 0; z-index: 10; background: linear-gradient(to bottom, rgba(0,0,0,.62), rgba(0,0,0,.18), rgba(0,0,0,.88)); }
    .bottom-glow { pointer-events: none; position: absolute; inset: auto 0 0; z-index: 10; height: 50%; background: radial-gradient(circle at 50% 100%, rgba(249,115,22,.15), transparent 45%); }
    .content { position: relative; z-index: 2; min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; box-sizing: border-box; padding: 32px 20px; }
    .content-inner { width: 100%; max-width: 1024px; margin: 0 auto; }
    .scene-copy { max-width: 768px; margin-bottom: 32px; }
    .node-type { margin-bottom: 12px; color: #f97316; font-size: 12px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(40px, 6vw, 72px); line-height: 1; font-weight: 650; letter-spacing: -.02em; text-shadow: 0 18px 48px rgba(0,0,0,.6); }
    p { margin: 20px 0 0; color: rgba(255,255,255,.86); font-size: clamp(16px, 2vw, 20px); line-height: 1.8; white-space: pre-wrap; text-shadow: 0 12px 34px rgba(0,0,0,.65); }
    .actions { display: grid; gap: 12px; }
    .actions-single { grid-template-columns: minmax(0, 1fr); }
    .actions-start { justify-items: start; }
    .action-button { display: flex; min-height: 64px; width: 100%; max-width: 576px; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.15); border-radius: 22px; background: rgba(255,255,255,.1); color: white; padding: 16px 20px; font-size: 18px; text-align: left; box-shadow: 0 18px 60px rgba(0,0,0,.22); backdrop-filter: blur(24px); cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease; }
    .action-button:hover { transform: translateY(-2px); border-color: rgba(249,115,22,.7); background: rgba(255,255,255,.16); }
    .action-label { min-width: 0; overflow-wrap: anywhere; }
    .action-arrow { flex: none; opacity: .62; transition: transform .16s ease, opacity .16s ease; }
    .action-button:hover .action-arrow { transform: translateX(4px); opacity: 1; }
    .timeline-overlay { pointer-events: none; position: absolute; inset: 0; z-index: 20; }
    .timeline-clip { pointer-events: auto; position: absolute; display: flex; min-width: 48px; min-height: 40px; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; border-radius: 12px; padding: 0 12px; color: white; font-size: 12px; line-height: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 18px 54px rgba(0,0,0,.32); backdrop-filter: blur(24px); transition: transform .16s ease; }
    .timeline-clip:hover { transform: scale(1.02); }
    .timeline-clip.button { border: 1px solid rgba(253,186,116,.9); background: rgba(249,115,22,.92); }
    .timeline-clip.qte { border-color: rgba(165,243,252,.9); background: rgba(6,182,212,.92); }
    .timeline-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-label { display: flex; min-width: 0; max-width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-align: center; line-height: 1.1; }
    .timeline-qte-cue { display: block; max-width: 100%; overflow: hidden; color: rgba(255,255,255,.75); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 650; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-countdown { position: absolute; left: 8px; right: 8px; bottom: 4px; display: block; height: 4px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); }
    .timeline-qte-countdown span { display: block; height: 100%; border-radius: 999px; background: white; }
    @media (max-width: 720px) {
      .content { padding: 28px 20px; }
      .action-button { max-width: none; }
      h1 { font-size: clamp(34px, 12vw, 56px); }
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="application/json" id="game-data">${escapeScriptJson(gameJson)}</script>
  <script>${graphRuntimeScript}</script>
  <script>
    const appRoot = document.getElementById('app');
    const runtimeCore = window.OpenFMVRuntimeCore;
    const playerMessagesByLocale = ${JSON.stringify(exportPlayerMessages)};
    let playerMessages = playerMessagesByLocale['${locale}'] || playerMessagesByLocale['zh-CN'];
    let runtime = null;
    let snapshot = null;
    let timelineNodeId = null;
    let timelineShownClipIds = new Set();
    let timelineTimedOutClipIds = new Set();
    let timelineResolvedQteClipIds = new Set();
    let timelineQteStartedAt = new Map();
    let timelineQteClickCounts = new Map();
    let timelineClockTimer = null;
    let timelineClockPaused = false;
    let currentRenderSignature = '';
    let runtimeStageAspectRatio = 16 / 9;
    let timelineTriggerState = { nodeId: null, time: 0 };

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const effect = (type) => (snapshot && snapshot.effects || []).find((item) => item.type === type);
    const effectsOfType = (type) => (snapshot && snapshot.effects || []).filter((item) => item.type === type);
    const t = (key) => playerMessages[key] || playerMessagesByLocale['zh-CN'][key] || key;
    const translatedDefault = (value, key) => value === playerMessagesByLocale['zh-CN'][key] ? t(key) : value;
    const visualMediaEffects = () => effectsOfType('playMedia').filter((item) => item.mediaType === 'video' || item.mediaType === 'image');
    const audioMediaEffects = () => effectsOfType('playMedia').filter((item) => item.mediaType === 'audio');
    const timelinePlaybackEffect = () => effect('timelinePlayback');
    const timelineOverlayEffect = () => effect('timelineOverlay');
    const getVisualMediaRect = (item) => item && item.rect ? item.rect : { x: 0, y: 0, width: 1, height: 1 };
    const clampMediaOpacity = (item) => {
      const value = Number(item && item.opacity);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    };
    const getMediaRotation = (item) => {
      const value = Number(item && item.rotation);
      return Number.isFinite(value) ? value : 0;
    };
    const getMediaPlaybackRate = (item) => {
      const value = Number(item && item.playbackRate);
      if (!Number.isFinite(value) || value <= 0) return 1;
      return Math.max(0.01, Math.min(5, value));
    };
    const getMediaSourceEnd = (item) => {
      const sourceDuration = Number(item && item.sourceDuration);
      if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return null;
      return Math.max(0, Number(item && item.sourceStart) || 0) + sourceDuration;
    };
    const getNaturalMediaAspectRatio = (width, height) => {
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
      return Math.max(0.25, Math.min(4, width / height));
    };
    const runtimeStageCssText = (aspectRatio) => 'aspect-ratio:' + aspectRatio + ';width:min(100vw, calc(100vh * ' + aspectRatio + '))';
    const mediaLayerCssText = (item) => {
      const rect = getVisualMediaRect(item);
      return [
        'left:' + (rect.x * 100) + '%',
        'top:' + (rect.y * 100) + '%',
        'width:' + (rect.width * 100) + '%',
        'height:' + (rect.height * 100) + '%',
        'opacity:' + clampMediaOpacity(item),
        'transform:rotate(' + getMediaRotation(item) + 'deg)',
        'transform-origin:center',
      ].join(';');
    };
    const mediaIdentity = (item, index) => [
      index,
      item && item.mediaType,
      item && item.src,
      item && item.poster,
      item && item.timelineStartTime,
      item && item.sourceStart,
      item && item.sourceDuration,
      item && item.muted,
    ].join('|');
    const renderSignature = () => {
      const scene = effect('scene');
      const next = effect('showContinue');
      const timeline = timelineOverlayEffect();
      return JSON.stringify({
        status: snapshot && snapshot.status,
        nodeId: snapshot && snapshot.currentNodeId,
        scene,
        visual: visualMediaEffects().map(mediaIdentity),
        audio: audioMediaEffects().map(mediaIdentity),
        timelineNodeId: timeline && timeline.nodeId,
        hasTimelineOverlay: Boolean(timeline),
        next: next && next.targetNodeId,
        ended: !snapshot || snapshot.status === 'ended' || (snapshot.currentNode && snapshot.currentNode.type === 'end'),
      });
    };

    const send = (event) => {
      snapshot = runtime.dispatch(event);
      render();
    };

    const timelineClipRect = (clip) => {
      if (clip && clip.rect) return clip.rect;
      return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
    };

    const timelineClipLabel = (clip) => {
      if (!clip) return '';
      return typeof clip.label === 'string' ? clip.label : clip.name || 'Continue';
    };
    const clampTimelineButtonOpacity = (value, fallback) => {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) return fallback;
      return Math.max(0, Math.min(1, numberValue));
    };
    const clampTimelineButtonBorderWidth = (value, fallback) => {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) return fallback;
      return Math.max(0, Math.min(4, Math.round(numberValue)));
    };
    const normalizeTimelineButtonColor = (value, fallback) => {
      if (typeof value !== 'string') return fallback;
      const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!match) return fallback;
      const color = match[1];
      return '#' + (color.length === 3 ? color[0] + color[0] + color[1] + color[1] + color[2] + color[2] : color).toLowerCase();
    };
    const timelineButtonPresetDefaults = (preset) => {
      if (preset === 'outline') return { fillOpacity: 0, borderOpacity: 0.9, borderWidth: 1, shadow: 'soft' };
      if (preset === 'glass') return { fillOpacity: 0.2, borderOpacity: 0.38, borderWidth: 1, shadow: 'soft' };
      if (preset === 'ghost') return { fillOpacity: 0, borderOpacity: 0, borderWidth: 0, shadow: 'none' };
      return { fillOpacity: 0.92, borderOpacity: 0.9, borderWidth: 1, shadow: 'strong' };
    };
    const timelineButtonModeDefaults = (clip) => {
      const isQte = isTimelineQteClip(clip);
      const preset = 'solid';
      const presetDefaults = timelineButtonPresetDefaults(preset);
      return {
        preset,
        shape: 'rounded',
        fillColor: isQte ? '#06b6d4' : '#f97316',
        textColor: '#ffffff',
        borderColor: isQte ? '#a5f3fc' : '#fed7aa',
        fillOpacity: presetDefaults.fillOpacity,
        borderOpacity: presetDefaults.borderOpacity,
        borderWidth: presetDefaults.borderWidth,
        shadow: presetDefaults.shadow,
        backgroundImageAssetId: undefined,
        backgroundImageSrc: undefined,
        backgroundImageFit: 'cover',
      };
    };
    const timelineButtonStyleConfig = (clip) => {
      const source = clip && clip.style && typeof clip.style === 'object' ? clip.style : {};
      const modeDefaults = timelineButtonModeDefaults(clip);
      const preset = ['solid', 'outline', 'glass', 'ghost'].includes(source.preset) ? source.preset : modeDefaults.preset;
      const presetDefaults = timelineButtonPresetDefaults(preset);
      const backgroundImageSrc = typeof source.backgroundImageSrc === 'string' && source.backgroundImageSrc.trim() ? source.backgroundImageSrc.trim() : undefined;
      return {
        preset,
        shape: ['rounded', 'pill', 'square', 'oval', 'diamond', 'hexagon'].includes(source.shape) ? source.shape : modeDefaults.shape,
        fillColor: normalizeTimelineButtonColor(source.fillColor, modeDefaults.fillColor),
        textColor: normalizeTimelineButtonColor(source.textColor, modeDefaults.textColor),
        borderColor: normalizeTimelineButtonColor(source.borderColor, modeDefaults.borderColor),
        fillOpacity: clampTimelineButtonOpacity(source.fillOpacity, presetDefaults.fillOpacity),
        borderOpacity: clampTimelineButtonOpacity(source.borderOpacity, presetDefaults.borderOpacity),
        borderWidth: clampTimelineButtonBorderWidth(source.borderWidth, presetDefaults.borderWidth),
        shadow: ['none', 'soft', 'strong'].includes(source.shadow) ? source.shadow : presetDefaults.shadow,
        backgroundImageAssetId: backgroundImageSrc && typeof source.backgroundImageAssetId === 'string' && source.backgroundImageAssetId.trim() ? source.backgroundImageAssetId.trim() : undefined,
        backgroundImageSrc,
        backgroundImageFit: ['cover', 'contain', 'stretch'].includes(source.backgroundImageFit) ? source.backgroundImageFit : modeDefaults.backgroundImageFit,
      };
    };
    const timelineButtonRgba = (hex, opacity) => {
      const color = normalizeTimelineButtonColor(hex, '#000000').slice(1);
      const red = parseInt(color.slice(0, 2), 16);
      const green = parseInt(color.slice(2, 4), 16);
      const blue = parseInt(color.slice(4, 6), 16);
      return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + clampTimelineButtonOpacity(opacity, 1) + ')';
    };
    const timelineButtonRadius = (shape) => {
      if (shape === 'oval') return '50%';
      if (shape === 'diamond' || shape === 'hexagon') return '2px';
      if (shape === 'pill') return '999px';
      if (shape === 'square') return '2px';
      return '10px';
    };
    const timelineButtonClipPath = (shape) => {
      if (shape === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      if (shape === 'hexagon') return 'polygon(18% 0%, 82% 0%, 100% 50%, 82% 100%, 18% 100%, 0% 50%)';
      return '';
    };
    const timelineButtonShadow = (shadow) => {
      if (shadow === 'strong') return '0 18px 52px rgba(0, 0, 0, 0.38)';
      if (shadow === 'soft') return '0 10px 30px rgba(0, 0, 0, 0.24)';
      return 'none';
    };
    const timelineButtonBackgroundSize = (fit) => {
      if (fit === 'contain') return 'contain';
      if (fit === 'stretch') return '100% 100%';
      return 'cover';
    };
    const timelineButtonCssUrl = (value) => String(value).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'").replace(/\\n/g, '');
    const timelineButtonCssText = (clip, rect) => {
      const style = timelineButtonStyleConfig(clip);
      const clipPath = timelineButtonClipPath(style.shape);
      const clipOpacity = clampTimelineButtonOpacity(clip && clip.opacity, 1);
      const rotation = Number(clip && clip.rotation);
      return [
        'left:' + (rect.x * 100) + '%',
        'top:' + (rect.y * 100) + '%',
        'width:' + (rect.width * 100) + '%',
        'height:' + (rect.height * 100) + '%',
        'opacity:' + clipOpacity,
        'transform:rotate(' + (Number.isFinite(rotation) ? rotation : 0) + 'deg)',
        'transform-origin:center',
        'background-color:' + timelineButtonRgba(style.fillColor, style.fillOpacity),
        style.backgroundImageSrc ? "background-image:url('" + timelineButtonCssUrl(style.backgroundImageSrc) + "')" : '',
        style.backgroundImageSrc ? 'background-position:center' : '',
        style.backgroundImageSrc ? 'background-repeat:no-repeat' : '',
        style.backgroundImageSrc ? 'background-size:' + timelineButtonBackgroundSize(style.backgroundImageFit) : '',
        'border-color:' + timelineButtonRgba(style.borderColor, style.borderWidth > 0 ? style.borderOpacity : 0),
        'border-style:solid',
        'border-width:' + style.borderWidth + 'px',
        'border-radius:' + timelineButtonRadius(style.shape),
        clipPath ? 'clip-path:' + clipPath : '',
        clipPath ? '-webkit-clip-path:' + clipPath : '',
        'box-shadow:' + timelineButtonShadow(style.shadow),
        'color:' + style.textColor,
        style.preset === 'glass' ? 'backdrop-filter:blur(18px)' : '',
      ].filter(Boolean).join(';');
    };
    const timelineQteDisplayName = (clip) => {
      const rawLabel = clip && typeof clip.label === 'string'
        ? clip.label
        : clip && typeof clip.name === 'string'
          ? clip.name
          : undefined;
      if (typeof rawLabel !== 'string') return 'QTE';
      const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
      if (!label) return '';
      return label === 'New choice' || label === 'Choice' ? 'QTE' : label;
    };

    const isTimelineQteClip = (clip) => clip && clip.type === 'button' && clip.mode === 'qte';
    const timelineQteClickCount = (config) => {
      const count = Number(config && config.clickCount);
      return Number.isFinite(count) ? Math.max(1, Math.min(20, Math.round(count))) : 1;
    };
    const timelineQteConfig = (clip) => {
      const input = clip && clip.qte && clip.qte.input === 'space' ? 'space' : 'click';
      return {
        input,
        prompt: clip && clip.qte && clip.qte.prompt,
        clickCount: clip && clip.qte && clip.qte.clickCount,
        keyLabel: input === 'space' ? clip && clip.qte && clip.qte.keyLabel && clip.qte.keyLabel !== 'Click' ? clip.qte.keyLabel : 'Space' : 'Click',
        showCountdown: !clip || !clip.qte || clip.qte.showCountdown !== false,
        showCueLabel: !clip || !clip.qte || clip.qte.showCueLabel !== false,
      };
    };
    const timelineQteCueLabel = (config, completedClicks) => {
      if (!config) return '';
      if (config.input === 'space') return config.keyLabel || 'Space';
      const clickCount = timelineQteClickCount(config);
      if (clickCount <= 1) return '';
      return completedClicks > 0 ? Math.min(completedClicks, clickCount) + '/' + clickCount : 'x' + clickCount;
    };
    const normalizeTimelineQteKeyToken = (value) => {
      if (value === ' ') return 'space';
      const normalized = (value || '').trim().toLowerCase().replace(/\\s+/g, '');
      if (normalized === 'spacebar') return 'space';
      if (normalized === 'esc') return 'escape';
      return normalized;
    };
    const timelineQteMatchesKeyEvent = (event, config) => {
      if (!config || config.input !== 'space') return false;
      const expected = normalizeTimelineQteKeyToken(config.keyLabel || 'Space');
      const codeAlias = event.code && event.code.indexOf('Key') === 0
        ? event.code.slice(3)
        : event.code && event.code.indexOf('Digit') === 0
          ? event.code.slice(5)
          : event.code;
      return [event.key, event.code, codeAlias, event.key === ' ' ? 'Space' : undefined]
        .some((candidate) => normalizeTimelineQteKeyToken(candidate) === expected);
    };

    const isTextEditingTarget = (target) => {
      if (!target || !target.tagName) return false;
      const tagName = target.tagName.toLowerCase();
      return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const clearTimelineClock = () => {
      if (!timelineClockTimer) return;
      clearInterval(timelineClockTimer);
      timelineClockTimer = null;
    };

    const pauseTimelineClock = (video) => {
      timelineClockPaused = true;
      if (video) video.pause();
    };

    const completeTimelineQte = (clip, reason, video) => {
      if (!isTimelineQteClip(clip) || timelineResolvedQteClipIds.has(clip.id)) return false;
      timelineResolvedQteClipIds.add(clip.id);
      timelineQteClickCounts.delete(clip.id);
      if (reason === 'timeout') timelineTimedOutClipIds.add(clip.id);
      send({ type: reason === 'timeout' ? 'timeline.clip.timeout' : 'timeline.clip.triggered', clipId: clip.id, nodeId: timelineNodeId });
      return true;
    };

    const renderTimelineOverlay = (overlay, activeClips) => {
      overlay.innerHTML = activeClips.map((clip) => {
        const rect = timelineClipRect(clip);
        const isQte = isTimelineQteClip(clip);
        const qte = timelineQteConfig(clip);
        const qteStartedAt = timelineQteStartedAt.get(clip.id);
        const qteDuration = Math.max(1, (clip.duration || 0) * 1000);
        const qteRemainingRatio = qteStartedAt ? Math.max(0, Math.min(1, 1 - ((performance.now() - qteStartedAt) / qteDuration))) : 1;
        const qteCueLabel = isQte && qte.showCueLabel !== false ? timelineQteCueLabel(qte, timelineQteClickCounts.get(clip.id) || 0) : '';
        const label = timelineClipLabel(clip);
        const labelHtml = isQte
          ? '<span class="timeline-qte-label">' + (qteCueLabel ? '<span class="timeline-qte-cue">' + escapeHtml(qteCueLabel) + '</span>' : '') + '<span class="timeline-qte-name">' + escapeHtml(timelineQteDisplayName(clip)) + '</span>' + (qte.showCountdown ? '<span class="timeline-qte-countdown"><span style="width:' + (qteRemainingRatio * 100) + '%"></span></span>' : '') + '</span>'
          : '<span class="timeline-label">' + escapeHtml(label) + '</span>';
        return '<button class="timeline-clip ' + escapeHtml(clip.type) + (isQte ? ' qte' : '') + '" data-timeline-clip="' + escapeHtml(clip.id) + '"' + (isQte ? ' data-qte-input="' + escapeHtml(qte.input) + '"' : '') + ' style="' + timelineButtonCssText(clip, rect) + '">' + labelHtml + '</button>';
      }).join('');
    };

    const resetTimelineSessionIfNeeded = (timeline) => {
      const nextNodeId = timeline && timeline.nodeId || snapshot && snapshot.currentNode && snapshot.currentNode.id || null;
      const nextTime = snapshot && Number.isFinite(Number(snapshot.timelineTime)) ? Number(snapshot.timelineTime) : 0;
      if (nextNodeId === timelineTriggerState.nodeId && nextTime >= timelineTriggerState.time - 0.001) {
        timelineTriggerState = { nodeId: nextNodeId, time: nextTime };
        return;
      }
      timelineNodeId = nextNodeId;
      timelineShownClipIds = new Set();
      timelineTimedOutClipIds = new Set();
      timelineResolvedQteClipIds = new Set();
      timelineQteStartedAt = new Map();
      timelineQteClickCounts = new Map();
      timelineClockPaused = false;
      timelineTriggerState = { nodeId: nextNodeId, time: nextTime };
    };

    const getTimelineSyncVideo = () => {
      const visuals = visualMediaEffects();
      let videoIndex = -1;
      visuals.forEach((item, index) => {
        if (item.mediaType === 'video') videoIndex = index;
      });
      return videoIndex >= 0 ? appRoot.querySelector('video[data-visual-index="' + videoIndex + '"]') : null;
    };

    const applyMediaPlaybackOptions = (element, item) => {
      element.playbackRate = getMediaPlaybackRate(item);
      if ('preservesPitch' in element) element.preservesPitch = item && item.preservePitch !== false;
    };

    const getMediaPlaybackTarget = (item) => {
      const playbackRate = getMediaPlaybackRate(item);
      const sourceStart = Math.max(0, Number(item && item.sourceStart) || 0);
      const timelineStart = Number(item && item.timelineStartTime) || 0;
      const freezeFrame = item && item.mediaType === 'video' && Number.isFinite(Number(item.freezeFrameTime))
        ? Math.max(0, Number(item.freezeFrameTime))
        : null;
      const unclampedTargetTime = Math.max(0, sourceStart + Math.max(0, (snapshot && snapshot.timelineTime || 0) - timelineStart) * playbackRate);
      const sourceEnd = getMediaSourceEnd(item);
      const targetTime = freezeFrame !== null ? freezeFrame : sourceEnd === null ? unclampedTargetTime : Math.min(unclampedTargetTime, sourceEnd);
      return {
        targetTime,
        sourceEnded: sourceEnd !== null && targetTime >= sourceEnd,
        freezeFrame,
      };
    };

    const syncPlayableMediaElement = (element, item) => {
      if (!element || !item) return;
      applyMediaPlaybackOptions(element, item);
      const target = getMediaPlaybackTarget(item);
      const syncTime = () => {
        if (Number.isFinite(target.targetTime) && Math.abs((element.currentTime || 0) - target.targetTime) > 0.25) {
          try {
            element.currentTime = target.targetTime;
          } catch {
          }
        }
      };
      if (element.readyState >= 1) {
        syncTime();
      } else if (!element.dataset.timeSyncWired) {
        element.dataset.timeSyncWired = '1';
        element.addEventListener('loadedmetadata', () => {
          delete element.dataset.timeSyncWired;
          syncTime();
        }, { once: true });
      }
      const shouldPause = !snapshot || snapshot.status !== 'running' || timelineClockPaused || target.freezeFrame !== null || target.sourceEnded;
      if (shouldPause) {
        element.pause();
      } else {
        void element.play().catch(() => undefined);
      }
    };

    const setRuntimeStageAspectRatio = (aspectRatio) => {
      if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
      if (Math.abs(runtimeStageAspectRatio - aspectRatio) > 0.001) runtimeStageAspectRatio = aspectRatio;
      const stage = document.getElementById('runtimeStage');
      if (stage) stage.setAttribute('style', runtimeStageCssText(runtimeStageAspectRatio));
    };

    const updateVisualMediaLayers = () => {
      const visuals = visualMediaEffects();
      if (visuals.length === 0) {
        setRuntimeStageAspectRatio(16 / 9);
        return;
      }
      visuals.forEach((item, index) => {
        const layer = appRoot.querySelector('[data-visual-layer="' + index + '"]');
        if (layer) layer.setAttribute('style', mediaLayerCssText(item));
        const element = appRoot.querySelector('[data-visual-index="' + index + '"]');
        if (!element) return;
        element.className = 'media-item ' + (item.fit === 'cover' ? 'media-cover' : 'media-contain');
        if (item.mediaType === 'image') {
          if (index === 0 && element.naturalWidth && element.naturalHeight) {
            const aspectRatio = getNaturalMediaAspectRatio(element.naturalWidth, element.naturalHeight);
            if (aspectRatio) setRuntimeStageAspectRatio(aspectRatio);
          } else if (index === 0 && !element.dataset.aspectReadyWired) {
            element.dataset.aspectReadyWired = '1';
            element.addEventListener('load', () => {
              const aspectRatio = getNaturalMediaAspectRatio(element.naturalWidth, element.naturalHeight);
              if (aspectRatio) setRuntimeStageAspectRatio(aspectRatio);
            });
          }
          return;
        }
        if (index === 0 && element.videoWidth && element.videoHeight) {
          const aspectRatio = getNaturalMediaAspectRatio(element.videoWidth, element.videoHeight);
          if (aspectRatio) setRuntimeStageAspectRatio(aspectRatio);
        } else if (index === 0 && !element.dataset.aspectReadyWired) {
          element.dataset.aspectReadyWired = '1';
          const syncAspectRatio = () => {
            const aspectRatio = getNaturalMediaAspectRatio(element.videoWidth, element.videoHeight);
            if (aspectRatio) setRuntimeStageAspectRatio(aspectRatio);
          };
          element.addEventListener('loadedmetadata', syncAspectRatio);
          element.addEventListener('loadeddata', syncAspectRatio);
        }
        element.muted = item.muted === true;
        syncPlayableMediaElement(element, item);
      });
    };

    const updateAudioMediaLayers = () => {
      audioMediaEffects().forEach((item, index) => {
        const element = appRoot.querySelector('audio[data-audio-index="' + index + '"]');
        if (!element || item.muted) return;
        const volume = Number(item.volume);
        element.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
        syncPlayableMediaElement(element, item);
      });
    };

    const wireTimelineOverlay = () => {
      const timeline = timelineOverlayEffect();
      const overlay = document.getElementById('timelineOverlay');
      const video = getTimelineSyncVideo();
      if (!overlay) return;
      if (!timeline || !snapshot || !snapshot.currentNode) {
        overlay.innerHTML = '';
        resetTimelineSessionIfNeeded(null);
        return;
      }

      resetTimelineSessionIfNeeded(timeline);
      const time = snapshot.timelineTime || 0;
      const activeClips = runtimeCore.getActiveTimelineClips(snapshot.currentNode, time);
      const activeQteClipIds = new Set(activeClips.filter(isTimelineQteClip).map((clip) => clip.id));
      activeClips.forEach((clip) => {
        if (isTimelineQteClip(clip) && !timelineQteStartedAt.has(clip.id)) timelineQteStartedAt.set(clip.id, performance.now());
      });
      timelineQteStartedAt.forEach((_startedAt, clipId) => {
        if (!activeQteClipIds.has(clipId)) timelineQteStartedAt.delete(clipId);
      });
      timelineQteClickCounts.forEach((_count, clipId) => {
        if (!activeQteClipIds.has(clipId)) timelineQteClickCounts.delete(clipId);
      });

      activeClips.forEach((clip) => {
        if (timelineShownClipIds.has(clip.id)) return;
        if (clip.pauseOnShow && isTimelineQteClip(clip)) {
          timelineShownClipIds.add(clip.id);
          pauseTimelineClock(video);
        }
      });

      for (const clip of timeline.clips) {
        if (isTimelineQteClip(clip) || clip.type !== 'button' || !clip.pauseOnShow || timelineShownClipIds.has(clip.id)) continue;
        const endTime = runtimeCore.getTimelineClipEndTime(clip);
        if (time < endTime - 0.001) continue;
        timelineShownClipIds.add(clip.id);
        snapshot = runtime.dispatch({ type: 'timeline.time.update', time: Math.max(clip.startTime || 0, endTime - 0.001), nodeId: timeline.nodeId });
        pauseTimelineClock(video);
        return;
      }

      for (const clip of activeClips) {
        if (!isTimelineQteClip(clip) || timelineResolvedQteClipIds.has(clip.id)) continue;
        const startedAt = timelineQteStartedAt.get(clip.id) || performance.now();
        const durationMs = Math.max(0, (clip.duration || 0) * 1000);
        if (performance.now() - startedAt >= durationMs && completeTimelineQte(clip, 'timeout', video)) return;
      }

      renderTimelineOverlay(overlay, activeClips.filter((clip) => !isTimelineQteClip(clip) || !timelineResolvedQteClipIds.has(clip.id)));
      overlay.querySelectorAll('[data-timeline-clip]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const clip = timeline.clips.find((item) => item.id === button.dataset.timelineClip);
          if (!clip) return;
          if (isTimelineQteClip(clip)) {
            const qte = timelineQteConfig(clip);
            if (qte.input !== 'click') return;
            const clickCount = timelineQteClickCount(qte);
            const nextCount = (timelineQteClickCounts.get(clip.id) || 0) + 1;
            timelineQteClickCounts.set(clip.id, nextCount);
            if (nextCount >= clickCount) {
              if (!completeTimelineQte(clip, 'success', video)) render();
              return;
            }
            render();
            return;
          }
          send({ type: 'timeline.clip.triggered', clipId: clip.id, nodeId: timeline.nodeId });
        });
      });
    };

    const syncTimelineClock = () => {
      const playback = timelinePlaybackEffect();
      if (!playback || !snapshot || snapshot.status !== 'running') {
        clearTimelineClock();
        return;
      }
      if (timelineClockTimer) return;
      timelineClockTimer = setInterval(() => {
        const activePlayback = timelinePlaybackEffect();
        if (!activePlayback || !snapshot || snapshot.status !== 'running') {
          clearTimelineClock();
          render();
          return;
        }
        if (!timelineClockPaused) {
          const duration = Number(activePlayback.duration) || 0;
          const nextTime = duration > 0 ? Math.min(duration, (snapshot.timelineTime || 0) + 0.1) : (snapshot.timelineTime || 0) + 0.1;
          if (Math.abs((snapshot.timelineTime || 0) - nextTime) > 0.02) {
            snapshot = runtime.dispatch({ type: 'timeline.time.update', time: nextTime, nodeId: activePlayback.nodeId });
          }
        }
        render();
      }, 100);
    };

    const renderActions = () => {
      if (!snapshot || snapshot.status === 'ended' || (snapshot.currentNode && snapshot.currentNode.type === 'end')) {
        return '<div class="actions actions-single actions-start"><button class="action-button" data-restart="1"><span class="action-label">' + escapeHtml(t('restart')) + '</span><span class="action-arrow">&#8635;</span></button></div>';
      }
      const next = effect('showContinue');
      if (next) {
        return '<div class="actions actions-single actions-start"><button class="action-button" data-next="' + escapeHtml(next.targetNodeId || '') + '"><span class="action-label">' + escapeHtml(translatedDefault(next.label, 'continue')) + '</span><span class="action-arrow">&rarr;</span></button></div>';
      }
      return '';
    };

    const renderVisualMediaLayers = () => {
      const visuals = visualMediaEffects();
      if (visuals.length === 0) return '<div class="empty-stage"></div>';
      return visuals.map((item, index) => {
        const fitClassName = item.fit === 'cover' ? 'media-cover' : 'media-contain';
        const style = mediaLayerCssText(item);
        if (item.mediaType === 'video') {
          return '<div class="media-layer" data-visual-layer="' + index + '" style="' + style + '"><video class="media-item ' + fitClassName + '" data-visual-index="' + index + '" src="' + escapeHtml(item.src || '') + '" poster="' + escapeHtml(item.poster || '') + '" autoplay playsinline' + (item.muted ? ' muted' : '') + '></video></div>';
        }
        return '<div class="media-layer" data-visual-layer="' + index + '" style="' + style + '"><img class="media-item ' + fitClassName + '" data-visual-index="' + index + '" src="' + escapeHtml(item.src || '') + '" alt="" /></div>';
      }).join('');
    };

    const renderAudioMediaLayers = () => audioMediaEffects()
      .map((item, index) => item.muted ? '' : '<audio class="audio-layer" data-audio-index="' + index + '" src="' + escapeHtml(item.src || '') + '" autoplay></audio>')
      .join('');

    const wireActions = () => {
      appRoot.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.timelineClip) return;
          if (button.dataset.restart) {
            send({ type: 'restart' });
            return;
          }
          if (button.dataset.next) {
            send({ type: 'navigate', nodeId: button.dataset.next });
            return;
          }
          send({ type: 'continue' });
        });
      });
    };

    const render = () => {
      const autoNext = effect('autoNavigate');
      if (autoNext && snapshot && snapshot.status === 'running') {
        send({ type: 'navigate', nodeId: autoNext.targetNodeId });
        return;
      }
      const scene = effect('scene');
      const nextRenderSignature = renderSignature();
      if (nextRenderSignature !== currentRenderSignature) {
        currentRenderSignature = nextRenderSignature;
        const sceneCopy = scene
          ? '<div class="scene-copy"><div class="node-type">' + escapeHtml(scene.nodeType) + '</div><h1>' + escapeHtml(scene.title) + '</h1>' + (scene.text ? '<p>' + escapeHtml(scene.text) + '</p>' : '') + '</div>'
          : '<div class="scene-copy"><h1>' + escapeHtml(t('playEnded')) + '</h1></div>';
        appRoot.innerHTML = '<div class="scene"><div class="stage-wrap"><div id="runtimeStage" class="runtime-stage" style="' + runtimeStageCssText(runtimeStageAspectRatio) + '">' + renderVisualMediaLayers() + '<div class="shade"></div><div class="bottom-glow"></div><div id="timelineOverlay" class="timeline-overlay"></div></div>' + renderAudioMediaLayers() + '</div><main class="content"><div class="content-inner">' + sceneCopy + renderActions() + '</div></main></div>';
        wireActions();
      }
      updateVisualMediaLayers();
      updateAudioMediaLayers();
      wireTimelineOverlay();
      syncTimelineClock();
    };

    document.addEventListener('keydown', (event) => {
      if (isTextEditingTarget(event.target)) return;
      const timeline = timelineOverlayEffect();
      if (!timeline || !snapshot || !snapshot.currentNode) return;
      const activeClips = runtimeCore.getActiveTimelineClips(snapshot.currentNode, snapshot.timelineTime || 0);
      const clip = activeClips.find((item) => isTimelineQteClip(item) && !timelineResolvedQteClipIds.has(item.id) && timelineQteMatchesKeyEvent(event, timelineQteConfig(item)));
      if (!clip) return;
      event.preventDefault();
      const video = getTimelineSyncVideo();
      if (!completeTimelineQte(clip, 'success', video)) render();
    });

    try {
      const game = JSON.parse(document.getElementById('game-data').textContent);
      playerMessages = playerMessagesByLocale[game.metadata && game.metadata.locale] || playerMessagesByLocale['zh-CN'];
      runtime = runtimeCore.createRuntime(game.graphData, { entryNodeId: game.metadata && game.metadata.entryNodeId });
      snapshot = runtime.start();
      render();
    } catch (error) {
      appRoot.innerHTML = '<div class="scene"><div class="shade"></div><main class="content"><div class="content-inner"><div class="scene-copy"><h1>Unable to load game data</h1></div></div></main></div>';
    }
  </script>
</body>
</html>
`;
};

const createExportGamePayload = async ({ project, config, assetsDir }) => {
  const graphData = JSON.parse(JSON.stringify(project.graphData));
  const assets = JSON.parse(JSON.stringify(project.assets || []));
  const pathMap = new Map();
  const usedNames = new Set();
  const baseDir = project.metadata?.projectDirectory;

  for (const asset of assets) {
    if (!asset.path) continue;
    if (!isExportableAssetPath(asset.path)) continue;
    try {
      const relativePath = await copyExportAsset(asset.path, assetsDir, usedNames, baseDir);
      pathMap.set(asset.path, relativePath);
      if (asset.relativePath) pathMap.set(asset.relativePath, relativePath);
      asset.path = relativePath;
      asset.relativePath = relativePath;
    } catch {
    }
  }

  for (const mediaPath of collectGraphMediaPaths(graphData)) {
    if (pathMap.has(mediaPath)) continue;
    try {
      const relativePath = await copyExportAsset(mediaPath, assetsDir, usedNames, baseDir);
      pathMap.set(mediaPath, relativePath);
    } catch {
    }
  }

  rewriteGraphMediaPaths(graphData, pathMap);

  const gameJson = JSON.stringify({
    schemaVersion: project.schemaVersion,
    title: project.title,
    graphData,
    assets,
    metadata: {
      ...project.metadata,
      entryNodeId: config.entryNodeId,
      locale: getExportLocale(config),
      resolution: config.resolution,
      windowMode: config.windowMode,
      includeDebugOverlay: config.includeDebugOverlay,
    },
  }, null, 2);
  const { buildGraphRuntimeBrowserScript } = await getGraphRuntimeCore();
  const graphRuntimeScript = buildGraphRuntimeBrowserScript();

  return { gameJson, graphRuntimeScript, copiedAssetCount: usedNames.size };
};

const exportWebGamePackage = async ({ project, config }) => {
  const gameTitle = sanitizeName(config.gameTitle || project.title);
  const outputRoot = await ensureDir(config.outputDirectory);
  const gameDir = path.join(outputRoot, gameTitle);
  await fs.rm(gameDir, { recursive: true, force: true });
  await ensureDir(gameDir);
  const assetsDir = await ensureDir(path.join(gameDir, 'assets'));
  const { gameJson, graphRuntimeScript } = await createExportGamePayload({ project, config, assetsDir });

  await fs.writeFile(path.join(gameDir, 'game.json'), gameJson, 'utf8');
  await fs.writeFile(path.join(gameDir, 'index.html'), createGameShellHtml(gameJson, graphRuntimeScript), 'utf8');
  await fs.writeFile(path.join(gameDir, 'README.txt'), 'Open index.html in a browser to play the exported OpenFMV web game. Keep the assets folder next to index.html.', 'utf8');
  return { outputDirectory: gameDir };
};

const exportGamePackage = async ({ project, config, electronExecutablePath, electronRuntimeDir, isDev }) => {
  const gameTitle = sanitizeName(config.gameTitle || project.title);
  const outputRoot = await ensureDir(config.outputDirectory);
  const gameDir = path.join(outputRoot, gameTitle);
  await fs.rm(gameDir, { recursive: true, force: true });
  await ensureDir(gameDir);
  await copyElectronRuntime(
    electronRuntimeDir || (electronExecutablePath ? path.dirname(electronExecutablePath) : null),
    electronExecutablePath,
    gameDir,
    gameTitle
  );
  const assetsDir = await ensureDir(path.join(gameDir, 'assets'));
  const resourcesAppDir = await ensureDir(path.join(gameDir, 'resources', 'app'));
  const resourcesAssetsDir = await ensureDir(path.join(resourcesAppDir, 'assets'));

  const { gameJson, graphRuntimeScript, copiedAssetCount } = await createExportGamePayload({ project, config, assetsDir: resourcesAssetsDir });

  if (copiedAssetCount > 0) {
    await copyDir(resourcesAssetsDir, assetsDir);
  }

  await fs.writeFile(path.join(gameDir, 'game.json'), gameJson, 'utf8');
  await fs.writeFile(path.join(resourcesAppDir, 'game.json'), gameJson, 'utf8');
  await fs.writeFile(path.join(resourcesAppDir, 'package.json'), JSON.stringify({ name: 'openfmv-exported-game', main: 'main.js' }, null, 2), 'utf8');
  await fs.writeFile(path.join(resourcesAppDir, 'main.js'), createGameShellMain(config), 'utf8');
  await fs.writeFile(path.join(resourcesAppDir, 'index.html'), createGameShellHtml(gameJson, graphRuntimeScript), 'utf8');

  await fs.writeFile(path.join(gameDir, 'README.txt'), 'Double-click the game executable in this folder to launch the exported OpenFMV game.', 'utf8');
  return { outputDirectory: gameDir };
};

module.exports = {
  collectGraphMediaPaths,
  createGameShellHtml,
  createGameShellMain,
  exportGamePackage,
  exportWebGamePackage,
  isLocalFilePath,
  normalizeProjectAssets,
  rewriteGraphMediaPaths,
  saveProjectToDirectory,
  sanitizeName,
};
