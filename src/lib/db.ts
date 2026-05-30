/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo } from "../types";

const DB_NAME = "AndroidGalleryDB";
const STORE_NAME = "photos";
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB open error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function savePhotosToDB(photos: Photo[]): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing store
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);

    clearRequest.onsuccess = () => {
      if (photos.length === 0) {
        resolve();
        return;
      }

      let completedCount = 0;
      let hasError = false;

      photos.forEach((photo) => {
        const addRequest = store.put(photo);
        addRequest.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(addRequest.error);
          }
        };
        addRequest.onsuccess = () => {
          completedCount++;
          if (completedCount === photos.length && !hasError) {
            resolve();
          }
        };
      });
    };
  });
}

export async function getPhotosFromDB(): Promise<Photo[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}
