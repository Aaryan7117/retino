/**
 * indexedDB.js — Handles offline-first storage using IndexedDB.
 * Manages patient records, a synchronization queue for offline actions,
 * doctor reviews, and audit logs.
 * 
 * Two main object stores:
 * - `patients`: Stores patient records with grade and timestamp indexes.
 * - `sync_queue`: Queues Supabase/API requests made while offline for later retry.
 */

import { openDB } from "idb";
import { supabase } from "../utils/supabaseClient";

const DB_NAME = "RetinaScanDB";
const DB_VERSION = 5;
const PATIENTS_STORE = "patients";
const SYNC_QUEUE_STORE = "sync_queue";
const DOCTOR_REVIEWS_STORE = "doctor_reviews";
const AUDIT_LOG_STORE = "audit_log";

/**
 * Initializes and returns the IndexedDB instance, performing migrations if needed.
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Ensure patients store exists in v1 or v3 rescue
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(PATIENTS_STORE)) {
          const store = db.createObjectStore(PATIENTS_STORE, { keyPath: "id" });
          store.createIndex("date", "timestamp");
          store.createIndex("grade", "grade");
        }
      }
      // Ensure sync queue store exists in v2 or v3 rescue
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const sq = db.createObjectStore(SYNC_QUEUE_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          sq.createIndex("createdAt", "createdAt");
        }
      }
      // Feature 4: Doctor reviews store (v4)
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(DOCTOR_REVIEWS_STORE)) {
          db.createObjectStore(DOCTOR_REVIEWS_STORE, { keyPath: "patientId" });
        }
      }
      // Feature 7: Audit log store (v5)
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains(AUDIT_LOG_STORE)) {
          db.createObjectStore(AUDIT_LOG_STORE, {
            keyPath: "id",
            autoIncrement: true,
          }).createIndex("ts", "ts");
        }
      }
    },
  });
}

// --- Patient records ------------------------------------------------------------

/**
 * Saves or updates a patient record locally and attempts to sync with Supabase.
 * If Supabase is unavailable (offline), the request is queued for later sync.
 * @param {Object} patientRecord - The patient record to save. Must include an `id`.
 * @returns {Promise<void>}
 */
