// =====================================================================
//  Módulo JUGADORES - CRUD dentro del equipo activo, con stats
// =====================================================================

const ModuloJugadores = (() => {
    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `<div class="card empty">
                <h2>Selecciona un equipo</h2>
                <p>Elige un equipo en la barra superior.</p>
            </div>`;
            return;
        }

        cont.innerHTML = `
            <div class="page-header">
                <h2>Jugadores</h2>
                <div class="acciones">
                    <button class="btn" id="btn-nuevo-jugador">+ Nuevo jugador</button>
                </div>
            </div>
            <div class="card">
                <div class="tabla-wrap">
                    <table class="tabla" id="tabla-jugadores">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Lanz.</th>
                                <th>Total</th>
                                <th>Prom.</th>
                                <th>Azul</th>
                                <th>Roja</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>`;

        cont.querySelector("#btn-nuevo-jugador")
            .addEventListener("click", () => formulario(equipoId));

        await refrescar(equipoId);
    }

    async function refrescar(equipoId) {
        const [jugadores, stats] = await Promise.all([
            ApiJugadores.listar(equipoId),
            ApiJugadores.estadisticas(equipoId),
        ]);
        const statsPorId = {};
        stats.forEach((s) => { statsPorId[s.jugador_id] = s; });

        const tbody = document.querySelector("#tabla-jugadores tbody");
        if (!tbody) return;
        if (jugadores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-dim text-c">
                Aún no hay jugadores.</td></tr>`;
            return;
        }
        tbody.innerHTML = "";
        jugadores.forEach((j) => {
            const s = statsPorId[j.id] || {};
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${escapeHtml(j.nombre)}</strong></td>
                <td>${s.lanzamientos_totales || 0}</td>
                <td>${s.puntos_totales || 0}</td>
                <td>${s.promedio || 0}</td>
                <td><span class="chip chip--azul">${s.puntos_base_azul || 0}</span></td>
                <td><span class="chip chip--roja">${s.puntos_base_roja || 0}</span></td>
                <td class="text-c">
                    <button class="btn btn--ghost  btn--icon" data-accion="editar"  title="Editar">✎</button>
                    <button class="btn btn--danger btn--icon" data-accion="eliminar" title="Eliminar">🗑</button>
                </td>`;
            tr.querySelector('[data-accion="editar"]')
                .addEventListener("click", () => formulario(equipoId, j));
            tr.querySelector('[data-accion="eliminar"]')
                .addEventListener("click", () => eliminar(j, equipoId));
            tbody.appendChild(tr);
        });
    }

    async function formulario(equipoId, jugador = null) {
        const html = `
            <div class="form-field">
                <label>Nombre</label>
                <input type="text" id="f-nombre" required
                       value="${escapeHtml(jugador?.nombre || "")}" />
            </div>`;
        await abrirModal(jugador ? "Editar jugador" : "Nuevo jugador", html, {
            okTexto: "Guardar",
            onSubmit: async (body) => {
                const nombre = body.querySelector("#f-nombre").value.trim();
                if (!nombre) { toast("Nombre obligatorio", "error"); return false; }
                if (jugador) {
                    await ApiJugadores.actualizar(jugador.id, { nombre });
                } else {
                    await ApiJugadores.crear({ equipo_id: equipoId, nombre });
                }
                await refrescar(equipoId);
                toast("Guardado", "success");
            },
        });
    }

    async function eliminar(j, equipoId) {
        const ok = await confirmar(
            `Eliminar "${j.nombre}" borrará sus registros de partidas. ¿Continuar?`
        );
        if (!ok) return;
        try {
            await ApiJugadores.eliminar(j.id);
            await refrescar(equipoId);
            toast("Eliminado", "success");
        } catch (err) {
            toast(err.message, "error");
        }
    }

    return { render };
})();
