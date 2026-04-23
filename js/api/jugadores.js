// =====================================================================
//  API: jugadores
// =====================================================================

const ApiJugadores = {
    /** Lista todos los jugadores del coach, opcionalmente por equipo. */
    async listar(equipoId = null) {
        let q = supabase.from("jugadores").select("*").order("nombre");
        if (equipoId) q = q.eq("equipo_id", equipoId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    async crear({ equipo_id, nombre }) {
        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("jugadores")
            .insert({
                coach_id: user.id,
                equipo_id,
                nombre: nombre.trim(),
            })
            .select().single();
        if (error) throw error;
        return data;
    },

    async actualizar(id, campos) {
        const { data, error } = await supabase
            .from("jugadores").update(campos).eq("id", id)
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase.from("jugadores").delete().eq("id", id);
        if (error) throw error;
    },

    /** Estadísticas (vía vista v_estadisticas_jugador). */
    async estadisticas(equipoId = null) {
        let q = supabase.from("v_estadisticas_jugador").select("*");
        if (equipoId) q = q.eq("equipo_id", equipoId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },
};
