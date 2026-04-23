// =====================================================================
//  API: cuadrillas (grupo nombrado de 4 jugadores)
// =====================================================================

const ApiCuadrillas = {
    async listar(equipoId = null) {
        let q = supabase.from("cuadrillas").select("*").order("nombre");
        if (equipoId) q = q.eq("equipo_id", equipoId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    async buscarPorNombre(equipoId, nombre) {
        const { data, error } = await supabase
            .from("cuadrillas").select("*")
            .eq("equipo_id", equipoId)
            .eq("nombre", nombre.trim())
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Crea la cuadrilla si no existe con ese nombre; si existe, la devuelve.
     * @param {{equipo_id:string, nombre:string, jugadores:string[]}} datos
     */
    async crearOObtener({ equipo_id, nombre, jugadores }) {
        const existente = await this.buscarPorNombre(equipo_id, nombre);
        if (existente) return existente;

        const user = await FllAuth.usuarioActual();
        const [j1, j2, j3, j4] = jugadores;
        const { data, error } = await supabase
            .from("cuadrillas")
            .insert({
                coach_id: user.id,
                equipo_id,
                nombre: nombre.trim(),
                jugador1_id: j1,
                jugador2_id: j2,
                jugador3_id: j3,
                jugador4_id: j4,
            })
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase.from("cuadrillas").delete().eq("id", id);
        if (error) throw error;
    },
};
