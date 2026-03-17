/**
 * indexedDB.js  — Section 8: Offline-First Storage
 * Two object stores:
 *  • `patients`   — patient records with grade + timestamp indexes
 *  • `sync_queue` — POST requests queued while offline, retried when online
 */
import { openDB } from 'idb';

const DB_NAME = 'RetinaScanDB';
const DB_VERSION = 5;
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
            // Feature 4: Doctor reviews store (v4)
            if (oldVersion < 4) {
                if (!db.objectStoreNames.contains('doctor_reviews')) {
                    db.createObjectStore('doctor_reviews', { keyPath: 'patientId' });
                }
            }
            // Feature 7: Audit log store (v5)
            if (oldVersion < 5) {
                if (!db.objectStoreNames.contains('audit_log')) {
                    db.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true })
                        .createIndex('ts', 'ts');
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

// ─── Feature 4: Doctor Review Portal ───────────────────────────────────────

export async function saveReview(review) {
    const db = await getDB();
    return db.put('doctor_reviews', { ...review, reviewedAt: new Date().toISOString() });
}

export async function getReview(patientId) {
    const db = await getDB();
    return db.get('doctor_reviews', patientId);
}

export async function getAllReviews() {
    const db = await getDB();
    return db.getAll('doctor_reviews');
}

// ─── Feature 7: Audit Log ────────────────────────────────────────────────────

function _devId() {
    let id = localStorage.getItem('rs_dev_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        localStorage.setItem('rs_dev_id', id);
    }
    return id;
}

export async function logAudit(evt) {
    const db = await getDB();
    return db.add('audit_log', { ...evt, ts: new Date().toISOString(), device: _devId() });
}

export async function getAuditLog(n = 50) {
    const db = await getDB();
    const all = await db.getAll('audit_log');
    return all.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, n);
}

/**
 * Convert a Blob or File to a Base64 data URL string.
 * Used to persist images in IndexedDB so they survive page refresh.
 * @param {Blob|File} blobOrFile
 * @returns {Promise<string>} data:image/jpeg;base64,... string
 */
export async function blobToBase64(blobOrFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('blobToBase64: FileReader failed'));
    reader.readAsDataURL(blobOrFile);
  });
}
