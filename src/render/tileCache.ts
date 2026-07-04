// Tile fetching with an IndexedDB cache and a concurrency limit. Returns
// ImageBitmaps ready for canvas/WebGL. Fetched via CORS so the resulting bitmap
// is not tainted (tile sources must send Access-Control-Allow-Origin).

const DB_NAME = "atlas-tiles";
const STORE = "tiles";
const MAX_CONCURRENT = 6;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// --- concurrency-limited fetch queue ---------------------------------
let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  active--;
  const next = waiting.shift();
  if (next) {
    active++;
    next();
  }
}

async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob | null> {
  await acquire();
  try {
    const res = await fetch(url, { mode: "cors", signal });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  } finally {
    release();
  }
}

/** Get a tile as an ImageBitmap: IndexedDB → network (cached) → decode. */
export async function getTile(
  key: string,
  url: string,
  signal?: AbortSignal,
): Promise<ImageBitmap | null> {
  try {
    let blob = await idbGet(key);
    if (!blob) {
      blob = await fetchBlob(url, signal);
      if (!blob) return null;
      idbPut(key, blob).catch(() => {});
    }
    if (signal?.aborted) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}
