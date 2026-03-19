import { supabase } from "./supabaseClient";

export async function saveScan(result) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not logged in");

  const { error } = await supabase.from("scans").insert([
    {
      user_id: user.id,
      result: result,
    },
  ]);

  if (error) throw error;
}
