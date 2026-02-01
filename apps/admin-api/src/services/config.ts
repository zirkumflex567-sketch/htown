import { adminConfigSchema, defaultAdminConfig } from '@htown/admin-shared';
import { createConfigVersion, getLatestConfigVersion, getConfigVersionById } from '../db/repos/config';

export async function ensureConfigVersion(createdBy: string | null = null) {
  const existing = await getLatestConfigVersion();
  if (existing) return existing;
  const data = defaultAdminConfig();
  const id = await createConfigVersion({
    data,
    message: 'Initial config',
    createdBy,
    previousVersionId: null
  });
  return getConfigVersionById(id);
}

export function validateConfig(data: unknown) {
  return adminConfigSchema.parse(data);
}
