// =====================================================================
//  API: posiciones de lanzamiento por misión (por equipo)
// =====================================================================

const ApiPosiciones = {
    /** Lista todas las posiciones del equipo (clave: mision_id). */
    async listarPorEquipo(equipoId) {
        const { data, error } = await supabase
            .from("posiciones_mision").select("*").eq("equipo_id", equipoId);
        if (error) throw error;
        const mapa = {};
        (data || []).forEach((p) => { mapa[p.mision_id] = p; });
        return mapa;
    },

    /**
     * Upsert de la posición para un par equipo+misión.
     * @param {{equipo_id:string, mision_id:string,
     *          orientacion:"horizontal"|"vertical",
     *          numero:number|null,
     *          direccion:"izq_der"|"der_izq"}} pos
     */
    async guardar(pos) {
        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("posiciones_mision")
            .upsert(
                { ...pos, coach_id: user.id, actualizado_en: new Date().toISOString() },
                { onConflict: "equipo_id,mision_id" }
            )
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase
            .from("posiciones_mision").delete().eq("id", id);
        if (error) throw error;
    },
};
