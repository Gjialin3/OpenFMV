import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

import { classifyAssetSource } from '@/app/_utils/assetPaths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
};

const resolveLocalPath = (src: string) => {
  if (src.startsWith('file://')) return fileURLToPath(src);
  if (path.isAbsolute(src) || /^[a-zA-Z]:[\\/]/.test(src)) return src;
  return null;
};

const parseRangeHeader = (rangeHeader: string | null, fileSize: number) => {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return 'invalid';

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return 'invalid';
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : fileSize - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
    return 'invalid';
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
};

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  if (!src) {
    return new Response('Invalid asset source', { status: 400 });
  }

  const sourceKind = classifyAssetSource(src);
  if (sourceKind !== 'absolutePath' && sourceKind !== 'fileUrl') {
    return new Response('Invalid asset source', { status: 400 });
  }

  const filePath = resolveLocalPath(src);
  if (!filePath) {
    return new Response('Invalid local path', { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const range = parseRangeHeader(request.headers.get('range'), fileStat.size);
    const contentType = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const baseHeaders = {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    };

    if (range === 'invalid') {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes */${fileStat.size}`,
        },
      });
    }

    if (range) {
      const stream = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${fileStat.size}`,
        },
      });
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

    return new Response(stream, {
      headers: {
        ...baseHeaders,
        'Content-Length': String(fileStat.size),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
