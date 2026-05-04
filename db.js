async function saveSessionToDB(name, sessionData) {
  const { data: { user } } = await _supabase.auth.getUser();

  const { data, error } = await _supabase
    .from("sessions")
    .upsert({
      user_id:         user.id,
      name:            name,
      delay:           sessionData.delay,
      selected_images: JSON.stringify(sessionData.selectedImages),
      buttons:         JSON.stringify(sessionData.buttons),
      updated_at:      new Date().toISOString(),
    }, { onConflict: "user_id,name" })
    .select();

  if (error) { console.error("Save error:", error); return null; }
  return data;
}

async function loadSessionsFromDB() {
  const { data, error } = await _supabase
    .from("sessions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) { console.error("Load error:", error); return []; }
  return data;
}

async function deleteSessionFromDB(id) {
  const { error } = await _supabase
    .from("sessions")
    .delete()
    .eq("id", id);

  if (error) console.error("Delete error:", error);
}