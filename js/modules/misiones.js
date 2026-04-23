// =====================================================================
//  Módulo MISIONES — listado de misiones de la temporada (solo lectura).
//  Muestra a qué LANZADA pertenece cada misión para el equipo activo.
//  La posición de lanzamiento se configura por lanzada en el módulo
//  "Lanzadas".
// =====================================================================

const ModuloMisiones = (() => {
    async function render(cont) {
        const equipoId = EquipoActivo.get();

        cont.innerHTML = `
            <div class="page-header">
                <h2>Misiones · UNEARTHED</h2>
                <div class="acciones text-dim small">
                    Edición en la base de datos (tabla <code>misiones</code>).
                </div>
            </div>
            <p class="text-dim small">
                Las posiciones de lanzamiento se configuran por
                <a href="#lanzadas">lanzada</a>, no por misión individual.
            </p>
            <div class="card">
                <div class="tabla-wrap">
                    <table class="tabla" id="tabla-misiones">
                        <thead>
                            <tr>
                                <th>Cód.</th>
                                <th>Nombre</th>
                                <th>Base</th>
                                <th>Bonus</th>
                                <th>Lanzada</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>`;

        const [misiones, lanzadas] = await Promise.all([
            ApiMisiones.listar(),
            equipoId ? ApiLanzadas.listar(equipoId) : Promise.resolve([]),
        ]);

        // Mapa mision_id → lanzada (nombre + posición resumida)
        const mapa = {};
        lanzadas.forEach((l) => {
            l.misiones.forEach((mm) => { mapa[mm.mision_id] = l; });
        });

        const tbody = document.querySelector("#tabla-misiones tbody");
        if (misiones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-dim text-c">
                No hay misiones cargadas. Ejecuta <code>sql/02_seed_unearthed.sql</code>.
            </td></tr>`;
            return;
        }

        misiones.forEach((m) => {
            const l = mapa[m.id];
            const posTxt = l
                ? `<strong>${escapeHtml(l.nombre)}</strong>` +
                  (l.orientacion
                      ? ` <span class="text-dim small">
                             (${escapeHtml(l.orientacion)} · #${l.numero_posicion ?? "-"} ·
                              ${l.direccion === "izq_der" ? "izq→der" : "der→izq"})
                          </span>`
                      : "")
                : `<span class="text-dim small">Sin asignar</span>`;

            const tr = document.createElement("tr");
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
                <td>${posTxt}</td>`;
            tbody.appendChild(tr);
        });

        if (!equipoId) {
            toast("Selecciona un equipo para ver sus lanzadas asociadas", "info");
        }
    }

    return { render };
})();
