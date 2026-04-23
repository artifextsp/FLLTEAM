// =====================================================================
//  Configuración del proyecto (credenciales de Supabase)
//  NOTA: este archivo está en .gitignore — NO debe subirse al repo.
//        Usa `config.example.js` como plantilla para otros entornos.
// =====================================================================

window.FLL_CONFIG = {
    // URL base del proyecto Supabase (sin `/rest/v1/`).
    // El SDK @supabase/supabase-js construye internamente las rutas de
    // Auth, Realtime y REST a partir de esta URL.
    SUPABASE_URL: "https://akurcixckyochndjgylz.supabase.co",

    // Clave publicable (anon) — pública y segura para el frontend;
    // toda la autorización real se aplica vía RLS en PostgreSQL.
    SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXJjaXhja3lvY2huZGpneWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDE1NjIsImV4cCI6MjA5MjQ3NzU2Mn0.kRRWYpNnbqWHz6yaLVwxfLxgGqku1gCTet55UAhj-CA",
};
