export const MAX_REQUEST_IMAGES = 3;
export const MAX_REQUEST_IMAGE_BYTES = 10 * 1024 * 1024;

export type PendingRequestImage = {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  createdAt: number;
  blob: Blob;
};

const DATABASE_NAME = "vanscout-request-drafts";
const DATABASE_VERSION = 1;
const IMAGE_STORE = "images";

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("Unable to open local photo storage"));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
        request.result.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Unable to save photos locally"));
    transaction.onabort = () => reject(transaction.error || new Error("Unable to save photos locally"));
  });
}

export async function loadPendingRequestImages(): Promise<PendingRequestImage[]> {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(IMAGE_STORE, "readonly");
    const request = transaction.objectStore(IMAGE_STORE).getAll();
    const images = await new Promise<PendingRequestImage[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as PendingRequestImage[]);
      request.onerror = () => reject(request.error || new Error("Unable to load locally saved photos"));
    });
    await transactionDone(transaction);
    return images.sort((left, right) => left.createdAt - right.createdAt).slice(0, MAX_REQUEST_IMAGES);
  } finally {
    database.close();
  }
}

export async function savePendingRequestImages(images: PendingRequestImage[]) {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE);
    store.clear();
    images.slice(0, MAX_REQUEST_IMAGES).forEach(image => store.put(image));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearPendingRequestImages() {
  await savePendingRequestImages([]);
}

export function pendingImagesFromFiles(files: File[]): PendingRequestImage[] {
  const createdAt = Date.now();
  return files.map((file, index) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    createdAt: createdAt + index,
    blob: file,
  }));
}

export async function syncPendingRequestImages(token: string, transportId?: string): Promise<boolean> {
  if (!token) return false;
  const images = await loadPendingRequestImages();
  if (!images.length) return true;

  const form = new FormData();
  if (transportId) form.set("transportId", transportId);
  images.forEach(image => {
    const file = new File([image.blob], image.name, { type: image.type, lastModified: image.lastModified });
    form.append("images", file);
  });
  const response = await fetch("/api/request-images", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) return false;
  await clearPendingRequestImages();
  return true;
}
