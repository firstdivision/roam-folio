import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDeployedBuild } from '../../src/version';

afterEach(() => { vi.unstubAllGlobals(); });

describe('deployment version checks', () => {
  it('returns the deployed build identifier', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('2026-11-21T17:55:00.000Z\n', { status: 200 })));
    await expect(fetchDeployedBuild()).resolves.toBe('2026-11-21T17:55:00.000Z');
  });

  it('rejects failed version responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchDeployedBuild()).rejects.toThrow('Build version could not be checked');
  });
});
