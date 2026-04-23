// =====================================================================
//  API: duplas (grupo nombrado de 2 jugadores)
// =====================================================================

const ApiDuplas = {
    async listar(equipoId = null) {
        let q = supabase.from("duplas").select("*").order("nombre");
        if (equipoId) q = q.eq("equipo_id", equipoId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    async buscarPorNombre(equipoId, nombre) {
        const { data, error } = await supabase
            .from("duplas").select("*")
            .eq("equipo_id", equipoId)
            .eq("nombre", nombre.trim())
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Crea la dupla si no existe con ese nombre; si existe, la devuelve.
     * @param {{equipo_id:string, nombre:string, jugador_a_id:string,
     *          jugador_b_id:string}} datos
     */
    async crearOObtener({ equipo_id, nombre, jugador_a_id, jugador_b_id }) {
        const existente = await this.buscarPorNombre(equipo_id, nombre);
        if (existente) return existente;

        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("duplas")
            .insert({
                coach_id: user.id,
                equipo_id,
                nombre: nombre.trim(),
                jugador_a_id, jugador_b_id,
            })
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase.from("duplas").delete().eq("id", id);
        if (error) throw error;
    },
};
