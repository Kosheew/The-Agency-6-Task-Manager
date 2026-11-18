// Налаштування спільної дошки (Supabase).
// Значення беруться з Supabase → Project Settings → API.
// anon key — публічний за задумом: усі права на запис перевіряє база (Row Level Security),
// тому його можна комітити. НЕ вставляйте сюди service_role key.
window.AGENCY_CONFIG = {
  supabaseUrl: "",       // наприклад: "https://abcdefghijklmnop.supabase.co"
  supabaseAnonKey: ""    // наприклад: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
};
