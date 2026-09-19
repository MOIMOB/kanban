import type { EnvironmentProviders } from '@angular/core';
import { CachedSnapshotStorage, provideSnapshot, type SnapshotKey } from '@anton-gustafsson/snapshot-angular';
import { getSupabase } from './supabase.client';

const BUCKET = 'kanban-board-snapshots';
const EXT = 'webp';

// Objects are stored as `<board_id>/<variant>.webp` so bucket RLS can reuse board_role().
function objectPath(key: SnapshotKey): string {
  return `${key.id}/${key.variant ?? 'default'}.${EXT}`;
}

/** Board thumbnails, cached in IndexedDB and backed by a Supabase Storage bucket. */
export function provideBoardSnapshots(): EnvironmentProviders {
  return provideSnapshot({
    keyPrefix: 'boards:',
    // Supersample to keep thumbnails sharp when upscaled.
    scale: 1.5,
    encode: { type: 'image/webp', quality: 0.92, maxEdge: 640 },
    storage: new CachedSnapshotStorage({
      remote: {
        load: async (_id, key) => {
          const { data, error } = await getSupabase().storage.from(BUCKET).download(objectPath(key));
          if (error) {
            // Storage errors carry the real status separately from the body's `statusCode`.
            if ((error as { statusCode?: string }).statusCode === '404') return null;
            throw error;
          }
          return data;
        },
        save: async (blob, _id, key) => {
          const { error } = await getSupabase()
            .storage.from(BUCKET)
            .upload(objectPath(key), blob, { upsert: true, contentType: 'image/webp' });
          if (error) throw error;
        },
        remove: async (_id, key) => {
          const { error } = await getSupabase().storage.from(BUCKET).remove([objectPath(key)]);
          if (error) throw error;
        },
      },
      onError: (err, key, op) => {
        console.warn(`[board-snapshots] ${op} failed for ${key.key}`, err);
      },
    }),
  });
}
