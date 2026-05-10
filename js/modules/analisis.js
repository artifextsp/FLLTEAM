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
            <div class="page-header"><h2>Análisis</h2></div>

            <div class="card alertas-card" id="card-alertas">
                <div class="alertas-card__head">
                    <h3>🔔 Campana de alertas</h3>
                    <span class="alertas-card__resumen" id="alertas-resumen"></span>
                </div>
                <p class="text-dim small">
                    Avisos automáticos: <strong>ajuste</strong> (3+ fallos seguidos),
                    <strong>inconsistencia</strong> (puntaje variable) y
                    <strong>estabilidad</strong> (5+ aciertos seguidos).
                </p>
                <div class="alertas-stack" id="lista-alertas"></div>
            </div>

            <div class="card">
                <h3>🚀 Efectividad por lanzada (recorrido)</h3>
                <p class="text-dim small">
                    Orden: de <strong>menor</strong> a <strong>mayor</strong> efectividad.
                    Incluye los puntos máximos teóricos de la lanzada y el tiempo planificado del recorrido (segundos).
                </p>
                <div class="tabla-wrap">
                    <table class="tabla tabla--compact" id="tbl-lanzadas">
                        <thead>
                            <tr>
                                <th>Lanzada</th>
                                <th title="Suma de puntos máximos de las misiones de esta lanzada">Pts máx</th>
                                <th>Base</th>
                                <th>Tiempo</th>
                                <th>Posición</th>
                                <th>Misiones</th>
                                <th>Partidas</th>
                                <th>Intentos</th>
                                <th>Completadas</th>
                                <th>Efectividad</th>
                                <th>Puntos totales</th>
                                <th>Prom. / partida</th>
                                <th title="Promedio de puntos por minuto de recorrido planificado">Pt/min</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>🧩 Efectividad por misión</h3>
                <p class="text-dim small">
                    Orden: de <strong>menor</strong> a <strong>mayor</strong> efectividad (%).
                    La columna <em>Pts máx</em> indica los puntos teóricos que aporta cada misión —
                    úsala como referencia para priorizar.
                </p>
                <div class="tabla-wrap">
                    <table class="tabla tabla--compact" id="tbl-efectividad">
                        <thead>
                            <tr>
                                <th>Cód.</th><th>Misión</th>
                                <th title="Puntos máximos teóricos que da la misión">Pts máx</th>
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
                <div class="chart-wrap">
                    <canvas id="grafico-tendencia"></canvas>
                </div>
            </div>`;

        await cargar(equipoId);
    }

    function destroy() {
        if (chart) { chart.destroy(); chart = null; }
    }

    async function cargar(equipoId) {
        const [efec, tend, misiones, efecLanzadas, lanzadas] = await Promise.all([
            ApiMisiones.efectividad(),
            ApiPartidas.tendenciaPorMision(equipoId),
            ApiMisiones.listar(),
            ApiLanzadas.efectividad(equipoId),
            ApiLanzadas.listar(equipoId),
        ]);

        pintarEfectividadLanzadas(efecLanzadas, lanzadas, misiones);
        pintarEfectividad(efec, misiones);
        pintarSistemaAlertas(efec, tend, misiones, equipoId);

        const sel = document.getElementById("sel-mision");
        sel.innerHTML = misiones
            .map((m) => `<option value="${m.id}">${escapeHtml(m.codigo)} · ${escapeHtml(m.nombre_es)}</option>`)
            .join("");
        sel.addEventListener("change", () => pintarTendencia(sel.value, tend));
        if (misiones.length) pintarTendencia(misiones[0].id, tend);
    }

    function pintarEfectividadLanzadas(efec, lanzadas, misiones) {
        const misById = Object.fromEntries(misiones.map((m) => [m.id, m]));
        const enlacesPorLan = {};
        lanzadas.forEach((l) => {
            enlacesPorLan[l.id] = (l.misiones || []).map((mm) => misById[mm.mision_id]).filter(Boolean);
        });

        const filas = [...efec].sort(
            (a, b) => (Number(a.efectividad_pct || 0)) - (Number(b.efectividad_pct || 0))
        );

        const tbody = document.querySelector("#tbl-lanzadas tbody");
        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="text-dim text-c">
                No hay lanzadas configuradas. Créalas en la pestaña
                <a href="#lanzadas">Lanzadas</a>.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = filas.map((f) => {
            const misionesLan = enlacesPorLan[f.lanzada_id] || [];
            const ptsLanzada = misionesLan.reduce((s, m) => s + maxMision(m), 0);
            const baseChip = f.base
                ? `<span class="chip chip--${f.base} chip--xs">${f.base === "azul" ? "Azul" : "Roja"}</span>`
                : `<span class="text-dim small">—</span>`;
            const tSeg = f.tiempo_recorrido_seg;
            const tiempoCell = (tSeg != null && tSeg > 0)
                ? `<span class="small">${escapeHtml(formatearTiempo(tSeg))}</span>
                   <div class="text-dim small">${tSeg}s</div>`
                : `<span class="text-dim small">—</span>`;
            const prom = Number(f.promedio_puntos_por_partida || 0);
            const ptMin = (tSeg != null && tSeg > 0)
                ? `<strong>${(prom * 60 / tSeg).toFixed(1)}</strong>`
                : `<span class="text-dim small">—</span>`;
            const posTxt = f.orientacion
                ? `${escapeHtml(f.orientacion)} · #${f.numero_posicion ?? "-"} ·
                   ${f.direccion === "izq_der" ? "izq→der" : "der→izq"}`
                : `<span class="text-dim small">Sin posición</span>`;
            const misionesList = misionesLan
                .map((m) => `<span class="chip chip--xs">${escapeHtml(m.codigo)}</span>`)
                .join(" ") || `<span class="text-dim small">sin misiones</span>`;
            const efPct = Number(f.efectividad_pct || 0);
            const claseEf = efPct < 50 ? "badge--malo"
                        : efPct < 75   ? "badge--medio"
                                       : "badge--bueno";
            return `<tr>
                <td><strong>${escapeHtml(f.nombre)}</strong></td>
                <td><strong>${ptsLanzada}</strong> pt</td>
                <td>${baseChip}</td>
                <td>${tiempoCell}</td>
                <td class="small">${posTxt}</td>
                <td>${misionesList}</td>
                <td>${f.partidas_registradas || 0}</td>
                <td>${f.intentos_totales || 0}</td>
                <td>${f.completadas || 0}</td>
                <td><span class="badge ${claseEf}">${efPct}%</span></td>
                <td><strong>${f.puntos_totales || 0}</strong></td>
                <td><strong>${f.promedio_puntos_por_partida || 0}</strong></td>
                <td>${ptMin}</td>
            </tr>`;
        }).join("");
    }

    function pintarEfectividad(efec, misiones) {
        const byId = {};
        efec.forEach((e) => { byId[e.mision_id] = e; });
        const tbody = document.querySelector("#tbl-efectividad tbody");
        const filas = misiones.map((m) => {
            const e = byId[m.id] || {};
            const intentos = e.veces_intentada || 0;
            const ok       = e.veces_completada || 0;
            const fail     = e.veces_fallada || 0;
            const pct      = Number(e.efectividad_pct || 0);
            return { m, intentos, ok, fail, pct, pmax: maxMision(m) };
        }).sort((a, b) => {
            if (a.intentos === 0 && b.intentos > 0) return 1;
            if (b.intentos === 0 && a.intentos > 0) return -1;
            return a.pct - b.pct;
        });

        tbody.innerHTML = filas.map(({ m, intentos, ok, fail, pct, pmax }) => {
            const clase    = pct < 50 ? "fila--alerta" : "";
            const badgeEf  = pct < 50 ? "badge--malo"
                          : pct < 75 ? "badge--medio"
                                     : "badge--bueno";
            const efTxt = intentos === 0
                ? `<span class="text-dim small">Sin datos</span>`
                : `<span class="badge ${badgeEf}">${pct}%</span>`;
            return `<tr class="${clase}">
                <td><code>${escapeHtml(m.codigo)}</code></td>
                <td>${escapeHtml(m.nombre_es)}</td>
                <td><strong>${pmax}</strong> pt</td>
                <td>${intentos}</td>
                <td>${ok}</td>
                <td>${fail}</td>
                <td>${efTxt}</td>
            </tr>`;
        }).join("");
    }

    function pintarTendencia(misionId, datos) {
        const filas = datos
            .filter((d) => d.mision_id === misionId && d.partidas?.fecha_hora)
            .sort((a, b) => new Date(a.partidas.fecha_hora) - new Date(b.partidas.fecha_hora));

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
                animation: { duration: 250 },
                scales: {
                    y: {
                        min: 0, max: 100,
                        ticks: { callback: (v) => v + "%", color: "#94a3b8", font: { size: 10 } },
                        grid:  { color: "rgba(148,163,184,0.12)" },
                    },
                    x: {
                        ticks: {
                            color: "#94a3b8",
                            font: { size: 10 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                        },
                        grid: { color: "rgba(148,163,184,0.08)" },
                    },
                },
                plugins: {
                    legend: { labels: { color: "#cbd5e1", boxWidth: 14, font: { size: 11 } } },
                    tooltip: { displayColors: false },
                },
                elements: {
                    point: { radius: 2, hoverRadius: 4 },
                    line:  { borderWidth: 2 },
                },
            },
        });
    }

    function secuenciaMision(tendencia, misionId) {
        return tendencia
            .filter((d) => d.mision_id === misionId && d.partidas?.fecha_hora)
            .sort((a, b) => new Date(a.partidas.fecha_hora) - new Date(b.partidas.fecha_hora));
    }

    function esExitoIntento(f) {
        return !!f.completada && !f.fallada;
    }

    function esFalloIntento(f) {
        return !!f.fallada || !f.completada;
    }

    function rachaDesdeElFinal(arr, okFn) {
        let n = 0;
        for (let i = arr.length - 1; i >= 0; i--) {
            if (okFn(arr[i])) n += 1;
            else break;
        }
        return n;
    }

    function contarTransicionesExito(arr) {
        if (arr.length < 2) return 0;
        let t = 0;
        for (let i = 1; i < arr.length; i++) {
            if (esExitoIntento(arr[i]) !== esExitoIntento(arr[i - 1])) t += 1;
        }
        return t;
    }

    function desviacion(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
        const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
        return Math.sqrt(v);
    }

    function pintarSistemaAlertas(efec, tendencia, misiones, equipoId) {
        const byId = {};
        efec.forEach((e) => { byId[e.mision_id] = e; });

        const decrecientes = new Set();
        misiones.forEach((m) => {
            const filas = secuenciaMision(tendencia, m.id);
            if (filas.length < 4) return;
            const mitad = Math.floor(filas.length / 2);
            const pct = (arr) => {
                if (!arr.length) return 0;
                const ok = arr.filter((f) => f.completada).length;
                return (ok / arr.length) * 100;
            };
            const a = pct(filas.slice(0, mitad));
            const b = pct(filas.slice(mitad));
            if (b < a - 10) decrecientes.add(m.id);
        });

        /** @type {{clase: string, titulo: string, texto: string, misionId: string}[]} */
        const items = [];

        misiones.forEach((m) => {
            const arr = secuenciaMision(tendencia, m.id);
            if (arr.length < 3) return;

            const mx = maxMision(m);
            const rachaFallos = rachaDesdeElFinal(arr, esFalloIntento);
            const rachaOk = rachaDesdeElFinal(arr, esExitoIntento);

            const ult = arr.slice(-6);
            const trans = contarTransicionesExito(ult);
            const pts = ult.map((f) => Number(f.puntaje) || 0);
            const sd = desviacion(pts);
            const cv = mx > 0 ? sd / mx : 0;

            if (rachaFallos >= 3) {
                items.push({
                    clase: "alerta-ficha--neg",
                    titulo: "Ajuste sugerido (racha de fallos)",
                    texto: `${m.codigo} · ${m.nombre_es}: en las últimas ${rachaFallos} lanzadas con registro, el resultado no fue completado correctamente. Conviene revisar la lanzada o la misión.`,
                    misionId: m.id,
                });
            }

            if (ult.length >= 5 && (trans >= 4 || cv >= 0.28)) {
                items.push({
                    clase: "alerta-ficha--warn",
                    titulo: "Inconsistencia",
                    texto: `${m.codigo} · ${m.nombre_es}: el desempeño oscila entre lanzadas (cambios frecuentes de éxito/fallo o puntaje variable). Estabilizar proceso o revisar roles.`,
                    misionId: m.id,
                });
            }

            if (rachaOk >= 5) {
                items.push({
                    clase: "alerta-ficha--pos",
                    titulo: "Estabilidad alcanzada",
                    texto: `${m.codigo} · ${m.nombre_es}: ${rachaOk} lanzadas seguidas completadas correctamente. Buen momento para documentar o subir dificultad.`,
                    misionId: m.id,
                });
            }
        });

        misiones.forEach((m) => {
            const e = byId[m.id];
            if (!e || (e.veces_intentada || 0) === 0) return;
            if ((e.efectividad_pct < 50) || decrecientes.has(m.id)) {
                const etiqueta = decrecientes.has(m.id) ? "Tendencia decreciente" : "Efectividad global baja";
                items.push({
                    clase: "alerta-ficha--warn",
                    titulo: "Revisar desempeño histórico",
                    texto: `${m.codigo} · ${m.nombre_es}: ${e.efectividad_pct}% en ${e.veces_intentada} intentos · ${etiqueta}.`,
                    misionId: m.id,
                });
            }
        });

        const cont = document.getElementById("lista-alertas");
        const resumen = document.getElementById("alertas-resumen");
        if (!cont) return;

        // Orden: negativas primero, luego warn, luego positivas
        const peso = { "alerta-ficha--neg": 0, "alerta-ficha--warn": 1, "alerta-ficha--pos": 2 };
        items.sort((a, b) => (peso[a.clase] ?? 9) - (peso[b.clase] ?? 9));

        const counts = { neg: 0, warn: 0, pos: 0 };
        items.forEach((it) => {
            if (it.clase === "alerta-ficha--neg") counts.neg += 1;
            else if (it.clase === "alerta-ficha--warn") counts.warn += 1;
            else if (it.clase === "alerta-ficha--pos") counts.pos += 1;
        });

        if (resumen) {
            if (items.length === 0) {
                resumen.innerHTML = `<span class="alerta-pill alerta-pill--neutro">Sin alertas</span>`;
            } else {
                const partes = [];
                if (counts.neg)  partes.push(`<span class="alerta-pill alerta-pill--neg">${counts.neg} ajuste${counts.neg !== 1 ? "s" : ""}</span>`);
                if (counts.warn) partes.push(`<span class="alerta-pill alerta-pill--warn">${counts.warn} aviso${counts.warn !== 1 ? "s" : ""}</span>`);
                if (counts.pos)  partes.push(`<span class="alerta-pill alerta-pill--pos">${counts.pos} estable${counts.pos !== 1 ? "s" : ""}</span>`);
                resumen.innerHTML = partes.join(" ");
            }
        }

        const cardAlertas = document.getElementById("card-alertas");
        if (cardAlertas) {
            cardAlertas.classList.toggle("alertas-card--has-neg", counts.neg > 0);
            cardAlertas.classList.toggle("alertas-card--has-warn", counts.warn > 0 && counts.neg === 0);
            cardAlertas.classList.toggle("alertas-card--has-pos", counts.pos > 0 && counts.warn === 0 && counts.neg === 0);
        }

        if (items.length === 0) {
            cont.innerHTML = `<div class="alerta-ficha alerta-ficha--neutro">
                <div class="alerta-ficha__tit">Sin alertas por ahora</div>
                <div class="text-dim small">Cuando acumules más lanzadas registradas aparecerán avisos de ajuste, inconsistencia o estabilidad.</div>
            </div>`;
            return;
        }

        const verLink = `<a href="#" class="link-ver-mision" data-equipo="${escapeHtml(equipoId)}">Ver en tendencia ↓</a>`;
        const ICON = {
            "alerta-ficha--neg":  "⚠️",
            "alerta-ficha--warn": "🔄",
            "alerta-ficha--pos":  "✅",
        };

        cont.innerHTML = items.map((it) => `
            <div class="alerta-ficha ${it.clase}" data-mision-alert="${it.misionId}">
                <div class="alerta-ficha__tit">
                    <span class="alerta-ficha__ico">${ICON[it.clase] || "•"}</span>
                    ${escapeHtml(it.titulo)}
                </div>
                <div class="alerta-ficha__txt">${escapeHtml(it.texto)}</div>
                <div class="alerta-ficha__acc">${verLink}</div>
            </div>
        `).join("");

        cont.querySelectorAll(".link-ver-mision").forEach((a) => {
            a.addEventListener("click", (ev) => {
                ev.preventDefault();
                const card = a.closest(".alerta-ficha");
                const mid = card?.getAttribute("data-mision-alert");
                const sel = document.getElementById("sel-mision");
                if (mid && sel) {
                    sel.value = mid;
                    sel.dispatchEvent(new Event("change", { bubbles: true }));
                    sel.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        });
    }

    return { render, destroy };
})();