export async function savePatient(patientRecord) {
  const db = await getDB();

  // Always save locally (offline-first)
  await db.put(PATIENTS_STORE, patientRecord);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("No user");

    // Try saving to Supabase
    const { error } = await supabase.from("patients").insert([
      {
        user_id: user.id,
        name: patientRecord.name || "Unknown",
        age: Number(patientRecord.age) || 0,
        gender: patientRecord.gender || "",
        diagnosis: patientRecord.diagnosis || "",
        grade: patientRecord.grade,
        confidence: patientRecord.confidence,
        risk: patientRecord.risk || "LOW",
        created_at: patientRecord.timestamp || new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    console.log("Saved to Supabase");
  } catch (err) {
    console.warn("Supabase failed, queuing for sync:", err.message);

    // Save to sync queue for later retry
    await enqueueRequest({
      url: "SUPABASE_INSERT_PATIENT", // symbolic identifier for manual handling in flushSyncQueue
      method: "SUPABASE",
      body: patientRecord,
    });
  }
}

/**
 * Fetches all past patients from Supabase for the current user and 
 * saves them locally to IndexedDB. This restores history across 
 * reinstalls or device changes.
 * @returns {Promise<void>}
 */
export async function syncPatientsFromCloud() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Not logged in, skip sync

    // Pull users history from cloud
    const { data: cloudPatients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    if (!cloudPatients || cloudPatients.length === 0) return;

    const db = await getDB();
    const tx = db.transaction(PATIENTS_STORE, 'readwrite');
    const store = tx.objectStore(PATIENTS_STORE);

    // Merge them down to local storage
    for (const cp of cloudPatients) {
      const localRecord = {
        id: cp.id.toString(), // Supabase's PK acts as the local IndexedDB key
        name: cp.name,
        age: cp.age,
        gender: cp.gender,
        diagnosis: cp.diagnosis,
        grade: cp.grade,
        confidence: cp.confidence,
        risk: cp.risk,
        timestamp: cp.created_at,
        isFromCloud: true // Marks it as missing massive image blobs
      };
      // put() overwrites locally if id matches, otherwise creates new entry
      await store.put(localRecord);
    }
    
    await tx.done;
    console.log(`Synced ${cloudPatients.length} patients from Supabase to IndexedDB.`);
  } catch (err) {
    console.warn("Cloud sync failed (possibly offline):", err.message);
  }
}

/**
 * Retrieves all patient records from local storage.
 * @returns {Promise<Array<Object>>} Array of patient records, newest first.
 */
export async function getAllPatients() {
  const db = await getDB();
  const patients = await db.getAll(PATIENTS_STORE);
  return patients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Retrieves a single patient record by ID.
 * @param {string|number} id - The unique ID of the patient.
 * @returns {Promise<Object|undefined>} The patient record if found.
 */
export async function getPatient(id) {
  const db = await getDB();
  return db.get(PATIENTS_STORE, id);
}

/**
 * Deletes a patient record from local storage.
 * @param {string|number} id - The unique ID of the patient to delete.
 * @returns {Promise<void>}
 */
export async function deletePatient(id) {
  const db = await getDB();
  return db.delete(PATIENTS_STORE, id);
}

/**
 * Counts the total number of patient records in local storage.
 * @returns {Promise<number>} The total count.
 */
export async function countPatients() {
  const db = await getDB();
  return db.count(PATIENTS_STORE);
}

// --- Offline sync queue ---------------------------------------------------------

/**
 * Queues a failed request for later background synchronization.
 * @param {Object} request - The request details.
 * @param {string} request.url - The target URL or symbolic identifier.
 * @param {string} request.method - The HTTP method or symbolic identifier.
 * @param {Object} request.body - The request body data.
 * @returns {Promise<number>} The ID of the queued item.
 */
export async function enqueueRequest(request) {
  const db = await getDB();
  return db.add(SYNC_QUEUE_STORE, {
    ...request,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all queued synchronization requests.
 * @returns {Promise<Array<Object>>} Array of queued requests, oldest first.
 */
export async function getQueuedRequests() {
  const db = await getDB();
  const items = await db.getAll(SYNC_QUEUE_STORE);
  return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Removes a request from the synchronization queue.
 * @param {number} id - The ID of the queued request to remove.
 * @returns {Promise<void>}
 */
export async function dequeueRequest(id) {
  const db = await getDB();
  return db.delete(SYNC_QUEUE_STORE, id);
}

/**
 * Attempts to flush the synchronization queue by retrying all queued requests.
 * @returns {Promise<{ succeeded: number, failed: number }>} Counts of success and failure.
 */
export async function flushSyncQueue() {
  const queuedRequests = await getQueuedRequests();
  let succeededCount = 0;
  let failedCount = 0;

  for (const item of queuedRequests) {
    try {
      if (item.method === "SUPABASE") {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("No user session");

        const { error } = await supabase.from("patients").insert([
          {
            user_id: user.id,
            name: item.body.name || "Unknown",
            age: Number(item.body.age) || 0,
            gender: item.body.gender || "",
            diagnosis: item.body.diagnosis || "",
            grade: item.body.grade,
            confidence: item.body.confidence,
            risk: item.body.risk || "LOW",
            created_at: item.body.timestamp || new Date().toISOString(),
          },
        ]);

        if (error) throw error;
      } else {
        // Handle standard API calls
        await fetch(item.url, {
          method: item.method || "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
      }

      await dequeueRequest(item.id);
      succeededCount++;
    } catch (err) {
      console.warn("Retry failed:", err.message);
      failedCount++;
    }
  }

  return { succeeded: succeededCount, failed: failedCount };
}

// --- Feature 4: Doctor Review Portal ------------------------------------------

/**
 * Saves a doctor's review for a specific patient.
 * @param {Object} review - The review data, including patientId.
 * @returns {Promise<void>}
 */
export async function saveReview(review) {
  const db = await getDB();
  return db.put(DOCTOR_REVIEWS_STORE, {
    ...review,
    reviewedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves a doctor's review for a specific patient.
 * @param {string|number} patientId - The unique ID of the patient.
 * @returns {Promise<Object|undefined>} The review data if found.
 */
export async function getReview(patientId) {
  const db = await getDB();
  return db.get(DOCTOR_REVIEWS_STORE, patientId);
}

/**
 * Retrieves all doctor reviews from local storage.
 * @returns {Promise<Array<Object>>} Array of all reviews.
 */
export async function getAllReviews() {
  const db = await getDB();
  return db.getAll(DOCTOR_REVIEWS_STORE);
}

// --- Feature 7: Audit Log ------------------------------------------------------

/**
 * Generates or retrieves a unique device ID for audit logging.
 * @private
 * @returns {string} The device ID.
 */
function _getDeviceId() {
  let deviceId = localStorage.getItem("rs_dev_id");
  if (!deviceId) {
    deviceId = "DEV-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    localStorage.setItem("rs_dev_id", deviceId);
  }
  return deviceId;
}

/**
 * Logs an event to the local audit log store.
 * @param {Object} event - The event data to log.
 * @returns {Promise<number>} The ID of the log entry.
 */
export async function logAudit(event) {
  const db = await getDB();
  return db.add(AUDIT_LOG_STORE, {
    ...event,
    ts: new Date().toISOString(),
    device: _getDeviceId(),
  });
}

/**
 * Retrieves recent audit log entries.
 * @param {number} limit - The maximum number of entries to retrieve (default 50).
 * @returns {Promise<Array<Object>>} Array of log entries, newest first.
 */
export async function getAuditLog(limit = 50) {
  const db = await getDB();
  const allLogs = await db.getAll(AUDIT_LOG_STORE);
  return allLogs.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
}

/**
 * CRITICAL: Convert a Blob or File to a Base64 data URL string.
 * This is used to persist images in IndexedDB because blob URLs (blob://...) 
 * are temporary and do not survive a page refresh. Base64 strings ensure 
 * that patient images remain viewable after the browser is closed or refreshed.
 * 
 * @param {Blob|File} blobOrFile - The image blob or file to convert.
 * @returns {Promise<string>} A Base64 data URL (data:image/jpeg;base64,...).
 */
export async function blobToBase64(blobOrFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("blobToBase64: FileReader failed"));
    reader.readAsDataURL(blobOrFile);
  });
}

