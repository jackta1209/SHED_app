// IndexedDB-backed local sheet music library.
// Stores file blobs locally on the user's device. NOT uploaded to cloud.

const DB_NAME = "shed-sheet-music";
const STORE = "files";
const VERSION = 1;

export interface SavedSheet {
  id: string;
  name: string;
  type: string; // mime
  size: number;
  saved_at: number;
  blob: Blob;
}

export interface SavedSheetMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  saved_at: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open storage."));
  });
}

export const sheetMusicStore = {
  async list(): Promise<SavedSheetMeta[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as SavedSheet[]) ?? [];
        resolve(
          all
            .map(({ id, name, type, size, saved_at }) => ({ id, name, type, size, saved_at }))
            .sort((a, b) => b.saved_at - a.saved_at),
        );
      };
      req.onerror = () => reject(req.error);
    });
  },

  async get(id: string): Promise<SavedSheet | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as SavedSheet) ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async save(file: File): Promise<SavedSheetMeta> {
    const db = await openDB();
    const record: SavedSheet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      saved_at: Date.now(),
      blob: file,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () =>
        resolve({
          id: record.id,
          name: record.name,
          type: record.type,
          size: record.size,
          saved_at: record.saved_at,
        });
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save file."));
      tx.onabort = () => reject(tx.error ?? new Error("Save aborted (storage may be full)."));
    });
  },

  async remove(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const SUPPORTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export const SUPPORTED_EXT = /\.(pdf|png|jpe?g|webp)$/i;

export function isSupported(file: File): boolean {
  if (SUPPORTED_MIME.includes(file.type)) return true;
  return SUPPORTED_EXT.test(file.name);
}
