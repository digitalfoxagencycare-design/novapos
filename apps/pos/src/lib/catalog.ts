import type { BusinessProfile } from './business';

export function mergeCatalog<T extends { id: string; archived?: boolean; businessProfile?: BusinessProfile }>(presets: T[], custom: T[], profile: BusinessProfile): T[] {
  return [...custom, ...presets.filter(item => !custom.some(override => override.id === item.id))]
    .filter(item => !item.archived && (!item.businessProfile || item.businessProfile === profile))
    .filter(item => !item.id.startsWith('preset:') || item.id.startsWith(`preset:${profile}:`));
}
