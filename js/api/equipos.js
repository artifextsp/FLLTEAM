// =====================================================================
//  API: equipos
// =====================================================================

const ApiEquipos = {
    async listar() {
        const { data, error } = await supabase
            .from("equipos")
            .select("*")
            .order("nombre", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async obtener(id) {
        const { data, error } = await supabase
            .from("equipos").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        return data;
    },

    async crear({ nombre, descripcion }) {
        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("equipos")
            .insert({
                coach_id: user.id,
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
            })
            .select().single();
        if (error) throw error;
        return data;
    },

    async actualizar(id, campos) {
        const { data, error } = await supabase
            .from("equipos").update(campos).eq("id", id)
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase.from("equipos").delete().eq("id", id);
        if (error) throw error;
    },
};
