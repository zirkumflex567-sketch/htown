import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';
import { AdminConfig } from '@htown/admin-shared';

export type ConfigVersionRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  message: string;
  data_json: string;
  previous_version_id: string | null;
};

export async function createConfigVersion(input: {
  data: AdminConfig;
  message: string;
  createdBy: string | null;
  previousVersionId: string | null;
}) {
  const db = getDb();
  const id = nanoid();
  await db.exec(
    'INSERT INTO config_versions (id, created_at, created_by, message, data_json, previous_version_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, nowIso(), input.createdBy, input.message, JSON.stringify(input.data), input.previousVersionId]
  );
  return id;
}

export async function getLatestConfigVersion() {
  const db = getDb();
  return db.get<ConfigVersionRow>('SELECT * FROM config_versions ORDER BY created_at DESC LIMIT 1');
}

export async function getConfigVersionById(id: string) {
  const db = getDb();
  return db.get<ConfigVersionRow>('SELECT * FROM config_versions WHERE id = ?', [id]);
}

export async function listConfigVersions(limit = 25) {
  const db = getDb();
  return db.query<ConfigVersionRow>('SELECT * FROM config_versions ORDER BY created_at DESC LIMIT ?', [limit]);
}
