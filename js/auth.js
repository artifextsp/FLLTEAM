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

    /** Cambia la contraseña del usuario autenticado. */
    async cambiarMiPassword(passwordNueva) {
        const { data, error } = await supabase.auth.updateUser({
            password: passwordNueva,
        });
        if (error) throw error;
        return data;
    },

    /** Limpia el flag de cambio obligatorio de contraseña del usuario actual. */
    async marcarPasswordCambiada() {
        const { data, error } = await supabase.rpc("marcar_password_cambiada");
        if (error) throw error;
        return data;
    },

    /** Obtiene el perfil del usuario actual desde la DB. */
    async miPerfil() {
        const { data, error } = await supabase.rpc("mi_perfil");
        if (error) throw error;
        return data || null;
    },

    /** Devuelve true si el usuario actual es admin y está activo. */
    async esAdmin() {
        const { data, error } = await supabase.rpc("es_admin_actual");
        if (error) throw error;
        return !!data;
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
