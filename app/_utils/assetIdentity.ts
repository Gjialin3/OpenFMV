import { OpenFMVAsset } from '../_types';

export const getAssetSource = (asset: Pick<OpenFMVAsset, 'path' | 'relativePath'>) => asset.relativePath || asset.path;

const normalizeAssetIdentityValue = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    if (/^file:/i.test(trimmed)) {
      const url = new URL(trimmed);
      const pathname = decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/, '$1');
      return pathname.replace(/\\/g, '/').toLowerCase();
    }
  } catch {
    return trimmed.replace(/\\/g, '/').toLowerCase();
  }

  return trimmed.replace(/\\/g, '/').toLowerCase();
};

const getFiniteMetadataNumber = (metadata: OpenFMVAsset['metadata'], key: string) => {
  const value = Number(metadata?.[key]);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) / 1000 : null;
};

const getAssetFingerprintKey = (asset: OpenFMVAsset) => {
  const size = getFiniteMetadataNumber(asset.metadata, 'size');
  if (!size) return null;

  const name = normalizeAssetIdentityValue(asset.name);
  if (!name) return null;

  return [
    'fingerprint',
    asset.type,
    name,
    size,
    getFiniteMetadataNumber(asset.metadata, 'duration') ?? '',
    getFiniteMetadataNumber(asset.metadata, 'width') ?? '',
    getFiniteMetadataNumber(asset.metadata, 'height') ?? '',
  ].join(':');
};

export const getAssetIdentityKeys = (asset: OpenFMVAsset) => {
  const keys: string[] = [];
  const addKey = (prefix: string, value: unknown) => {
    const normalized = normalizeAssetIdentityValue(value);
    if (normalized) keys.push(`${prefix}:${normalized}`);
  };

  addKey('id', asset.id);
  addKey('source', asset.path);
  addKey('source', asset.relativePath);
  addKey('original', asset.metadata?.originalPath);

  const fingerprintKey = getAssetFingerprintKey(asset);
  if (fingerprintKey) keys.push(fingerprintKey);

  return Array.from(new Set(keys));
};
