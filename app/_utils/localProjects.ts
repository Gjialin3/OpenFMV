import { AppEdge, AppNode, OpenFMVProject, OpenFMVAsset } from '../_types';
import {
  collectProjectAssetsFromGraph as collectGraphAssets,
  defaultGraphData as createDefaultGraphData,
  ensureGraphData as normalizeGraphData,
} from './projectPersistence';
import { classifyAssetSource } from './assetPaths';
import { getAssetIdentityKeys } from './assetIdentity';
import { saveBrowserAssetFile } from './browserAssets';
import { resolveMediaSrc } from './mediaSrc';
import { decodeTextBuffer } from './textEncoding';

const PROJECTS_KEY = 'openfmv-local-projects';
const VIDEO_POSTER_MAX_WIDTH = 360;

export const defaultGraphData = (): { nodes: AppNode[]; edges: AppEdge[] } => createDefaultGraphData();

export const ensureGraphData = (graphData?: Partial<OpenFMVProject['graphData']> | null): OpenFMVProject['graphData'] => {
  return normalizeGraphData(graphData);
};

const now = () => new Date().toISOString();

const readRawProjects = () => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!window.localStorage.getItem(PROJECTS_KEY) && Array.isArray(parsed)) {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(parsed));
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRawProjects = (projects: OpenFMVProject[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const isStorageQuotaError = (error: unknown) => {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

const isRelativeAssetPath = (value: unknown) => {
  return classifyAssetSource(value) === 'projectAsset';
};

const toFileUrl = (absolutePath: string) => {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
};

const resolveProjectAssetValueForEditor = (projectDirectory: string, value: unknown) => {
  return isRelativeAssetPath(value) ? toFileUrl(`${projectDirectory}\\${String(value)}`) : value;
};

const resolveProjectAssetMetadataForEditor = (
  projectDirectory: string,
  metadata: OpenFMVAsset['metadata']
): OpenFMVAsset['metadata'] => {
  if (!metadata) return metadata;
  const nextMetadata = { ...metadata };
  for (const key of ['poster', 'thumbnail'] as const) {
    const value = nextMetadata[key];
    if (isRelativeAssetPath(value)) nextMetadata[key] = resolveProjectAssetValueForEditor(projectDirectory, value);
  }
  return nextMetadata;
};

const readAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('无法读取本地文件'));
      }
    };
    reader.onerror = () => reject(new Error('无法读取本地文件'));
    reader.readAsDataURL(file);
  });
};

const getAssetTypeFromFile = (file: File): OpenFMVAsset['type'] => {
  const lowerName = file.name.toLowerCase();
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/.test(lowerName)) return 'video';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(lowerName)) return 'image';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lowerName)) return 'audio';
  return 'text';
};

const roundAssetMetadataNumber = (value: number) => Math.round(value * 1000) / 1000;

const getVideoPosterSeekTimes = (duration: number) => {
  const fallbackTimes = [0.2, 0.8, 1.6, 2.8];
  const durationTimes = Number.isFinite(duration) && duration > 0
    ? [duration * 0.08, duration * 0.16, duration * 0.28]
    : [];

  return [...fallbackTimes, ...durationTimes]
    .map((time) => Math.max(0, Number(time) || 0))
    .filter((time) => !Number.isFinite(duration) || duration <= 0 || time < Math.max(0.05, duration - 0.05))
    .map((time) => roundAssetMetadataNumber(time))
    .filter((time, index, times) => times.indexOf(time) === index)
    .slice(0, 5);
};

const seekVideo = (video: HTMLVideoElement, time: number) => {
  return new Promise<boolean>((resolve) => {
    if (typeof video.addEventListener !== 'function' || typeof video.removeEventListener !== 'function') {
      try {
        video.currentTime = time;
        resolve(video.readyState >= 2);
      } catch {
        resolve(false);
      }
      return;
    }

    let finished = false;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
    const finish = (value: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(value);
    };
    const handleSeeked = () => finish(true);
    const handleError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(video.readyState >= 2), 1200);

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });

    try {
      video.currentTime = time;
    } catch {
      finish(false);
    }
  });
};

