// =====================================================================
//  Módulo DASHBOARD — Seguimiento en tiempo real para el entrenador
//  ------------------------------------------------------------------
//  El entrenador usa esta pantalla (desde el celular) durante la
//  partida para medir el tiempo real de cada lanzada y cada cambio
//  de mecanismo versus los tiempos calculados por el sistema.
//
//  Flujo por base:
//    Lanzada 1 → Cambio 1 → Lanzada 2 → Cambio 2 → ... → Lanzada N
//
//  Barras duales por paso:
//    "Sistema": tiempo planificado — se agota de izquierda a derecha.
//    "Real":    tiempo medido por el entrenador — crece.
//  Si Real > Sistema, la barra real se torna roja.
// =====================================================================

const ModuloDashboard = (() => {
    const PARTIDA_SEG = 150;

    let state       = null;
    let gameTimerId = null;
    let baseTimers  = { azul: null, roja: null };
    let baseActiva  = "azul";

    // ------------------------------------------------------------------
    //  Render principal
    // ------------------------------------------------------------------
    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `<div class="card empty">
                <h2>Selecciona un equipo</h2>
                <p>Elige un equipo para usar el Dashboard del Entrenador.</p>
                <a class="btn" href="#equipos">Ir a equipos</a>
            </div>`;
            return;
        }

        const lanzadas = await ApiLanzadas.listar(equipoId);
        const secuencias = calcularSecuencias(lanzadas);

        state = {
            equipoId,
            secuencias,
            gameIniciado:   false,
            gameFinalizado: false,
            gameRestante:   PARTIDA_SEG,
            gameInicio:     null,
        };

        baseActiva = "azul";
        cont.innerHTML = plantilla();
        conectarEventos(cont);
        renderBase("azul");
        renderBase("roja");
        actualizarGameTimer();
        mostrarBase(baseActiva);

        window.addEventListener("equipo-activo-cambio", recargaPorCambioEquipo);
    }

    function destroy() {
        if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
        ["azul", "roja"].forEach((b) => {
            if (baseTimers[b]) { clearInterval(baseTimers[b]); baseTimers[b] = null; }
        });
        window.removeEventListener("equipo-activo-cambio", recargaPorCambioEquipo);
        state = null;
    }

    function recargaPorCambioEquipo() { Router.navegar(); }

    // ------------------------------------------------------------------
    //  Cálculo de secuencias
    // ------------------------------------------------------------------
    function calcularSecuencias(lanzadas) {
        const byBase = { azul: [], roja: [] };
        lanzadas.forEach((l) => {
            if (l.base === "azul" || l.base === "roja") byBase[l.base].push({ ...l });
        });
        ["azul", "roja"].forEach((b) =>
            byBase[b].sort((a, c) => (Number(a.orden) || 0) - (Number(c.orden) || 0))
        );

        const X = byBase.azul.reduce((s, l) => s + (Number(l.tiempo_recorrido_seg) || 0), 0);
        const Y = byBase.roja.reduce((s, l) => s + (Number(l.tiempo_recorrido_seg) || 0), 0);
        const K = PARTIDA_SEG - (X + Y);
        const P = K / 2;
        const nAzul = byBase.azul.length;
        const nRoja = byBase.roja.length;
        const cambiosAzul = Math.max(nAzul - 1, 1);
        const cambiosRoja = Math.max(nRoja - 1, 1);
        const tAzul = nAzul > 1 ? P / cambiosAzul : 0;
        const tRoja = nRoja > 1 ? P / cambiosRoja : 0;

        return {
            azul: { secuencia: buildSecuencia(byBase.azul, tAzul), curIdx: 0 },
            roja: { secuencia: buildSecuencia(byBase.roja, tRoja), curIdx: 0 },
        };
    }

    function buildSecuencia(launches, tCambio) {
        const seq = [];
        launches.forEach((l, i) => {
            seq.push({
                tipo:      "lanzada",
                id:        l.id,
                nombre:    l.nombre,
                tiempoPlan: Number(l.tiempo_recorrido_seg) || 0,
                tiempoReal: null,
                // estado: pendiente | en_curso | completado | fallido
                estado:    "pendiente",
                inicio:    null,       // cuando el entrenador presionó "start"
                fin:       null,
                fallida:   false,
                motivoFalla: null,
            });
            if (i < launches.length - 1) {
                seq.push({
                    tipo:       "cambio",
                    nombre:     `Cambio de mecanismo ${i + 1}`,
                    tiempoPlan: Math.round(tCambio * 10) / 10,
                    tiempoReal: null,
                    // estado: pendiente | sistema_activo | real_activo | completado
                    estado:     "pendiente",
                    inicioSistema: null,   // auto-inicia al completar la lanzada previa
                    inicio:        null,   // inicia cuando el entrenador presiona
                    fin:           null,
                });
            }
        });
        return seq;
    }

    // ------------------------------------------------------------------
    //  Plantilla HTML
    // ------------------------------------------------------------------
    function plantilla() {
        return `
        <section class="dashboard" id="dashboard">
            <div class="dash-header">
                <h2>🎯 Dashboard del Entrenador</h2>
                <div class="dash-game-timer" id="dash-game-timer">
                    <div class="dash-timer-estado" id="dash-timer-estado">Listo para iniciar</div>
                    <div class="dash-timer-tiempo" id="dash-timer-tiempo">02:30</div>
                    <div class="dash-timer-acciones">
                        <button class="btn btn--success btn--big" id="dash-btn-iniciar">▶ Iniciar Partida</button>
                        <button class="btn btn--danger" id="dash-btn-finalizar" hidden disabled>■ Finalizar</button>
                    </div>
                </div>
            </div>

            <div class="dash-tabs">
                <button class="dash-tab dash-tab--activo" id="tab-azul" data-base="azul">
                    🟦 Base Azul <span class="dash-tab-prog" id="tab-prog-azul"></span>
                </button>
                <button class="dash-tab" id="tab-roja" data-base="roja">
                    🟥 Base Roja <span class="dash-tab-prog" id="tab-prog-roja"></span>
                </button>
            </div>

            <div class="dash-contenido">
                <div class="dash-base" id="dash-base-azul">
                    <div id="dash-paso-azul"></div>
                    <div id="dash-historial-azul"></div>
                </div>
                <div class="dash-base dash-base--oculta" id="dash-base-roja">
                    <div id="dash-paso-roja"></div>
                    <div id="dash-historial-roja"></div>
                </div>
            </div>

            <div class="dash-resumen" id="dash-resumen" hidden></div>
        </section>`;
    }

    // ------------------------------------------------------------------
    //  Eventos
    // ------------------------------------------------------------------
    function conectarEventos(cont) {
        cont.querySelector("#dash-btn-iniciar").addEventListener("click", iniciarGame);
        cont.querySelector("#dash-btn-finalizar").addEventListener("click", () => finalizarGame(false));
        cont.querySelector("#tab-azul").addEventListener("click", () => mostrarBase("azul"));
        cont.querySelector("#tab-roja").addEventListener("click", () => mostrarBase("roja"));
    }

    function mostrarBase(base) {
        baseActiva = base;
        ["azul", "roja"].forEach((b) => {
            document.getElementById(`dash-base-${b}`)?.classList.toggle("dash-base--oculta", b !== base);
            document.getElementById(`tab-${b}`)?.classList.toggle("dash-tab--activo", b === base);
        });
    }

    // ------------------------------------------------------------------
    //  Game timer
    // ------------------------------------------------------------------
    function iniciarGame() {
        if (!state || state.gameIniciado) return;
        state.gameIniciado   = true;
        state.gameFinalizado = false;
        state.gameRestante   = PARTIDA_SEG;
        state.gameInicio     = Date.now();

        document.getElementById("dash-btn-iniciar").disabled = true;
        const btnFin = document.getElementById("dash-btn-finalizar");
        if (btnFin) { btnFin.hidden = false; btnFin.disabled = false; }
        document.getElementById("dash-timer-estado").textContent = "PARTIDA EN CURSO";

        const fin = Date.now() + PARTIDA_SEG * 1000;
        if (gameTimerId) clearInterval(gameTimerId);
        gameTimerId = setInterval(() => {
            const segs = Math.max(0, Math.round((fin - Date.now()) / 1000));
            state.gameRestante = segs;
            actualizarGameTimer();
            if (segs <= 0) finalizarGame(true);
        }, 200);

        renderBase("azul");
        renderBase("roja");
        toast("¡Partida iniciada! Usa los botones para seguir cada lanzada.", "success");
    }

    function finalizarGame(porTiempo = false) {
        if (!state) return;
        if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
        ["azul", "roja"].forEach((b) => {
            if (baseTimers[b]) { clearInterval(baseTimers[b]); baseTimers[b] = null; }
        });

        state.gameFinalizado = true;
        state.gameIniciado   = false;

        const btnFin = document.getElementById("dash-btn-finalizar");
        if (btnFin) btnFin.disabled = true;
        document.getElementById("dash-timer-estado").textContent =
            porTiempo ? "TIEMPO AGOTADO" : "PARTIDA FINALIZADA";

        renderBase("azul");
        renderBase("roja");
        renderResumen();
        toast("Partida finalizada. Revisa el resumen abajo.", "info");
    }

    function actualizarGameTimer() {
        const tiempoEl = document.getElementById("dash-timer-tiempo");
        const bloqueEl = document.getElementById("dash-game-timer");
        if (!tiempoEl || !state) return;
        tiempoEl.textContent = formatearTiempo(state.gameRestante);
        if (bloqueEl) {
            bloqueEl.classList.remove("dash-timer--alerta", "dash-timer--critico");
            if (state.gameIniciado) {
                if (state.gameRestante <= 10) bloqueEl.classList.add("dash-timer--critico");
                else if (state.gameRestante <= 30) bloqueEl.classList.add("dash-timer--alerta");
            }
        }
    }

    // ------------------------------------------------------------------
    //  Render del paso activo para una base
    // ------------------------------------------------------------------
    function renderBase(base) {
        const pasoCont = document.getElementById(`dash-paso-${base}`);
        if (!pasoCont || !state) return;

        const sec = state.secuencias[base];

        if (!sec || sec.secuencia.length === 0) {
            pasoCont.innerHTML = `<div class="card empty text-dim small" style="text-align:center;">
                Sin lanzadas configuradas para ${base === "azul" ? "Base Azul 🟦" : "Base Roja 🟥"}.<br>
                Agrégalas en <a href="#lanzadas">Lanzadas</a>.
            </div>`;
            renderHistorial(base);
            actualizarTabProg(base);
            return;
        }

        if (sec.curIdx >= sec.secuencia.length) {
            pasoCont.innerHTML = `<div class="dash-secuencia-ok">
                ✅ Secuencia completada — ${base === "azul" ? "Base Azul" : "Base Roja"}
            </div>`;
            renderHistorial(base);
            actualizarTabProg(base);
            return;
        }

        const paso     = sec.secuencia[sec.curIdx];
        const pasoNum  = sec.curIdx + 1;
        const totalPasos = sec.secuencia.length;
        const esLanzada  = paso.tipo === "lanzada";
        const esCambio   = paso.tipo === "cambio";

        // ── Barras ────────────────────────────────────────────────────
        // Sistema: barra de referencia estática (ancho proporcional a tiempoPlan)
        // Real:    crece con el tiempo real medido
        const tiempoPlan  = paso.tiempoPlan || 0;
        const maxDisplay  = Math.max(tiempoPlan * 1.5, 10);
        const sistemaPct  = tiempoPlan > 0 ? Math.min(100, (tiempoPlan / maxDisplay) * 100) : 0;

        // Tiempo real según el estado actual
        let realElapsed = 0;
        if (paso.estado === "en_curso" && paso.inicio) {
            realElapsed = (Date.now() - paso.inicio) / 1000;
        } else if (paso.estado === "real_activo" && paso.inicio) {
            realElapsed = (Date.now() - paso.inicio) / 1000;
        } else if (paso.tiempoReal !== null) {
            realElapsed = paso.tiempoReal;
        }

        const realPct    = Math.min(100, (realElapsed / maxDisplay) * 100);
        const realExcede = realElapsed > tiempoPlan && tiempoPlan > 0;

        // Tiempo sistema para cambios (desde que se auto-inició)
        let sistemaElapsedCambio = 0;
        let sistemaRemainingPct  = sistemaPct;
        if (esCambio && paso.inicioSistema) {
            sistemaElapsedCambio = (Date.now() - paso.inicioSistema) / 1000;
            const remaining = Math.max(0, tiempoPlan - sistemaElapsedCambio);
            sistemaRemainingPct = tiempoPlan > 0
                ? Math.min(100, (remaining / tiempoPlan) * sistemaPct) : 0;
        }

        const sistemaBarStyle = esCambio && paso.inicioSistema
            ? `width: ${sistemaRemainingPct}%;`
            : `width: ${sistemaPct}%;`;

        const tiempoRealStr = realElapsed > 0 ? `${realElapsed.toFixed(1)}s` : "—";
        const tiempoPlanStr = tiempoPlan > 0 ? `${tiempoPlan.toFixed(1)}s` : "N/D";

        // ── Botones de acción según tipo y estado ─────────────────────
        let accionesHTML = "";
        if (!state.gameIniciado && !state.gameFinalizado) {
            accionesHTML = `<p class="text-dim small dash-hint">Inicia la partida para comenzar el seguimiento.</p>`;
        } else if (state.gameFinalizado) {
            accionesHTML = `<p class="text-dim small dash-hint">Partida finalizada.</p>`;
        } else {
            if (esLanzada) {
                if (paso.estado === "pendiente") {
                    accionesHTML = `
                        <button class="btn btn--success btn--xl dash-btn-accion"
                            data-accion="iniciar" data-base="${base}">
                            ▶ Salió de base
                        </button>
                        <button class="btn btn--danger btn--xl dash-btn-accion"
                            data-accion="fallar" data-base="${base}">
                            ✗ Marcar fallida
                        </button>`;
                } else if (paso.estado === "en_curso") {
                    accionesHTML = `
                        <button class="btn btn--primary btn--xl dash-btn-accion"
                            data-accion="completar" data-base="${base}">
                            ⏹ Llegó a base
                        </button>
                        <button class="btn btn--danger btn--xl dash-btn-accion"
                            data-accion="fallar" data-base="${base}">
                            ✗ Marcar fallida
                        </button>`;
                }
            } else if (esCambio) {
                if (paso.estado === "sistema_activo") {
                    accionesHTML = `
                        <button class="btn btn--success btn--xl dash-btn-accion"
                            data-accion="iniciar-real" data-base="${base}">
                            ▶ Inició cambio de mecanismo
                        </button>`;
                } else if (paso.estado === "real_activo") {
                    accionesHTML = `
                        <button class="btn btn--primary btn--xl dash-btn-accion"
                            data-accion="completar" data-base="${base}">
                            ⏹ Terminó cambio
                        </button>`;
                }
            }
        }

        const enCursoClass = (paso.estado === "en_curso" || paso.estado === "real_activo")
            ? "dash-paso--en-curso" : "";
        const iconoTipo = esLanzada ? "🚀" : "⚙️";

        let sistemaNota = "";
        if (esCambio && paso.estado === "sistema_activo") {
            const restante = Math.max(0, tiempoPlan - sistemaElapsedCambio);
            sistemaNota = `<span class="dash-sistema-nota" id="dash-sistema-nota-${base}">
                ⏱ Sistema: ${restante.toFixed(1)}s restantes</span>`;
        }

        pasoCont.innerHTML = `
        <div class="dash-paso ${enCursoClass}" id="dash-paso-activo-${base}">
            <div class="dash-paso-header">
                <span class="dash-paso-num">Paso ${pasoNum} / ${totalPasos}</span>
                <span class="dash-paso-tipo">${iconoTipo} ${esLanzada ? "Lanzada" : "Cambio de mecanismo"}</span>
            </div>
            <div class="dash-paso-nombre">${escapeHtml(paso.nombre)}</div>

            <div class="dash-barras">
                <div class="dash-barra-row">
                    <span class="dash-barra-label">Sistema</span>
                    <div class="dash-barra-contenedor">
                        <div class="dash-barra dash-barra--sistema" id="dash-bar-sis-${base}"
                             style="${sistemaBarStyle}"></div>
                    </div>
                    <span class="dash-barra-tiempo" id="dash-bar-sis-t-${base}">
                        ${tiempoPlanStr}
                    </span>
                </div>
                <div class="dash-barra-row">
                    <span class="dash-barra-label">Real</span>
                    <div class="dash-barra-contenedor">
                        <div class="dash-barra dash-barra--real ${realExcede ? "dash-barra--excedida" : ""}"
                             id="dash-bar-real-${base}"
                             style="width: ${realPct}%;"></div>
                    </div>
                    <span class="dash-barra-tiempo" id="dash-bar-real-t-${base}">
                        ${tiempoRealStr}
                    </span>
                </div>
            </div>
            ${sistemaNota}
            <div class="dash-paso-acciones">
                ${accionesHTML}
            </div>
        </div>`;

        // Conectar botones
        pasoCont.querySelectorAll(".dash-btn-accion").forEach((btn) => {
            const accion = btn.dataset.accion;
            const b      = btn.dataset.base;
            if (accion === "iniciar")      btn.addEventListener("click", () => iniciarPaso(b));
            if (accion === "completar")    btn.addEventListener("click", () => completarPaso(b));
            if (accion === "fallar")       btn.addEventListener("click", () => fallarPaso(b));
            if (accion === "iniciar-real") btn.addEventListener("click", () => iniciarRealCambio(b));
        });

        // Arrancar timer de actualización de barras si el paso está activo
        const necesitaTimer = paso.estado === "en_curso" || paso.estado === "real_activo"
            || (esCambio && paso.estado === "sistema_activo");
        if (necesitaTimer) {
            if (baseTimers[base]) { clearInterval(baseTimers[base]); baseTimers[base] = null; }
            baseTimers[base] = setInterval(() => actualizarBarras(base), 100);
        }

        renderHistorial(base);
        actualizarTabProg(base);
    }

    // ------------------------------------------------------------------
    //  Actualización de barras (en tiempo real, sin re-render completo)
    // ------------------------------------------------------------------
    function actualizarBarras(base) {
        if (!state) return;
        const sec = state.secuencias[base];
        if (!sec || sec.curIdx >= sec.secuencia.length) return;
        const paso = sec.secuencia[sec.curIdx];

        const tiempoPlan = paso.tiempoPlan || 0;
        const maxDisplay = Math.max(tiempoPlan * 1.5, 10);

        // ── Barra Sistema (para cambios con inicio automático) ────────
        if (paso.tipo === "cambio" && paso.inicioSistema) {
            const sElapsed   = (Date.now() - paso.inicioSistema) / 1000;
            const remaining  = Math.max(0, tiempoPlan - sElapsed);
            const sisPct     = tiempoPlan > 0
                ? Math.min(100, (remaining / tiempoPlan) * (tiempoPlan / maxDisplay) * 100) : 0;
            const sisBar  = document.getElementById(`dash-bar-sis-${base}`);
            const sisNota = document.getElementById(`dash-sistema-nota-${base}`);
            if (sisBar) sisBar.style.width = `${sisPct}%`;
            if (sisNota) sisNota.textContent = `⏱ Sistema: ${remaining.toFixed(1)}s restantes`;
        }

        // ── Barra Real ────────────────────────────────────────────────
        if (paso.inicio) {
            const rElapsed  = (Date.now() - paso.inicio) / 1000;
            const realPct   = Math.min(100, (rElapsed / maxDisplay) * 100);
            const excede    = rElapsed > tiempoPlan && tiempoPlan > 0;

            const realBar  = document.getElementById(`dash-bar-real-${base}`);
            const realTxt  = document.getElementById(`dash-bar-real-t-${base}`);
            if (realBar) {
                realBar.style.width = `${realPct}%`;
                realBar.classList.toggle("dash-barra--excedida", excede);
            }
            if (realTxt) realTxt.textContent = `${rElapsed.toFixed(1)}s`;
        }
    }

    // ------------------------------------------------------------------
    //  Acciones del coach
    // ------------------------------------------------------------------
    function iniciarPaso(base) {
        if (!state || !state.gameIniciado) return;
        const sec = state.secuencias[base];
        if (!sec || sec.curIdx >= sec.secuencia.length) return;
        const paso = sec.secuencia[sec.curIdx];
        if (paso.estado !== "pendiente") return;

        paso.estado = "en_curso";
        paso.inicio = Date.now();

        if (baseTimers[base]) { clearInterval(baseTimers[base]); baseTimers[base] = null; }
        renderBase(base);
    }

    function iniciarRealCambio(base) {
        if (!state || !state.gameIniciado) return;
        const sec = state.secuencias[base];
        if (!sec || sec.curIdx >= sec.secuencia.length) return;
        const paso = sec.secuencia[sec.curIdx];
        if (paso.tipo !== "cambio" || paso.estado !== "sistema_activo") return;

        paso.estado = "real_activo";
        paso.inicio = Date.now();

        if (baseTimers[base]) { clearInterval(baseTimers[base]); baseTimers[base] = null; }
        renderBase(base);
    }

    function completarPaso(base) {
        if (!state) return;
        const sec = state.secuencias[base];
        if (!sec || sec.curIdx >= sec.secuencia.length) return;
        const paso = sec.secuencia[sec.curIdx];
        if (paso.estado !== "en_curso" && paso.estado !== "real_activo") return;

        if (baseTimers[base]) { clearInterval(baseTimers[base]); baseTimers[base] = null; }

        paso.fin       = Date.now();
        paso.tiempoReal = paso.inicio ? (paso.fin - paso.inicio) / 1000 : null;
        paso.estado    = "completado";
        sec.curIdx++;

        // Si el siguiente es un cambio, iniciar su timer de sistema automáticamente
        if (sec.curIdx < sec.secuencia.length) {
            const siguiente = sec.secuencia[sec.curIdx];
            if (siguiente.tipo === "cambio") {
                siguiente.estado        = "sistema_activo";
                siguiente.inicioSistema = Date.now();
            }
        }

        renderBase(base);
    }

    async function fallarPaso(base) {
        if (!state) return;
        const sec = state.secuencias[base];
        if (!sec || sec.curIdx >= sec.secuencia.length) return;
        const paso = sec.secuencia[sec.curIdx];
        if (paso.tipo !== "lanzada") return;

        const modalHtml = `
            <p>¿Por qué falló la lanzada <strong>${escapeHtml(paso.nombre)}</strong>?</p>
            <div class="form-field">
                <select id="f-motivo">
                    <option value="atascado">🤖 Robot atascado / trabado</option>
                    <option value="intervencion">🚶 Jugador intervino fuera de base</option>
                    <option value="tiempo">⏱ Se agotó el tiempo</option>
                    <option value="otro">Otro</option>
                </select>
            </div>`;

        await abrirModal("Marcar lanzada como fallida", modalHtml, {
            okTexto: "Confirmar falla",
            onSubmit: (body) => {
                const textos = {
                    atascado:     "Robot atascado / trabado",
                    intervencion: "Jugador intervino fuera de base",
                    tiempo:       "Tiempo agotado",
                    otro:         "Otro",
                };
                const motivo = body.querySelector("#f-motivo").value;
                if (baseTimers[base]) { clearInterval(baseTimers[base]); baseTimers[base] = null; }

                paso.estado     = "fallido";
                paso.fallida    = true;
                paso.motivoFalla = textos[motivo] || "Otro";
                paso.fin        = Date.now();
                paso.tiempoReal = paso.inicio ? (paso.fin - paso.inicio) / 1000 : null;
                sec.curIdx++;

                // Si el siguiente es un cambio, lo activamos en sistema igualmente
                if (sec.curIdx < sec.secuencia.length) {
                    const siguiente = sec.secuencia[sec.curIdx];
                    if (siguiente.tipo === "cambio") {
                        siguiente.estado        = "sistema_activo";
                        siguiente.inicioSistema = Date.now();
                    }
                }
            },
        });

        renderBase(base);
    }

    // ------------------------------------------------------------------
    //  Historial de pasos completados
    // ------------------------------------------------------------------
    function renderHistorial(base) {
        const cont = document.getElementById(`dash-historial-${base}`);
        if (!cont || !state) return;
        const sec = state.secuencias[base];
        if (!sec) return;

        const hechos = sec.secuencia.filter(
            (p) => p.estado === "completado" || p.estado === "fallido"
        );
        if (hechos.length === 0) { cont.innerHTML = ""; return; }

        cont.innerHTML = `
        <div class="dash-historial">
            <h4 class="dash-historial-titulo">📋 Historial</h4>
            ${hechos.map((p) => {
                const diff = (p.tiempoReal !== null && p.tiempoPlan > 0)
                    ? p.tiempoReal - p.tiempoPlan : null;
                const diffStr   = diff !== null
                    ? (diff >= 0 ? `+${diff.toFixed(1)}s` : `${diff.toFixed(1)}s`) : "";
                const diffClass = diff === null ? "" :
                    diff > 3 ? "dash-hist-diff--over" :
                    diff < -3 ? "dash-hist-diff--under" : "dash-hist-diff--ok";
                const iconoTipo   = p.tipo === "lanzada" ? "🚀" : "⚙️";
                const iconoEstado = p.estado === "fallido" ? "❌" : "✅";
                return `<div class="dash-hist-item ${p.estado === "fallido" ? "dash-hist-item--fallido" : ""}">
                    <span class="dash-hist-icono">${iconoEstado}</span>
                    <div class="dash-hist-info">
                        <span class="dash-hist-nombre">${iconoTipo} ${escapeHtml(p.nombre)}</span>
                        ${p.motivoFalla ? `<span class="dash-hist-motivo">${escapeHtml(p.motivoFalla)}</span>` : ""}
                    </div>
                    <div class="dash-hist-tiempos">
                        <span class="text-dim">${p.tiempoPlan > 0 ? p.tiempoPlan.toFixed(1) + "s" : "—"}</span>
                        <span class="dash-hist-flecha">→</span>
                        <span>${p.tiempoReal !== null ? p.tiempoReal.toFixed(1) + "s" : (p.estado === "fallido" ? "fallida" : "—")}</span>
                        ${diff !== null ? `<span class="dash-hist-diff ${diffClass}">${diffStr}</span>` : ""}
                    </div>
                </div>`;
            }).join("")}
        </div>`;
    }

    function actualizarTabProg(base) {
        const el = document.getElementById(`tab-prog-${base}`);
        if (!el || !state) return;
        const sec = state.secuencias[base];
        if (!sec || sec.secuencia.length === 0) { el.textContent = ""; return; }
        const total    = sec.secuencia.length;
        const hechos   = sec.secuencia.filter(
            (p) => p.estado === "completado" || p.estado === "fallido"
        ).length;
        el.textContent = `${hechos}/${total}`;
    }

    // ------------------------------------------------------------------
    //  Resumen final
    // ------------------------------------------------------------------
    function renderResumen() {
        const cont = document.getElementById("dash-resumen");
        if (!cont || !state) return;

        function bloqueBase(base) {
            const sec = state.secuencias[base];
            if (!sec || sec.secuencia.length === 0) return "";

            const lanzadas = sec.secuencia.filter((p) => p.tipo === "lanzada");
            const cambios  = sec.secuencia.filter((p) => p.tipo === "cambio");

            const sumPlanL  = lanzadas.reduce((s, p) => s + (p.tiempoPlan || 0), 0);
            const sumRealL  = lanzadas.reduce((s, p) => s + (p.tiempoReal || 0), 0);
            const sumPlanC  = cambios.reduce((s, p) => s + (p.tiempoPlan || 0), 0);
            const sumRealC  = cambios.reduce((s, p) => s + (p.tiempoReal || 0), 0);
            const fallidas  = lanzadas.filter((p) => p.fallida).length;

            const diffL = sumRealL - sumPlanL;
            const diffC = sumRealC - sumPlanC;

            const label = base === "azul" ? "🟦 Base Azul" : "🟥 Base Roja";

            const filaHtml = (p) => {
                const d = (p.tiempoReal !== null && p.tiempoPlan > 0)
                    ? p.tiempoReal - p.tiempoPlan : null;
                const dStr   = d !== null ? (d >= 0 ? `+${d.toFixed(1)}s` : `${d.toFixed(1)}s`) : "—";
                const dColor = d === null ? "" : d > 3 ? "#f87171" : d < -3 ? "#4ade80" : "#fbbf24";
                const est = p.estado === "fallido" ? "❌" : p.estado === "completado" ? "✅" : "⏳";
                const icono = p.tipo === "lanzada" ? "🚀" : "⚙️";
                return `<tr>
                    <td>${est} ${icono} ${escapeHtml(p.nombre)}</td>
                    <td>${p.tiempoPlan > 0 ? p.tiempoPlan.toFixed(1) + "s" : "—"}</td>
                    <td>${p.tiempoReal !== null ? p.tiempoReal.toFixed(1) + "s" : (p.estado === "fallido" ? "fallida" : "—")}</td>
                    <td style="color:${dColor};font-weight:bold;">${dStr}</td>
                </tr>`;
            };

            const diffLColor = diffL > 3 ? "#f87171" : diffL < -3 ? "#4ade80" : "#fbbf24";
            const diffCColor = diffC > 3 ? "#f87171" : diffC < -3 ? "#4ade80" : "#fbbf24";

            return `<div class="dash-resumen-bloque">
                <h4>${label}</h4>
                ${fallidas > 0 ? `<p class="dash-resumen-alerta">⚠ ${fallidas} lanzada(s) fallida(s)</p>` : ""}
                <div class="dash-resumen-tabla-wrap">
                    <table class="dash-resumen-tabla">
                        <thead>
                            <tr><th>Paso</th><th>Plan</th><th>Real</th><th>Dif.</th></tr>
                        </thead>
                        <tbody>
                            ${sec.secuencia.map(filaHtml).join("")}
                        </tbody>
                        <tfoot>
                            ${lanzadas.length > 0 ? `<tr class="dash-resumen-total">
                                <td><strong>Total lanzadas</strong></td>
                                <td><strong>${sumPlanL.toFixed(1)}s</strong></td>
                                <td><strong>${sumRealL.toFixed(1)}s</strong></td>
                                <td style="color:${diffLColor};font-weight:bold;">${diffL >= 0 ? "+" : ""}${diffL.toFixed(1)}s</td>
                            </tr>` : ""}
                            ${cambios.length > 0 ? `<tr class="dash-resumen-total">
                                <td><strong>Total cambios</strong></td>
                                <td><strong>${sumPlanC.toFixed(1)}s</strong></td>
                                <td><strong>${sumRealC.toFixed(1)}s</strong></td>
                                <td style="color:${diffCColor};font-weight:bold;">${diffC >= 0 ? "+" : ""}${diffC.toFixed(1)}s</td>
                            </tr>` : ""}
                        </tfoot>
                    </table>
                </div>
            </div>`;
        }

        cont.hidden = false;
        cont.innerHTML = `
        <h3>📊 Resumen de seguimiento</h3>
        <p class="text-dim small">Planeado vs. Real por cada paso.
            <span style="color:#4ade80;">Verde</span> = ganaste tiempo ·
            <span style="color:#f87171;">Rojo</span> = tiempo excedido.
        </p>
        <div class="dash-resumen-bloques">
            ${bloqueBase("azul")}
            ${bloqueBase("roja")}
        </div>`;
    }

    return { render, destroy };
})();
