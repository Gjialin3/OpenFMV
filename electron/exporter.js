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
        if (isLocalFilePath(clip?.src)) paths.add(clip.src);
        if (isLocalFilePath(clip?.poster)) paths.add(clip.poster);
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
    if (!isLocalFilePath(sourcePath)) return sourcePath;
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
    .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: .9; background: #000; }
    .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.62), rgba(0,0,0,.18), rgba(0,0,0,.88)); }
    .bottom-glow { position: absolute; inset: auto 0 0; height: 50%; background: radial-gradient(circle at 50% 100%, rgba(249,115,22,.15), transparent 45%); }
    .content { position: relative; z-index: 2; min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; box-sizing: border-box; padding: 32px 20px; }
    .content-inner { width: 100%; max-width: 1024px; margin: 0 auto; }
    .story-copy { max-width: 768px; margin-bottom: 32px; }
    .node-type { margin-bottom: 12px; color: #f97316; font-size: 12px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(40px, 6vw, 72px); line-height: 1; font-weight: 650; letter-spacing: -.02em; text-shadow: 0 18px 48px rgba(0,0,0,.6); }
    p { margin: 20px 0 0; color: rgba(255,255,255,.86); font-size: clamp(16px, 2vw, 20px); line-height: 1.8; white-space: pre-wrap; text-shadow: 0 12px 34px rgba(0,0,0,.65); }
    .controls { width: 100%; max-width: 896px; }
    .prompt { margin: 0 0 20px; text-align: center; color: white; font-size: clamp(24px, 3vw, 36px); line-height: 1.2; font-weight: 650; text-shadow: 0 14px 40px rgba(0,0,0,.6); }
    .actions { display: grid; gap: 12px; }
    .actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .actions-single { grid-template-columns: minmax(0, 1fr); }
    .actions-center { justify-items: center; }
    .actions-start { justify-items: start; }
    .action-button { display: flex; min-height: 64px; width: 100%; max-width: 576px; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.15); border-radius: 22px; background: rgba(255,255,255,.1); color: white; padding: 16px 20px; font-size: 18px; text-align: left; box-shadow: 0 18px 60px rgba(0,0,0,.22); backdrop-filter: blur(24px); cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease; }
    .action-button:hover { transform: translateY(-2px); border-color: rgba(249,115,22,.7); background: rgba(255,255,255,.16); }
    .action-label { min-width: 0; overflow-wrap: anywhere; }
    .action-arrow { flex: none; opacity: .62; transition: transform .16s ease, opacity .16s ease; }
    .action-button:hover .action-arrow { transform: translateX(4px); opacity: 1; }
    .input-row { display: flex; max-width: 576px; margin: 0 auto; align-items: center; gap: 8px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(255,255,255,.12); padding: 8px; box-shadow: 0 18px 60px rgba(0,0,0,.35); backdrop-filter: blur(24px); }
    .input-row input { min-width: 0; flex: 1; border: 0; background: transparent; color: white; padding: 12px 16px; font-size: 16px; outline: none; }
    .input-row input::placeholder { color: rgba(255,255,255,.35); }
    .icon-button { display: grid; width: 44px; height: 44px; flex: none; place-items: center; border: 0; border-radius: 999px; background: #f97316; color: white; font-size: 18px; cursor: pointer; transition: background .16s ease; }
    .icon-button:hover { background: #fb923c; }
    .timer { width: 100%; max-width: 320px; margin: 20px auto 0; height: 6px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
    .timer span { display: block; height: 100%; width: 100%; background: #f97316; transform-origin: left; animation: timer linear forwards; }
    .timeline-overlay { pointer-events: none; position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; }
    .timeline-frame { position: relative; aspect-ratio: 16 / 9; width: 100%; height: 100%; max-width: 100%; max-height: 100%; }
    .timeline-clip { pointer-events: auto; position: absolute; display: flex; min-width: 48px; min-height: 36px; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 12px; padding: 0 12px; color: white; font-size: 14px; font-weight: 750; cursor: pointer; box-shadow: 0 18px 54px rgba(0,0,0,.32); backdrop-filter: blur(14px); transition: transform .16s ease; }
    .timeline-clip:hover { transform: scale(1.02); }
    .timeline-clip.button { border: 1px solid rgba(253,186,116,.9); background: rgba(249,115,22,.92); }
    .timeline-clip.qte { border-color: rgba(165,243,252,.9); background: rgba(6,182,212,.92); }
    .timeline-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-label { display: flex; min-width: 0; max-width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-align: center; line-height: 1.1; }
    .timeline-qte-cue { display: block; max-width: 100%; overflow: hidden; color: rgba(255,255,255,.75); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 650; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-qte-countdown { position: absolute; left: 8px; right: 8px; bottom: 4px; display: block; height: 4px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); }
    .timeline-qte-countdown span { display: block; height: 100%; border-radius: 999px; background: white; }
    @keyframes timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @media (max-width: 720px) {
      .content { padding: 28px 20px; }
      .actions-grid { grid-template-columns: 1fr; }
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
    let countdownTimer = null;
    let timelineNodeId = null;
    let timelineShownClipIds = new Set();
    let timelineTimedOutClipIds = new Set();
    let timelineResolvedQteClipIds = new Set();
    let timelineQteStartedAt = new Map();
    let timelineQteClickCounts = new Map();
    let timelineClockTimer = null;
    let timelineClockPaused = false;

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const effect = (type) => (snapshot && snapshot.effects || []).find((item) => item.type === type);
    const t = (key) => playerMessages[key] || playerMessagesByLocale['zh-CN'][key] || key;
    const translatedDefault = (value, key) => value === playerMessagesByLocale['zh-CN'][key] ? t(key) : value;

    const send = (event) => {
      snapshot = runtime.dispatch(event);
      render();
    };

    const promptHtml = (prompt) => prompt ? '<h2 class="prompt">' + escapeHtml(prompt) + '</h2>' : '';

    const timelineClipRect = (clip) => {
      if (clip && clip.rect) return clip.rect;
      return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
    };

    const timelineClipLabel = (clip) => {
      if (!clip) return '';
      return clip.label || clip.name || 'Continue';
    };
    const timelineQteDisplayName = (clip) => {
      const rawLabel = clip && (clip.label || clip.name);
      const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
      return !label || label === 'New choice' || label === 'Choice' ? 'QTE' : label;
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
      const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, '');
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

    const timelineClipAction = (clip) => {
      if (!clip) return { type: 'continue' };
      return clip.action || { type: 'continue' };
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

    const resumeTimelineClock = (video) => {
      timelineClockPaused = false;
      if (video) video.play();
    };

    const completeTimelineQte = (clip, reason, video) => {
      if (!isTimelineQteClip(clip) || timelineResolvedQteClipIds.has(clip.id)) return false;
      timelineResolvedQteClipIds.add(clip.id);
      timelineQteClickCounts.delete(clip.id);
      const action = reason === 'timeout' ? clip.timeoutAction : timelineClipAction(clip);
      if (reason === 'timeout') timelineTimedOutClipIds.add(clip.id);
      if (!action) {
        if (clip.pauseOnShow) resumeTimelineClock(video);
        return false;
      }
      if (action.type === 'continue') {
        resumeTimelineClock(video);
        return false;
      }
      send({ type: reason === 'timeout' ? 'timeline.clip.timeout' : 'timeline.clip.triggered', clipId: clip.id, action });
      return true;
    };

    const renderTimelineOverlay = (overlay, activeClips) => {
      overlay.innerHTML = '<div class="timeline-frame">' + activeClips.map((clip) => {
        const rect = timelineClipRect(clip);
        const isQte = isTimelineQteClip(clip);
        const qte = timelineQteConfig(clip);
        const qteStartedAt = timelineQteStartedAt.get(clip.id);
        const qteDuration = Math.max(1, (clip.duration || 0) * 1000);
        const qteRemainingRatio = qteStartedAt ? Math.max(0, Math.min(1, 1 - ((performance.now() - qteStartedAt) / qteDuration))) : 1;
        const qteCueLabel = isQte ? timelineQteCueLabel(qte, timelineQteClickCounts.get(clip.id) || 0) : '';
        const label = timelineClipLabel(clip);
        const labelHtml = isQte
          ? '<span class="timeline-qte-label">' + (qteCueLabel ? '<span class="timeline-qte-cue">' + escapeHtml(qteCueLabel) + '</span>' : '') + '<span class="timeline-qte-name">' + escapeHtml(timelineQteDisplayName(clip)) + '</span>' + (qte.showCountdown ? '<span class="timeline-qte-countdown"><span style="width:' + (qteRemainingRatio * 100) + '%"></span></span>' : '') + '</span>'
          : '<span class="timeline-label">' + escapeHtml(label) + '</span>';
        return '<button class="timeline-clip ' + escapeHtml(clip.type) + (isQte ? ' qte' : '') + '" data-timeline-clip="' + escapeHtml(clip.id) + '"' + (isQte ? ' data-qte-input="' + escapeHtml(qte.input) + '"' : '') + ' style="left:' + (rect.x * 100) + '%;top:' + (rect.y * 100) + '%;width:' + (rect.width * 100) + '%;height:' + (rect.height * 100) + '%">' + labelHtml + '</button>';
      }).join('') + '</div>';
    };

    const resetTimelineSessionIfNeeded = (timeline) => {
      if (!timeline || timeline.nodeId === timelineNodeId) return;
      timelineNodeId = timeline.nodeId;
      timelineShownClipIds = new Set();
      timelineTimedOutClipIds = new Set();
      timelineResolvedQteClipIds = new Set();
      timelineQteStartedAt = new Map();
      timelineQteClickCounts = new Map();
      timelineClockPaused = false;
    };

    const wireTimelineOverlay = () => {
      const timeline = effect('timelineOverlay');
      const mediaEffect = effect('playMedia');
      const overlay = document.getElementById('timelineOverlay');
      const video = appRoot.querySelector('video.media');
      if (!timeline || !overlay || !snapshot.currentNode) return;

      resetTimelineSessionIfNeeded(timeline);

      const getTimelineTime = () => {
        if (video && mediaEffect && mediaEffect.mediaType === 'video') {
          const playbackRate = Number(mediaEffect.playbackRate) > 0 ? Number(mediaEffect.playbackRate) : 1;
          return (mediaEffect.timelineStartTime || 0) + Math.max(0, (video.currentTime || 0) - (mediaEffect.sourceStart || 0)) / playbackRate;
        }
        return snapshot.timelineTime || 0;
      };

      const updateRuntimeTimelineTime = (time) => {
        if (!snapshot || snapshot.status !== 'running') return;
        if (Math.abs((snapshot.timelineTime || 0) - time) <= 0.02) return;
        snapshot = runtime.dispatch({ type: 'timeline.time.update', time });
      };

      const syncTimeline = () => {
        if (!snapshot || !snapshot.currentNode) return;
        const time = getTimelineTime();
        updateRuntimeTimelineTime(time);
        const activeClips = runtimeCore.getActiveTimelineClips(snapshot.currentNode, snapshot.timelineTime || time);
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
          if (clip.pauseOnShow) {
            timelineShownClipIds.add(clip.id);
            timelineClockPaused = true;
            if (video) video.pause();
          }
        });

        for (const clip of activeClips) {
          if (!isTimelineQteClip(clip) || timelineResolvedQteClipIds.has(clip.id)) continue;
          const startedAt = timelineQteStartedAt.get(clip.id) || performance.now();
          const durationMs = Math.max(0, (clip.duration || 0) * 1000);
          if (performance.now() - startedAt >= durationMs && completeTimelineQte(clip, 'timeout', video)) return;
        }

        timeline.clips.forEach((clip) => {
          const endTime = runtimeCore.getTimelineClipEndTime(clip);
          if (isTimelineQteClip(clip) || clip.type !== 'button' || !clip.timeoutAction || (snapshot.timelineTime || time) < endTime || timelineTimedOutClipIds.has(clip.id)) return;
          timelineTimedOutClipIds.add(clip.id);
          send({ type: 'timeline.clip.timeout', clipId: clip.id, action: clip.timeoutAction });
        });
        if (!snapshot || !snapshot.currentNode || effect('timelineOverlay')?.nodeId !== timeline.nodeId) return;

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
                if (!completeTimelineQte(clip, 'success', video)) syncTimeline();
                return;
              }
              syncTimeline();
              return;
            }
            const action = timelineClipAction(clip);
            if (action.type === 'continue') {
              resumeTimelineClock(video);
              return;
            }
            send({ type: 'timeline.clip.triggered', clipId: clip.id, action });
          });
        });
      };

      syncTimeline();
      if (video) {
        video.addEventListener('timeupdate', syncTimeline);
        video.addEventListener('seeked', syncTimeline);
        video.addEventListener('loadedmetadata', syncTimeline);
      }
      timelineClockTimer = setInterval(() => {
        const activeTimeline = effect('timelineOverlay');
        if (!activeTimeline || !snapshot || snapshot.status !== 'running') return;
        if (!video && !timelineClockPaused) {
          const duration = Number(activeTimeline.duration) || 0;
          const nextTime = duration > 0 ? Math.min(duration, (snapshot.timelineTime || 0) + 0.1) : (snapshot.timelineTime || 0) + 0.1;
          snapshot = runtime.dispatch({ type: 'timeline.time.update', time: nextTime });
        }
        syncTimeline();
      }, 100);
    };

    const renderActions = () => {
      const timeline = effect('timelineOverlay');
      if (timeline) return '';
      if (!snapshot || snapshot.status === 'ended' || (snapshot.currentNode && snapshot.currentNode.type === 'end')) {
        return '<div class="actions actions-single actions-start"><button class="action-button" data-restart="1"><span class="action-label">' + escapeHtml(t('restart')) + '</span><span class="action-arrow">↻</span></button></div>';
      }
      const input = effect('showInput');
      if (input) {
        return '<div class="controls">' + promptHtml(input.prompt) + '<div class="input-row"><input id="answer" placeholder="' + escapeHtml(translatedDefault(input.placeholder, 'answerPlaceholder')) + '" /><button class="icon-button" data-input="1">→</button></div></div>';
      }
      const slider = effect('showSlider');
      if (slider) {
        return '<div class="controls">' + promptHtml(slider.prompt) + '<div class="actions actions-single actions-center"><button class="action-button" data-slider="1" data-handle="' + escapeHtml(slider.handleId) + '"><span class="action-label">' + escapeHtml(translatedDefault(slider.label, 'swipeUnlock')) + '</span><span class="action-arrow">→</span></button></div></div>';
      }
      const choices = effect('showChoices');
      if (choices) {
        const actionClass = choices.choices.length > 1 ? 'actions actions-grid' : 'actions actions-single actions-center';
        return '<div class="controls">' + promptHtml(choices.prompt) + '<div class="' + actionClass + '">' + choices.choices.map((choice) => '<button class="action-button" data-choice-input="' + escapeHtml(choice.input) + '" data-handle="' + escapeHtml(choice.handleId) + '"><span class="action-label">' + escapeHtml(choice.label) + '</span><span class="action-arrow">→</span></button>').join('') + '</div></div>';
      }
      const next = effect('showContinue');
      return next ? '<div class="actions actions-single actions-start"><button class="action-button" data-next="1"><span class="action-label">' + escapeHtml(translatedDefault(next.label, 'continue')) + '</span><span class="action-arrow">→</span></button></div>' : '';
    };

    const render = () => {
      if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
      }
      clearTimelineClock();
      const scene = effect('scene');
      const mediaEffect = effect('playMedia');
      const timerEffect = effect('startTimer');
      if (!snapshot || !scene) {
        appRoot.innerHTML = '<div class="scene"><div class="shade"></div><div class="bottom-glow"></div><main class="content"><div class="content-inner"><div class="story-copy"><h1>' + escapeHtml(t('playEnded')) + '</h1></div>' + renderActions() + '</div></main></div>';
        appRoot.querySelector('[data-restart]')?.addEventListener('click', () => send({ type: 'restart' }));
        return;
      }
      const media = mediaEffect && mediaEffect.mediaType === 'video'
        ? '<video class="media" src="' + escapeHtml(mediaEffect.src) + '" poster="' + escapeHtml(mediaEffect.poster || '') + '" autoplay playsinline controls' + (mediaEffect.muted ? ' muted' : '') + '></video>'
        : mediaEffect && mediaEffect.mediaType === 'image'
          ? '<img class="media" src="' + escapeHtml(mediaEffect.src) + '" />'
          : '';
      const timer = timerEffect ? '<div class="timer"><span style="animation-duration:' + timerEffect.seconds + 's"></span></div>' : '';
      const storyCopy = '<div class="story-copy"><div class="node-type">' + escapeHtml(scene.nodeType) + '</div><h1>' + escapeHtml(scene.title) + '</h1>' + (scene.text ? '<p>' + escapeHtml(scene.text) + '</p>' : '') + '</div>';
      appRoot.innerHTML = '<div class="scene">' + media + '<div id="timelineOverlay" class="timeline-overlay"></div><div class="shade"></div><div class="bottom-glow"></div><main class="content"><div class="content-inner">' + storyCopy + renderActions() + timer + '</div></main></div>';
      const renderedVideo = appRoot.querySelector('video.media');
      if (renderedVideo && mediaEffect && mediaEffect.mediaType === 'video' && mediaEffect.sourceStart > 0) {
        renderedVideo.addEventListener('loadedmetadata', () => {
          renderedVideo.currentTime = mediaEffect.sourceStart;
        }, { once: true });
      }
      wireTimelineOverlay();
      if (timerEffect && snapshot.currentNode && snapshot.currentNode.type !== 'end') {
        countdownTimer = setTimeout(() => send({ type: 'timer.timeout' }), timerEffect.seconds * 1000);
      }
      appRoot.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          if (countdownTimer) {
            clearTimeout(countdownTimer);
            countdownTimer = null;
          }
          if (button.dataset.restart) {
            send({ type: 'restart' });
            return;
          }
          if (button.dataset.slider) {
            send({ type: 'slider.unlocked', input: 'unlocked', handleId: button.dataset.handle });
            return;
          }
          if (button.dataset.input) {
            send({ type: 'input.submitted', value: document.getElementById('answer')?.value || '' });
            return;
          }
          if (button.dataset.choiceInput !== undefined) {
            send({ type: 'choice.selected', input: button.dataset.choiceInput, handleId: button.dataset.handle });
            return;
          }
          send({ type: 'continue' });
        });
      });
    };

    document.addEventListener('keydown', (event) => {
      if (isTextEditingTarget(event.target)) return;
      const timeline = effect('timelineOverlay');
      if (!timeline || !snapshot || !snapshot.currentNode) return;
      const activeClips = runtimeCore.getActiveTimelineClips(snapshot.currentNode, snapshot.timelineTime || 0);
      const clip = activeClips.find((item) => isTimelineQteClip(item) && !timelineResolvedQteClipIds.has(item.id) && timelineQteMatchesKeyEvent(event, timelineQteConfig(item)));
      if (!clip) return;
      event.preventDefault();
      const video = appRoot.querySelector('video.media');
      if (!completeTimelineQte(clip, 'success', video)) render();
    });

    try {
      const game = JSON.parse(document.getElementById('game-data').textContent);
      playerMessages = playerMessagesByLocale[game.metadata && game.metadata.locale] || playerMessagesByLocale['zh-CN'];
      runtime = runtimeCore.createRuntime(game.graphData, { entryNodeId: game.metadata && game.metadata.entryNodeId });
      snapshot = runtime.start();
      render();
    } catch (error) {
      appRoot.innerHTML = '<div class="scene"><div class="shade"></div><main class="content"><div class="content-inner"><div class="story-copy"><h1>Unable to load game data</h1></div></div></main></div>';
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
    if (!isLocalFilePath(asset.path)) continue;
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
