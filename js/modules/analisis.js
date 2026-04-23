// =====================================================================
//  Módulo ANÁLISIS - Efectividad por misión y tendencias (Chart.js)
// =====================================================================

const ModuloAnalisis = (() => {
    let chart = null;

    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `<div class="card empty">
                <h2>Selecciona un equipo</h2></div>`;
            return;
        }

        cont.innerHTML = `
            <div class="page-header"><h2>Análisis de Misiones</h2></div>

            <div class="card">
                <h3>Efectividad por misión</h3>
                <div class="tabla-wrap">
                    <table class="tabla tabla--compact" id="tbl-efectividad">
                        <thead>
                            <tr>
                                <th>Cód.</th><th>Misión</th>
                                <th>Intentos</th><th>Completadas</th><th>Falladas</th>
                                <th>Efectividad</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>Tendencia de efectividad (últimas partidas)</h3>
                <div class="form-field">
                    <label for="sel-mision">Misión</label>
                    <select id="sel-mision"></select>
                </div>
                <canvas id="grafico-tendencia" height="120"></canvas>
            </div>

            <div class="card" id="card-bajas">
                <h3>⚠ Misiones con baja efectividad o tendencia decreciente</h3>
                <ul class="item-list" id="lista-bajas"></ul>
            </div>`;

        await cargar(equipoId);
    }

    function destroy() {
        if (chart) { chart.destroy(); chart = null; }
    }

    async function cargar(equipoId) {
        const [efec, tend, misiones] = await Promise.all([
            ApiMisiones.efectividad(),                   // vista
            ApiPartidas.tendenciaPorMision(equipoId),
            ApiMisiones.listar(),
        ]);

        pintarEfectividad(efec, misiones);

        const sel = document.getElementById("sel-mision");
        sel.innerHTML = misiones
            .map((m) => `<option value="${m.id}">${escapeHtml(m.codigo)} · ${escapeHtml(m.nombre_es)}</option>`)
            .join("");
        sel.addEventListener("change", () => pintarTendencia(sel.value, tend));
        if (misiones.length) pintarTendencia(misiones[0].id, tend);

        pintarAlertasBajas(efec, tend, misiones);
    }

    function pintarEfectividad(efec, misiones) {
        const byId = {};
        efec.forEach((e) => { byId[e.mision_id] = e; });
        const tbody = document.querySelector("#tbl-efectividad tbody");
        tbody.innerHTML = misiones.map((m) => {
            const e = byId[m.id] || {};
            const intentos = e.veces_intentada || 0;
            const ok       = e.veces_completada || 0;
            const fail     = e.veces_fallada || 0;
            const pct      = e.efectividad_pct || 0;
            const clase    = pct < 50 ? "text-dim" : "";
            return `<tr class="${clase}">
                <td><code>${escapeHtml(m.codigo)}</code></td>
                <td>${escapeHtml(m.nombre_es)}</td>
                <td>${intentos}</td>
                <td>${ok}</td>
                <td>${fail}</td>
                <td><strong>${pct}%</strong></td>
            </tr>`;
        }).join("");
    }

    function pintarTendencia(misionId, datos) {
        // Filtra filas de esa misión, ordena por fecha
        const filas = datos
            .filter((d) => d.mision_id === misionId && d.partidas?.fecha_hora)
            .sort((a, b) => new Date(a.partidas.fecha_hora) - new Date(b.partidas.fecha_hora));

        // Calcula porcentaje acumulado rolling (hasta cada punto)
        let ok = 0, total = 0;
        const labels = [];
        const serie  = [];
        filas.forEach((f) => {
            total += 1;
            if (f.completada) ok += 1;
            labels.push(formatearFecha(f.partidas.fecha_hora));
            serie.push(Math.round(10000 * ok / total) / 100);
        });

        if (chart) chart.destroy();
        const ctx = document.getElementById("grafico-tendencia");
        if (!ctx) return;

        chart = new Chart(ctx.getContext("2d"), {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Efectividad acumulada (%)",
                    data: serie,
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59,130,246,0.15)",
                    fill: true,
                    tension: 0.25,
                    pointRadius: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } },
                },
                plugins: { legend: { labels: { color: "#cbd5e1" } } },
            },
        });
    }

    function pintarAlertasBajas(efec, tendencia, misiones) {
        const byId = {};
        efec.forEach((e) => { byId[e.mision_id] = e; });

        // Tendencia decreciente: comparar la efectividad de la primera mitad
        // vs la segunda mitad de los intentos.
        const decrecientes = new Set();
        misiones.forEach((m) => {
            const filas = tendencia
                .filter((d) => d.mision_id === m.id)
                .sort((a, b) => new Date(a.partidas.fecha_hora) - new Date(b.partidas.fecha_hora));
            if (filas.length < 4) return;
            const mitad = Math.floor(filas.length / 2);
            const pct = (arr) => {
                if (!arr.length) return 0;
                const ok = arr.filter((f) => f.completada).length;
                return (ok / arr.length) * 100;
            };
            const a = pct(filas.slice(0, mitad));
            const b = pct(filas.slice(mitad));
            if (b < a - 10) decrecientes.add(m.id);   // cae >10 pp
        });

        const ul = document.getElementById("lista-bajas");
        const filas = misiones.filter((m) => {
            const e = byId[m.id];
            if (!e || (e.veces_intentada || 0) === 0) return false;
            return (e.efectividad_pct < 50) || decrecientes.has(m.id);
        });

        ul.innerHTML = filas.length === 0
            ? `<li class="text-dim">Sin alertas. ¡Buen trabajo!</li>`
            : filas.map((m) => {
                const e = byId[m.id];
                const etiqueta = decrecientes.has(m.id) ? "📉 Tendencia decreciente" : "⚠ Efectividad baja";
                return `<li>
                    <div>
                        <strong>${escapeHtml(m.codigo)} · ${escapeHtml(m.nombre_es)}</strong>
                        <div class="text-dim small">${e.efectividad_pct}% en ${e.veces_intentada} intentos · ${etiqueta}</div>
                    </div>
                </li>`;
            }).join("");
    }

    return { render, destroy };
})();
