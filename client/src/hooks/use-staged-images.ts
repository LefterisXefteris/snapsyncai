import { openDB, DBSchema } from 'idb';

// ─── Shared types (imported by 05-02, 05-03) ───────────────────────────────

export interface FileItem {
  id: string;    // crypto.randomUUID()
  file: File;    // actual File object (reconstructed from Blob on restore)
  url: string;   // URL.createObjectURL() — revoked on unmount
}

export interface Group {
  id: string;          // stable UUID — used as dnd-kit droppable id
  items: FileItem[];   // ordered; items[0] = hero image
  maxImages: number;   // per-group override (default = globalGroupSize at creation time)
}

// ─── IDB storage types (internal to hook) ──────────────────────────────────

export interface BlobRecord {
  id: string;        // matches FileItem.id
  blob: Blob;        // actual binary — stored via structured clone, never JSON
  filename: string;
  mimeType: string;
  savedAt: number;   // Date.now() — used for 24h expiry check
}

export interface GroupRecord {
  id: 'groups-v1';     // singleton key — single groups document
  groups: { id: string; itemIds: string[]; maxImages: number }[];
  savedAt: number;
}

// ─── Hook return type ───────────────────────────────────────────────────────

export interface StagedImagesHook {
  loadStaged: () => Promise<{ groups: Group[]; urlsCreated: string[] }>;
  saveBlob: (id: string, file: File) => Promise<void>;
  deleteBlob: (id: string) => Promise<void>;
  saveGroups: (groups: Group[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

// ─── DB schema ─────────────────────────────────────────────────────────────

interface StagedDB extends DBSchema {
  blobs: {
    key: string;
    value: BlobRecord;
  };
  groups: {
    key: string;
    value: GroupRecord;
  };
}

// ─── DB singleton ──────────────────────────────────────────────────────────

let dbPromise: ReturnType<typeof openDB<StagedDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StagedDB>('staged-images-db', 1, {
      upgrade(db) {
        db.createObjectStore('blobs', { keyPath: 'id' });
        db.createObjectStore('groups', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useStagedImages(): StagedImagesHook {
  async function loadStaged(): Promise<{ groups: Group[]; urlsCreated: string[] }> {
    const empty = { groups: [], urlsCreated: [] };
    try {
      const db = await getDB();

      // Fetch all blob records
      const allBlobs = await db.getAll('blobs');
      const now = Date.now();

      // Separate fresh from expired
      const freshBlobs: BlobRecord[] = [];
      const expiredIds: string[] = [];
      for (const b of allBlobs) {
        if (now - b.savedAt >= EXPIRY_MS) {
          expiredIds.push(b.id);
        } else {
          freshBlobs.push(b);
        }
      }

      // Delete expired records
      for (const id of expiredIds) {
        await db.delete('blobs', id);
      }

      // Fetch groups record
      const groupsRecord = await db.get('groups', 'groups-v1');

      if (!groupsRecord || freshBlobs.length === 0) {
        return empty;
      }

      // Build blob map for O(1) lookup
      const blobMap = new Map<string, BlobRecord>();
      for (const b of freshBlobs) {
        blobMap.set(b.id, b);
      }

      // Reconstruct FileItems with object URLs
      const urlsCreated: string[] = [];

      // Reconstruct Groups from stored records
      const reconstructedGroups: Group[] = [];
      for (const storedGroup of groupsRecord.groups) {
        const items: FileItem[] = [];
        for (const itemId of storedGroup.itemIds) {
          const blobRecord = blobMap.get(itemId);
          if (!blobRecord) continue; // blob may have been deleted
          const file = new File([blobRecord.blob], blobRecord.filename, {
            type: blobRecord.mimeType,
          });
          const url = URL.createObjectURL(file);
          urlsCreated.push(url);
          items.push({ id: itemId, file, url });
        }
        if (items.length > 0) {
          reconstructedGroups.push({
            id: storedGroup.id,
            items,
            maxImages: storedGroup.maxImages,
          });
        }
      }

      return { groups: reconstructedGroups, urlsCreated };
    } catch (err) {
      console.warn('[use-staged-images] IDB unavailable:', err);
      return empty;
    }
  }

  async function saveBlob(id: string, file: File): Promise<void> {
    try {
      const db = await getDB();
      await db.put('blobs', {
        id,
        blob: file, // File extends Blob — structured clone handles it
        filename: file.name,
        mimeType: file.type,
        savedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[use-staged-images] IDB unavailable:', err);
    }
  }

  async function deleteBlob(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('blobs', id);
    } catch (err) {
      console.warn('[use-staged-images] IDB unavailable:', err);
    }
  }

  async function saveGroups(groups: Group[]): Promise<void> {
    try {
      const db = await getDB();
      const serialized = groups.map((g) => ({
        id: g.id,
        itemIds: g.items.map((item) => item.id),
        maxImages: g.maxImages,
      }));
      await db.put('groups', {
        id: 'groups-v1',
        groups: serialized,
        savedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[use-staged-images] IDB unavailable:', err);
    }
  }

  async function clearAll(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear('blobs');
      await db.delete('groups', 'groups-v1');
    } catch (err) {
      console.warn('[use-staged-images] IDB unavailable:', err);
    }
  }

  return { loadStaged, saveBlob, deleteBlob, saveGroups, clearAll };
}
