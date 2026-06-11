import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/local-asset/route';

describe('local asset route', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  const writeLocalAsset = async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'openfmv-local-asset-'));
    const filePath = path.join(tempDir, 'clip.mp4');
    await writeFile(filePath, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    return filePath;
  };

  it('serves byte ranges for local video files', async () => {
    const filePath = await writeLocalAsset();
    const request = new Request(`http://localhost/api/local-asset?src=${encodeURIComponent(filePath)}`, {
      headers: {
        Range: 'bytes=2-5',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(206);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([2, 3, 4, 5]);
  });

  it('returns an unsatisfiable range response when the requested byte start is outside the file', async () => {
    const filePath = await writeLocalAsset();
    const request = new Request(`http://localhost/api/local-asset?src=${encodeURIComponent(filePath)}`, {
      headers: {
        Range: 'bytes=20-30',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(416);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
  });
});
