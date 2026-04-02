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

const DB_VERSION = 5;
const PATIENTS_STORE = "patients";
const SYNC_QUEUE_STORE = "sync_queue";
const DOCTOR_REVIEWS_STORE = "doctor_reviews";
const AUDIT_LOG_STORE = "audit_log";

/**
 * Returns the current authenticated user's ID, or "anonymous" if not logged in.
 * Used to scope the IndexedDB database per user for data isolation.
 * @returns {Promise<string>}
 */
async function getDBName() {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id || "anonymous";
  return `RetinaScanDB_${uid}`;
}

/**
 * Uploads a retinal image (base64 data URL) to Supabase Storage.
 * Returns the public cloud URL, or null if upload fails (non-fatal).
 * @param {string} userId
 * @param {string} patientId
 * @param {string} base64DataUrl - data:image/jpeg;base64,...
 * @param {string} eyeLabel - e.g. 'od_scan' or 'od_heatmap'
 * @returns {Promise<string|null>}
 */
async function uploadRetinalImage(userId, patientId, base64DataUrl, eyeLabel) {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:image')) return null;
  try {
    const base64 = base64DataUrl.split(',')[1];
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([binary], { type: 'image/jpeg' });
    const fileName = `${userId}/${patientId}_${eyeLabel}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('patient-scans')
      .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) {
      console.warn('[Storage] Image upload error:', uploadError.message);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from('patient-scans')
      .getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('[Storage] Image upload failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Initializes and returns the IndexedDB instance, performing migrations if needed.
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
  const DB_NAME = await getDBName(); // user-scoped!
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

    // Duplicate check: skip insert if this patient_id already exists for this user
    const patientIdToCheck = patientRecord.patientId || patientRecord.id || '';
    if (patientIdToCheck) {
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_id', patientIdToCheck)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) {
        console.log('[savePatient] Duplicate blocked:', patientIdToCheck);
        return; // already saved — stop here
      }
    }

    // Upload all 4 retinal images to Supabase Storage in parallel.
    // od = right eye, os = left eye; _scan = original, _heatmap = AI overlay.
    const pid = patientRecord.patientId || patientRecord.id;

    const odImageBase64   = patientRecord.rightEye?.image_url   || patientRecord.imagePreview || null;
    const osImageBase64   = patientRecord.leftEye?.image_url    || null;
    const odHeatmapBase64 = patientRecord.rightEye?.heatmap_url || patientRecord.heatmap_url  || null;
    const osHeatmapBase64 = patientRecord.leftEye?.heatmap_url  || null;

    const [odImageUrl, osImageUrl, odHeatmapUrl, osHeatmapUrl] = await Promise.all([
      uploadRetinalImage(user.id, pid, odImageBase64,   'od_scan'),
      uploadRetinalImage(user.id, pid, osImageBase64,   'os_scan'),
      uploadRetinalImage(user.id, pid, odHeatmapBase64, 'od_heatmap'),
      uploadRetinalImage(user.id, pid, osHeatmapBase64, 'os_heatmap'),
    ]);

    // Try saving to Supabase
    const { error } = await supabase.from("patients").insert([
      {
        user_id: user.id,
        name: patientRecord.name || 'Unknown',
        age: Number(patientRecord.age) || 0,
        gender: patientRecord.gender || '',
        diagnosis: patientRecord.diagnosis || '',
        grade: patientRecord.grade,
        confidence: patientRecord.confidence,
        risk: patientRecord.risk || 'LOW',
        patient_id: patientRecord.patientId || patientRecord.id || '',
        contact: patientRecord.contact || '',
        diabetic_since: Number(patientRecord.diabeticSince) || 0,
        risk_score: patientRecord.risk_score || 0,
        urgency: patientRecord.urgency || '',
        created_at: patientRecord.timestamp || new Date().toISOString(),
        // Legacy single columns — kept for backward compat
        image_url:   odImageUrl,
        heatmap_url: odHeatmapUrl,
        // New per-eye columns
        od_image_url:   odImageUrl,
        os_image_url:   osImageUrl,
        od_heatmap_url: odHeatmapUrl,
        os_heatmap_url: osHeatmapUrl,
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
        id: cp.patient_id || cp.id.toString(), // Prefer string TN-ID over Postgres integer
        patientId: cp.patient_id || cp.id.toString(),
        name: cp.name,
        age: cp.age,
        gender: cp.gender,
        diagnosis: cp.diagnosis,
        grade: cp.grade,
        confidence: cp.confidence,
        risk: cp.risk,
        risk_score: cp.risk_score || 0,
        urgency: cp.urgency || '',
        contact: cp.contact || '',
        diabeticSince: cp.diabetic_since || 0,
        timestamp: cp.created_at,
        isFromCloud: true,
        user_id: user.id,
        // Legacy single columns
        image_url:   cp.image_url   || null,
        heatmap_url: cp.heatmap_url || null,
        // Per-eye cloud URLs — used by DoctorPortal, CampDashboard, ResultsView
        od_image_url:   cp.od_image_url   || cp.image_url   || null,
        os_image_url:   cp.os_image_url   || null,
        od_heatmap_url: cp.od_heatmap_url || cp.heatmap_url || null,
        os_heatmap_url: cp.os_heatmap_url || null,
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
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  const patients = await db.getAll(PATIENTS_STORE);
  // Double-filter by user_id for extra safety (DB is already user-scoped)
  const filtered = uid ? patients.filter(p => !p.user_id || p.user_id === uid) : patients;
  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Retrieves a single patient record by ID.
 * @param {string|number} id - The unique ID of the patient.
 * @returns {Promise<Object|undefined>} The patient record if found.
 */
export async function getPatientById(id) {
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

        const patientRecord = item.body;
        const pid = patientRecord.patientId || patientRecord.id;

        // 1. Duplicate check
        if (pid) {
          const { data: existingRecord } = await supabase
            .from('patients')
            .select('id')
            .eq('patient_id', pid)
            .eq('user_id', user.id)
            .maybeSingle();
          if (existingRecord) {
            console.log('[flushSyncQueue] Duplicate blocked:', pid);
            await dequeueRequest(item.id);
            succeededCount++;
            continue;
          }
        }

        // 2. Upload images if they are still base64 (offline-captured)
        const odImageBase64   = patientRecord.rightEye?.image_url   || patientRecord.image_url   || patientRecord.imagePreview || null;
        const osImageBase64   = patientRecord.leftEye?.image_url    || patientRecord.os_image_url || null;
        const odHeatmapBase64 = patientRecord.rightEye?.heatmap_url || patientRecord.heatmap_url || null;
        const osHeatmapBase64 = patientRecord.leftEye?.heatmap_url  || patientRecord.os_heatmap_url || null;

        const [odImageUrl, osImageUrl, odHeatmapUrl, osHeatmapUrl] = await Promise.all([
          uploadRetinalImage(user.id, pid, odImageBase64,   'od_scan'),
          uploadRetinalImage(user.id, pid, osImageBase64,   'os_scan'),
          uploadRetinalImage(user.id, pid, odHeatmapBase64, 'od_heatmap'),
          uploadRetinalImage(user.id, pid, osHeatmapBase64, 'os_heatmap'),
        ]);

        // 3. Insert into Supabase
        const { error } = await supabase.from("patients").insert([
          {
            user_id: user.id,
            name: patientRecord.name || 'Unknown',
            age: Number(patientRecord.age) || 0,
            gender: patientRecord.gender || '',
            diagnosis: patientRecord.diagnosis || '',
            grade: patientRecord.grade,
            confidence: patientRecord.confidence,
            risk: patientRecord.risk_level || patientRecord.risk || 'LOW',
            patient_id: pid || '',
            contact: patientRecord.contact || '',
            diabetic_since: Number(patientRecord.diabeticSince) || 0,
            risk_score: patientRecord.risk_score || 0,
            urgency: patientRecord.urgency || '',
            created_at: patientRecord.timestamp || new Date().toISOString(),
            // Map the cloud-uploaded URLs
            image_url:   odImageUrl,
            heatmap_url: odHeatmapUrl,
            od_image_url:   odImageUrl,
            os_image_url:   osImageUrl,
            od_heatmap_url: odHeatmapUrl,
            os_heatmap_url: osHeatmapUrl,
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

