// scanService.js — Handles saving scan results to the Supabase database

import { supabase } from "./supabaseClient";

/**
 * Saves a scan result to the Supabase 'scans' table for the current user.
 * @param {Object} scanResult - The result data of the scan to be saved.
 * @returns {Promise<void>}
 * @throws {Error} If the user is not logged in or if the database insertion fails.
 */
export async function saveScan(scanResult) {
  const { data: userData } = await supabase.auth.getUser();
  const currentUser = userData.user;

  if (!currentUser) throw new Error("User not logged in");

  const { error } = await supabase.from("scans").insert([
    {
      user_id: currentUser.id,
      result: scanResult,
    },
  ]);

  if (error) throw error;
}