const captureVideoPosterFrame = (video: HTMLVideoElement) => {
  if (typeof document === 'undefined') return null;
  if (!video.videoWidth || !video.videoHeight) return null;

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, VIDEO_POSTER_MAX_WIDTH / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const step = Math.max(4, Math.floor(pixels.length / 2400) * 4);
  let luminanceTotal = 0;
  let sampleCount = 0;
  for (let index = 0; index < pixels.length; index += step) {
    luminanceTotal += (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
    sampleCount += 1;
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.72),
    luminance: sampleCount > 0 ? luminanceTotal / sampleCount : 0,
  };
};

const readVideoPoster = async (video: HTMLVideoElement) => {
  const duration = Number(video.duration);
  let bestFrame: { dataUrl: string; luminance: number } | null = null;

  for (const time of getVideoPosterSeekTimes(duration)) {
    const canCapture = await seekVideo(video, time);
    if (!canCapture) continue;
    const frame = captureVideoPosterFrame(video);
    if (!frame) continue;
    if (!bestFrame || frame.luminance > bestFrame.luminance) bestFrame = frame;
    if (frame.luminance >= 18) break;
  }

  return bestFrame?.dataUrl;
};

const readMediaElementMetadata = (src: string, type: 'video' | 'audio') => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve({});

  return new Promise<Record<string, unknown>>((resolve) => {
    const element = document.createElement(type);
    let finished = false;
    const timeoutId = window.setTimeout(() => finish(), 5000);

    const finish = (metadata: Record<string, unknown> = {}) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      element.removeAttribute('src');
      element.load();
      resolve(metadata);
    };

    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const metadata: Record<string, unknown> = {};
      if (Number.isFinite(element.duration) && element.duration > 0) {
        metadata.duration = roundAssetMetadataNumber(element.duration);
      }
      if (type === 'video') {
        const video = element as HTMLVideoElement;
        if (Number.isFinite(video.videoWidth) && video.videoWidth > 0) metadata.width = video.videoWidth;
        if (Number.isFinite(video.videoHeight) && video.videoHeight > 0) metadata.height = video.videoHeight;
        void readVideoPoster(video)
          .then((poster) => finish(poster ? { ...metadata, poster, thumbnail: poster } : metadata))
          .catch(() => finish(metadata));
        return;
      }
      finish(metadata);
    };
    element.onerror = () => finish();
    element.src = src;
    element.load();
  });
};

const readImageSourceMetadata = (src: string) => {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return Promise.resolve({});

  return new Promise<Record<string, unknown>>((resolve) => {
    const image = new Image();
    let finished = false;
    const timeoutId = window.setTimeout(() => finish(), 5000);

    const finish = (metadata: Record<string, unknown> = {}) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(metadata);
    };

    image.onload = () => {
      const metadata: Record<string, unknown> = {};
      if (Number.isFinite(image.naturalWidth) && image.naturalWidth > 0) metadata.width = image.naturalWidth;
      if (Number.isFinite(image.naturalHeight) && image.naturalHeight > 0) metadata.height = image.naturalHeight;
      finish(metadata);
    };
    image.onerror = () => finish();
    image.src = src;
  });
};

const readAssetSourceMetadata = (src: string, type: OpenFMVAsset['type']) => {
  if (type === 'video' || type === 'audio') return readMediaElementMetadata(src, type);
  if (type === 'image') return readImageSourceMetadata(src);
  return Promise.resolve({});
};

