async function requireAuth() {
  const { data } = await _supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }
  return data.session.user;
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

