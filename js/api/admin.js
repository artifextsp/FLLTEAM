// =====================================================================
//  API: administración de usuarios
// =====================================================================

const ApiAdmin = {
    async listarUsuarios() {
        const { data, error } = await supabase
            .from("perfiles_usuario")
            .select("*")
            .order("creado_en", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async crearUsuario({ email, passwordTemporal, nombre, rol, activo }) {
        const { data, error } = await supabase.rpc("admin_crear_usuario", {
            p_email: email,
            p_password: passwordTemporal,
            p_nombre: nombre || null,
            p_rol: rol || "coach",
            p_activo: activo !== false,
            p_debe_cambiar_password: true,
        });
        if (error) throw error;
        return data;
    },

    async resetearPassword({ userId, nuevaTemporal }) {
        const { data, error } = await supabase.rpc("admin_resetear_password", {
            p_user_id: userId,
            p_password_nueva: nuevaTemporal,
            p_debe_cambiar_password: true,
        });
        if (error) throw error;
        return data;
    },

    async actualizarPerfil(userId, cambios) {
        const { data, error } = await supabase
            .from("perfiles_usuario")
            .update(cambios)
            .eq("user_id", userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /** Elimina todas las partidas del equipo (rankings / lanzamientos). Requiere admin. */
    async purgarRankingEquipo(equipoId) {
        const { data, error } = await supabase.rpc("admin_purgar_ranking_equipo", {
            p_equipo_id: equipoId,
        });
        if (error) throw error;
        return data;
    },

    /** Elimina solo filas de misiones en partidas (efectividad / análisis). Requiere admin. */
    async purgarAnalisisMisionesEquipo(equipoId) {
        const { data, error } = await supabase.rpc("admin_purgar_analisis_misiones_equipo", {
            p_equipo_id: equipoId,
        });
        if (error) throw error;
        return data;
    },
};
