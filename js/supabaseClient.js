// =====================================================================
//  Cliente global de Supabase
//  - Lee la config desde window.FLL_CONFIG (definida en /config.js).
//  - Expone `window.supabase` (instancia de cliente) y lo comparte
//    con todos los módulos.
// =====================================================================

(() => {
    const cfg = window.FLL_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
        console.error("[Supabase] Falta configuración en config.js");
        return;
    }
    // `window.supabase` comienza siendo la librería UMD; tras crear el
    // cliente, lo reemplazamos por la INSTANCIA para uso global.
    const lib    = window.supabase;
    const client = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
        realtime: { params: { eventsPerSecond: 5 } },
    });
    window.supabase = client;
})();
