// =====================================================================
//  Autenticación de coaches (Supabase Auth, email + password)
// =====================================================================

const FllAuth = {
    /** Inicia sesión con email/contraseña. Lanza error si falla. */
    async iniciarSesion(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email, password,
        });
        if (error) throw error;
        return data;
    },

    /** Registra un nuevo coach. */
    async registrar(email, password) {
        const { data, error } = await supabase.auth.signUp({
            email, password,
        });
        if (error) throw error;
        return data;
    },

    /** Cierra la sesión actual. */
    async cerrarSesion() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    /** Obtiene el usuario actual (o null). */
    async usuarioActual() {
        const { data } = await supabase.auth.getUser();
        return data?.user || null;
    },

    /**
     * Garantiza que hay sesión iniciada; si no, redirige a login.html.
     * @returns {Promise<import("@supabase/supabase-js").User>}
     */
    async requireAuth() {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            window.location.replace("login.html");
            // Promesa que nunca resuelve para detener la ejecución aguas arriba.
            return new Promise(() => {});
        }
        return data.session.user;
    },
};
