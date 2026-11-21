import { assetUrl } from './game';

export const runningBuild = import.meta.env.VITE_BUILD_TIMESTAMP as string;

export async function fetchDeployedBuild(): Promise<string | null> {
  const response = await fetch(assetUrl('version.txt'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Build version could not be checked');
  const deployedBuild = (await response.text()).trim();
  return deployedBuild || null;
}
