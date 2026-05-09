// =====================================================================
//  API: misiones (globales, solo lectura desde cliente)
// =====================================================================

const ApiMisiones = {
    async listar() {
        const { data, error } = await supabase
            .from("misiones")
            .select("*")
            .eq("activo", true)
            .order("orden", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async obtener(id) {
        const { data, error } = await supabase
            .from("misiones").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        return data;
    },

    /** Efectividad por misión (vista v_efectividad_mision), solo del coach actual. */
    async efectividad() {
        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("v_efectividad_mision")
            .select("*")
            .eq("coach_id", user.id);
        if (error) throw error;
        return data || [];
    },
};
