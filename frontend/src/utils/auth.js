// auth.js — Handles authentication: signUp, login, logout, and getting user session

import { supabase } from './supabaseClient'

/**
 * Signs up a new user with email and password, and initializes their profile.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's desired password.
 * @returns {Promise<Object>} The authentication data.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) throw error
  return data
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @returns {Promise<Object>} The authentication data.
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

/**
 * Logs out the current user by ending their session.
 * Also deletes the user-scoped IndexedDB for full data privacy on shared browsers.
 * @returns {Promise<void>}
 */
export async function logout() {
  // Get the user's ID before signing out so we can delete their scoped DB
  try {
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id
    if (userId) {
      indexedDB.deleteDatabase(`RetinaScanDB_${userId}`)
      console.log(`[logout] Deleted IndexedDB: RetinaScanDB_${userId}`)
    }
  } catch (err) {
    console.warn('[logout] Could not delete user IndexedDB:', err.message)
  }

  await supabase.auth.signOut()
}

/**
 * Retrieves the current authenticated user's data.
 * @returns {Promise<Object|null>} The user data or null if not authenticated.
 */
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data
}

