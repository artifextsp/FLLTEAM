// =====================================================================
//  API: partidas (lanzamientos de 2:30)
// =====================================================================

const ApiPartidas = {
    /**
     * Guarda una partida completa: cabecera + 4 jugadores + misiones.
     * Ejecuta inserciones secuenciales (atómicas a nivel fila); si algo
     * falla después de crear la cabecera, se intenta limpiar.
     *
     * @param {Object} payload
     *  - equipo_id, sesion_id?, cuadrilla_id?, dupla_azul_id?,
     *    dupla_roja_id?, cuadrilla_nombre?, dupla_azul_nombre?,
     *    dupla_roja_nombre?, duracion_segundos, puntaje_total,
     *    estado ("finalizada"|"descartada"), notas?
     *  - jugadores: [{jugador_id, base, companero_id, puntaje_individual}]
     *  - misiones:  [{mision_id, completada, fallada, bonus_obtenidos,
     *                 puntaje}]
     */
    async guardar(payload) {
        const user = await FllAuth.usuarioActual();

        const cabecera = {
            coach_id: user.id,
            equipo_id: payload.equipo_id,
            sesion_id: payload.sesion_id || null,
            cuadrilla_id: payload.cuadrilla_id || null,
            dupla_azul_id: payload.dupla_azul_id || null,
            dupla_roja_id: payload.dupla_roja_id || null,
            cuadrilla_nombre: payload.cuadrilla_nombre || null,
            dupla_azul_nombre: payload.dupla_azul_nombre || null,
            dupla_roja_nombre: payload.dupla_roja_nombre || null,
            duracion_segundos: payload.duracion_segundos ?? 150,
            puntaje_total: payload.puntaje_total ?? 0,
            estado: payload.estado || "finalizada",
            notas: payload.notas || null,
        };

        const { data: partida, error: errCab } = await supabase
            .from("partidas").insert(cabecera).select().single();
        if (errCab) throw errCab;

        try {
            if (payload.jugadores?.length) {
                const filas = payload.jugadores.map((j) => ({
                    partida_id: partida.id,
                    jugador_id: j.jugador_id,
                    base: j.base,
                    companero_id: j.companero_id || null,
                    puntaje_individual: j.puntaje_individual ?? 0,
                }));
                const { error } = await supabase
                    .from("partidas_jugadores").insert(filas);
                if (error) throw error;
            }

            if (payload.misiones?.length) {
                const filas = payload.misiones.map((m) => ({
                    partida_id: partida.id,
                    mision_id: m.mision_id,
                    completada: !!m.completada,
                    fallada: !!m.fallada,
                    bonus_obtenidos: m.bonus_obtenidos || [],
                    puntaje: m.puntaje ?? 0,
                }));
                const { error } = await supabase
                    .from("partidas_misiones").insert(filas);
                if (error) throw error;
            }
        } catch (err) {
            // Intentar limpiar la cabecera si fallaron los detalles
            await supabase.from("partidas").delete().eq("id", partida.id);
            throw err;
        }

        return partida;
    },

    /** Lista partidas del equipo (más recientes primero). */
    async listar(equipoId, limite = 100) {
        let q = supabase
            .from("partidas").select("*")
            .eq("estado", "finalizada")
            .order("fecha_hora", { ascending: false })
            .limit(limite);
        if (equipoId) q = q.eq("equipo_id", equipoId);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    /** Detalles de una partida (jugadores + misiones). */
    async detalle(partidaId) {
        const [{ data: p }, jug, mis] = await Promise.all([
            supabase.from("partidas").select("*").eq("id", partidaId).single(),
            supabase.from("partidas_jugadores").select("*").eq("partida_id", partidaId),
            supabase.from("partidas_misiones").select("*").eq("partida_id", partidaId),
        ]);
        return { partida: p, jugadores: jug.data || [], misiones: mis.data || [] };
    },

    /** Para análisis: todas las filas partida+misión del equipo. */
    async tendenciaPorMision(equipoId) {
        const { data, error } = await supabase
            .from("partidas_misiones")
            .select("mision_id, completada, fallada, puntaje, partidas!inner(fecha_hora, equipo_id, estado)")
            .eq("partidas.equipo_id", equipoId)
            .eq("partidas.estado", "finalizada");
        if (error) throw error;
        return data || [];
    },
};