export const readBrowserAssetMetadata = async (file: File): Promise<Record<string, unknown>> => {
  const type = getAssetTypeFromFile(file);
  if (type === 'text' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return {};

  const objectUrl = URL.createObjectURL(file);
  try {
    return await readAssetSourceMetadata(objectUrl, type);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const enrichAssetMetadata = async (asset: OpenFMVAsset): Promise<OpenFMVAsset> => {
  if (asset.type === 'text') return asset;
  const source = asset.relativePath || asset.path;
  const metadataSource = source ? resolveMediaSrc(source) || source : '';
  const metadata = metadataSource ? await readAssetSourceMetadata(metadataSource, asset.type) : {};
  if (Object.keys(metadata).length === 0) return asset;
  return {
    ...asset,
    metadata: {
      ...metadata,
      ...asset.metadata,
    },
  };
};

export const resolveLocalProjectForEditor = (project: OpenFMVProject): OpenFMVProject => {
  const projectDirectory = project.metadata?.projectDirectory;
  if (!projectDirectory) return project;

  const graphData = ensureGraphData(JSON.parse(JSON.stringify(project.graphData)) as OpenFMVProject['graphData']);
  const assets = (project.assets || []).map((asset) => ({
    ...asset,
    path: resolveProjectAssetValueForEditor(projectDirectory, asset.path) as string,
    relativePath: resolveProjectAssetValueForEditor(projectDirectory, asset.relativePath) as string,
    metadata: resolveProjectAssetMetadataForEditor(projectDirectory, asset.metadata),
  }));

  for (const node of graphData.nodes) {
    if (!node.data) continue;
    const timeline = (node.data as Record<string, unknown>).timeline as { tracks?: Array<{ clips?: Array<Record<string, unknown>> }> } | undefined;
    const tracks = Array.isArray(timeline?.tracks) ? timeline.tracks : [];
    for (const track of tracks) {
      const clips = Array.isArray(track.clips) ? track.clips : [];
      for (const clip of clips) {
        for (const key of ['src', 'poster'] as const) {
          const value = clip[key];
          clip[key] = resolveProjectAssetValueForEditor(projectDirectory, value);
        }
        const style = clip.style as Record<string, unknown> | undefined;
        if (style) {
          style.backgroundImageSrc = resolveProjectAssetValueForEditor(projectDirectory, style.backgroundImageSrc);
        }
      }
    }
  }

  return {
    ...project,
    assets,
    graphData,
  };
};

export const collectProjectAssetsFromGraph = (
  graphData: OpenFMVProject['graphData'],
  existingAssets: OpenFMVAsset[] = []
): OpenFMVAsset[] => {
  return collectGraphAssets(graphData, existingAssets);
};

export const createLocalProject = (title = 'Untitled Project'): OpenFMVProject => {
  const timestamp = now();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    graphData: defaultGraphData(),
    assets: [],
    metadata: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const listLocalProjects = (): OpenFMVProject[] => {
  return readRawProjects()
    .filter((project): project is OpenFMVProject => Boolean(project?.id && project?.title))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getLocalProject = (id: string | null | undefined): OpenFMVProject | null => {
  if (!id) return null;
  const project = listLocalProjects().find((item) => item.id === id) ?? null;
  return project ? resolveLocalProjectForEditor(project) : null;
};

const getStoredLocalProject = (id: string | null | undefined): OpenFMVProject | null => {
  if (!id) return null;
  return listLocalProjects().find((item) => item.id === id) ?? null;
};

export const saveLocalProject = async (project: OpenFMVProject): Promise<OpenFMVProject> => {
  const nextProject = { ...project, graphData: ensureGraphData(project.graphData), updatedAt: now() };
  if (typeof window !== 'undefined' && window.openfmv?.saveProject) {
    const savedProject = await window.openfmv.saveProject(nextProject);
    const projects = listLocalProjects();
    const existingIndex = projects.findIndex((item) => item.id === savedProject.id);
    const nextProjects = existingIndex >= 0
      ? projects.map((item) => (item.id === savedProject.id ? savedProject : item))
      : [savedProject, ...projects];
    writeRawProjects(nextProjects);
    return resolveLocalProjectForEditor(savedProject);
  }
  const projects = listLocalProjects();
  const existingIndex = projects.findIndex((item) => item.id === nextProject.id);
  const nextProjects = existingIndex >= 0
    ? projects.map((item) => (item.id === nextProject.id ? nextProject : item))
    : [nextProject, ...projects];
  writeRawProjects(nextProjects);
  return nextProject;
};

export const addAssetsToLocalProject = async (projectId: string | null | undefined, assets: OpenFMVAsset | OpenFMVAsset[]) => {
  const project = getStoredLocalProject(projectId);
  if (!project) return null;

  const importedAssets = Array.isArray(assets) ? assets : [assets];
  const existingKeys = new Set(project.assets.flatMap(getAssetIdentityKeys));
  const nextAssets: OpenFMVAsset[] = [];

  for (const asset of importedAssets) {
    const keys = getAssetIdentityKeys(asset);
    if (keys.some((key) => existingKeys.has(key))) continue;
    keys.forEach((key) => existingKeys.add(key));
    nextAssets.push(asset);
  }

  if (nextAssets.length === 0) return project;

  return saveLocalProject({
    ...project,
    assets: [...project.assets, ...nextAssets],
  });
};

export const addAssetToLocalProject = addAssetsToLocalProject;

export const removeAssetFromLocalProject = async (projectId: string | null | undefined, assetId: string) => {
  const project = getStoredLocalProject(projectId);
  if (!project) return null;

  const nextAssets = (project.assets || []).filter((asset) => asset.id !== assetId);
  if (nextAssets.length === (project.assets || []).length) return project;

  return saveLocalProject({
    ...project,
    assets: nextAssets,
  });
};

export const registerLocalProject = (project: OpenFMVProject): OpenFMVProject => {
  const normalizedProject = { ...project, graphData: ensureGraphData(project.graphData) };
  const projects = listLocalProjects();
  const existingIndex = projects.findIndex((item) => item.id === normalizedProject.id);
  const nextProjects = existingIndex >= 0
    ? projects.map((item) => (item.id === normalizedProject.id ? normalizedProject : item))
    : [normalizedProject, ...projects];
  writeRawProjects(nextProjects);
  return resolveLocalProjectForEditor(normalizedProject);
};

export const openLocalProject = async (): Promise<OpenFMVProject | null> => {
  if (typeof window === 'undefined' || !window.openfmv?.openProject) return null;
  const project = await window.openfmv.openProject();
  if (!project) return null;
  return registerLocalProject(project);
};

export const deleteLocalProject = (id: string) => {
  writeRawProjects(listLocalProjects().filter((project) => project.id !== id));
};

export const createAndSaveLocalProject = async (title: string) => {
  const project = createLocalProject(title.trim() || 'Untitled Project');
  return saveLocalProject(project);
};

export const exportProjectJson = (project: OpenFMVProject) => {
  const exportableProject: OpenFMVProject = {
    schemaVersion: project.schemaVersion,
    id: project.id,
    title: project.title,
    graphData: ensureGraphData(project.graphData),
    assets: project.assets || [],
    metadata: { ...project.metadata },
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  const blob = new Blob([JSON.stringify(exportableProject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `${project.title.replace(/[\\/:*?"<>|]+/g, '-') || 'OpenFMVProject'}.openfmv.json`;
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
};

export const importAssetFromFile = async (file: File): Promise<OpenFMVAsset> => {
  const fileWithPath = file as File & { path?: string };
  if (typeof window !== 'undefined' && fileWithPath.path && window.openfmv?.importAsset) {
    return enrichAssetMetadata(await window.openfmv.importAsset(fileWithPath.path));
  }

  const type = getAssetTypeFromFile(file);
  const isText = type === 'text';
  const content = isText ? await file.arrayBuffer().then(decodeTextBuffer).catch(() => '') : undefined;
  const mediaMetadata = isText ? {} : await readBrowserAssetMetadata(file);
  const assetPath = isText ? await readAsDataUrl(file) : await saveBrowserAssetFile(file);
  return {
    id: crypto.randomUUID(),
    type,
    name: file.name,
    path: assetPath,
    relativePath: assetPath,
    importedAt: now(),
    metadata: {
      ...mediaMetadata,
      size: file.size,
      mimeType: file.type,
      ...(content !== undefined ? { content, title: file.name.replace(/\.[^/.]+$/, '') } : {}),
    },
  };
};

export const canUseNativeAssetPicker = () => {
  return typeof window !== 'undefined' && Boolean(window.openfmv?.selectAsset);
};

export const importAssetFromNativePicker = async (): Promise<OpenFMVAsset | null> => {
  if (!canUseNativeAssetPicker()) return null;
  const asset = await window.openfmv?.selectAsset?.();
  return asset ? enrichAssetMetadata(asset) : null;
};
