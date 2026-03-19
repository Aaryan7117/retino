import { supabase } from './supabaseClient'

// Signup
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) throw error

  // insert into profiles table
  await supabase.from('profiles').insert([
    {
      id: data.user.id,
      email: data.user.email
    }
  ])

  return data
}

// Login
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

// Logout
export async function logout() {
  await supabase.auth.signOut()
}

// Get current user
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data
}
