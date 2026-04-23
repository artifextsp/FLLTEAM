// =====================================================================
//  API: lanzadas (recorridos del equipo con posición de lanzamiento)
//  y su tabla de unión lanzadas_misiones (N:N con orden).
// =====================================================================

const ApiLanzadas = {
    /**
     * Lista todas las lanzadas del equipo junto con las misiones
     * asignadas (cada fila incluye `misiones: [{mision_id, orden}]`).
     * Ordenadas por campo `orden` ascendente.
     */
    async listar(equipoId) {
        const [{ data: lanzadas, error: e1 },
               { data: enlaces,  error: e2 }] = await Promise.all([
            supabase.from("lanzadas").select("*")
                .eq("equipo_id", equipoId).order("orden"),
            supabase.from("lanzadas_misiones").select("*")
                .eq("equipo_id", equipoId).order("orden"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const mapaEnlaces = {};
        (enlaces || []).forEach((x) => {
            mapaEnlaces[x.lanzada_id] ??= [];
            mapaEnlaces[x.lanzada_id].push({ mision_id: x.mision_id, orden: x.orden });
        });
        return (lanzadas || []).map((l) => ({
            ...l,
            misiones: mapaEnlaces[l.id] || [],
        }));
    },

    /** Devuelve todos los enlaces lanzada↔misión del equipo. */
    async enlacesPorEquipo(equipoId) {
        const { data, error } = await supabase
            .from("lanzadas_misiones").select("*")
            .eq("equipo_id", equipoId);
        if (error) throw error;
        return data || [];
    },

    /** Crea una lanzada nueva; devuelve la fila creada. */
    async crear({ equipo_id, nombre, descripcion = null,
                  base = null,
                  orientacion = null, numero_posicion = null,
                  direccion = null, orden = 0 }) {
        const user = await FllAuth.usuarioActual();
        const { data, error } = await supabase
            .from("lanzadas")
            .insert({
                coach_id: user.id,
                equipo_id, nombre, descripcion,
                base,
                orientacion, numero_posicion, direccion,
                orden,
            })
            .select().single();
        if (error) throw error;
        return data;
    },

    async actualizar(id, campos) {
        const { data, error } = await supabase
            .from("lanzadas")
            .update({ ...campos, actualizado_en: new Date().toISOString() })
            .eq("id", id)
            .select().single();
        if (error) throw error;
        return data;
    },

    async eliminar(id) {
        const { error } = await supabase.from("lanzadas").delete().eq("id", id);
        if (error) throw error;
    },

    /**
     * Añade una misión a una lanzada. Si esa misión ya pertenecía a
     * otra lanzada del MISMO equipo (constraint único equipo_id+mision_id),
     * primero la saca de la lanzada anterior. De ese modo el drag & drop
     * funciona como "mover".
     *
     * @param {{lanzada_id:string, mision_id:string, equipo_id:string,
     *          orden?:number}} datos
     */
    async asignarMision({ lanzada_id, mision_id, equipo_id, orden = 0 }) {
        // Quitar la misión de cualquier otra lanzada del mismo equipo.
        await supabase.from("lanzadas_misiones")
            .delete()
            .eq("equipo_id", equipo_id)
            .eq("mision_id", mision_id);
        const { error } = await supabase
            .from("lanzadas_misiones")
            .insert({ lanzada_id, mision_id, equipo_id, orden });
        if (error) throw error;
    },

    async quitarMision({ lanzada_id, mision_id }) {
        const { error } = await supabase
            .from("lanzadas_misiones")
            .delete()
            .eq("lanzada_id", lanzada_id)
            .eq("mision_id", mision_id);
        if (error) throw error;
    },

    /**
     * Reordenar las misiones dentro de una lanzada.
     * @param {string} lanzadaId
     * @param {string[]} misionIdsEnOrden
     */
    async reordenarMisiones(lanzadaId, misionIdsEnOrden) {
        const updates = misionIdsEnOrden.map((mid, i) =>
            supabase.from("lanzadas_misiones")
                .update({ orden: i })
                .eq("lanzada_id", lanzadaId)
                .eq("mision_id", mid)
        );
        const resultados = await Promise.all(updates);
        const err = resultados.find((r) => r.error);
        if (err) throw err.error;
    },

    /** Vista de efectividad por lanzada (para el módulo Análisis). */
    async efectividad(equipoId) {
        const { data, error } = await supabase
            .from("v_efectividad_lanzada").select("*")
            .eq("equipo_id", equipoId)
            .order("orden");
        if (error) throw error;
        return data || [];
    },
};
