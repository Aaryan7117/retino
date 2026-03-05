/**
 * indexedDB.js  — Section 8: Offline-First Storage
 * Two object stores:
 *  • `patients`   — patient records with grade + timestamp indexes
 *  • `sync_queue` — POST requests queued while offline, retried when online
 */
import { openDB } from 'idb';

const DB_NAME = 'RetinaScanDB';
const DB_VERSION = 3;
const STORE = 'patients';
const SYNC_STORE = 'sync_queue';

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // Ensure patients store exists in v1 or v3 rescue
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'id' });
                    store.createIndex('date', 'timestamp');
                    store.createIndex('grade', 'grade');
                }
            }
            // Ensure sync queue store exists in v2 or v3 rescue
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains(SYNC_STORE)) {
                    const sq = db.createObjectStore(SYNC_STORE, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    sq.createIndex('createdAt', 'createdAt');
                }
            }
        },
    });
}

// ─── Patient records ─────────────────────────────────────────────────────────

/** Save or update a patient record. @param {Object} patientRecord — Must include `id` */
export async function savePatient(patientRecord) {
    const db = await getDB();
    return db.put(STORE, patientRecord);
}

/** Retrieve all patient records ordered by timestamp (newest first). */
export async function getAllPatients() {
    const db = await getDB();
    const patients = await db.getAll(STORE);
    return patients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/** Get a single patient by ID. */
export async function getPatient(id) {
    const db = await getDB();
    return db.get(STORE, id);
}

/** Delete a patient record. */
export async function deletePatient(id) {
    const db = await getDB();
    return db.delete(STORE, id);
}

/** Count total records. */
export async function countPatients() {
    const db = await getDB();
    return db.count(STORE);
}

// ─── Offline sync queue ──────────────────────────────────────────────────────

/**
 * Queue a failed fetch for background sync retry.
 * @param {{ url: string, method: string, body: any }} request
 */
export async function enqueueRequest(request) {
    const db = await getDB();
    return db.add(SYNC_STORE, { ...request, createdAt: new Date().toISOString() });
}

/** Retrieve all queued requests ordered by creation time. */
export async function getQueuedRequests() {
    const db = await getDB();
    const items = await db.getAll(SYNC_STORE);
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/** Remove a queued request after successful retry. */
export async function dequeueRequest(id) {
    const db = await getDB();
    return db.delete(SYNC_STORE, id);
}

/**
 * Flush all queued requests when the app comes back online.
 * Calls each request and removes it from the queue on success.
 * @returns {{ succeeded: number, failed: number }}
 */
export async function flushSyncQueue() {
    const queued = await getQueuedRequests();
    let succeeded = 0, failed = 0;

    for (const item of queued) {
        try {
            await fetch(item.url, {
                method: item.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.body),
            });
            await dequeueRequest(item.id);
            succeeded++;
        } catch {
            failed++;
        }
    }
    return { succeeded, failed };
}
