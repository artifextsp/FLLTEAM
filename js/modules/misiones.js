// =====================================================================
//  Módulo MISIONES - Listado de misiones de la temporada + edición
//  de la posición de lanzamiento por equipo.
// =====================================================================

const ModuloMisiones = (() => {
    async function render(cont) {
        const equipoId = EquipoActivo.get();

        cont.innerHTML = `
            <div class="page-header">
                <h2>Misiones · UNEARTHED</h2>
                <div class="acciones text-dim small">
                    Las misiones se editan desde la base de datos (tabla <code>misiones</code>).
                </div>
            </div>
            <div class="card">
                <div class="tabla-wrap">
                    <table class="tabla" id="tabla-misiones">
                        <thead>
                            <tr>
                                <th>Cód.</th>
                                <th>Nombre</th>
                                <th>Base</th>
                                <th>Bonus</th>
                                <th>Posición</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>`;

        const [misiones, posiciones] = await Promise.all([
            ApiMisiones.listar(),
            equipoId ? ApiPosiciones.listarPorEquipo(equipoId) : Promise.resolve({}),
        ]);

        const tbody = document.querySelector("#tabla-misiones tbody");
        if (misiones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-dim text-c">
                No hay misiones cargadas. Ejecuta <code>sql/02_seed_unearthed.sql</code>.
            </td></tr>`;
            return;
        }

        misiones.forEach((m) => {
            const pos = posiciones[m.id];
            const tr  = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${escapeHtml(m.codigo)}</code></td>
                <td>
                    <div><strong>${escapeHtml(m.nombre_es)}</strong></div>
                    <div class="text-dim small">${escapeHtml(m.descripcion || "")}</div>
                </td>
                <td>${m.puntos_base}</td>
                <td>${(m.bonus || []).map((b) =>
                    `<span class="chip">+${b.puntos} ${escapeHtml(b.nombre)}</span>`
                ).join(" ")}</td>
                <td>${pos
                    ? `${escapeHtml(pos.orientacion)} · ${pos.numero ?? "-"} · ${escapeHtml(pos.direccion)}`
                    : `<span class="text-dim small">Sin definir</span>`}</td>
                <td>
                    <button class="btn btn--ghost btn--icon"
                            data-mision="${m.id}" title="Editar posición"
                            ${equipoId ? "" : "disabled"}>📍</button>
                </td>`;
            tr.querySelector("button").addEventListener("click", () =>
                editarPosicion(equipoId, m, pos)
            );
            tbody.appendChild(tr);
        });

        if (!equipoId) {
            toast("Selecciona un equipo para editar posiciones", "info");
        }
    }

    async function editarPosicion(equipoId, mision, pos) {
        if (!equipoId) { toast("Selecciona un equipo primero", "error"); return; }
        const html = `
            <div class="form-field">
                <label>Orientación</label>
                <select id="f-orient">
                    <option value="horizontal" ${pos?.orientacion === "horizontal" ? "selected" : ""}>Horizontal</option>
                    <option value="vertical"   ${pos?.orientacion === "vertical"   ? "selected" : ""}>Vertical</option>
                </select>
            </div>
            <div class="form-field">
                <label>Número identificador (del equipo)</label>
                <input type="number" id="f-num" value="${pos?.numero ?? ""}" />
            </div>
            <div class="form-field">
                <label>Dirección</label>
                <select id="f-dir">
                    <option value="izq_der" ${pos?.direccion === "izq_der" ? "selected" : ""}>Izquierda → Derecha</option>
                    <option value="der_izq" ${pos?.direccion === "der_izq" ? "selected" : ""}>Derecha → Izquierda</option>
                </select>
            </div>`;
        await abrirModal(`Posición · ${mision.codigo} ${mision.nombre_es}`, html, {
            okTexto: "Guardar",
            onSubmit: async (body) => {
                const orientacion = body.querySelector("#f-orient").value;
                const direccion   = body.querySelector("#f-dir").value;
                const numVal      = body.querySelector("#f-num").value;
                const numero      = numVal === "" ? null : parseInt(numVal, 10);
                await ApiPosiciones.guardar({
                    equipo_id: equipoId,
                    mision_id: mision.id,
                    orientacion, numero, direccion,
                });
                toast("Posición guardada", "success");
                Router.navegar();
            },
        });
    }

    return { render };
})();
