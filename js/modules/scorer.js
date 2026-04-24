// =====================================================================
//  Módulo SCORER — Pantalla principal de lanzamiento (prioridad #1)
//  ---------------------------------------------------------------
//  Puntuación oficial UNEARTHED 2025-26 — máximo teórico 545 puntos.
//  Cada misión se puntúa con "controles tipados" (si_no / contador /
//  opciones). El puntaje se obtiene sumando únicamente los controles
//  activos; el % de cumplimiento es puntos_obtenidos / max_mision × 100.
//  Se conservan los estados derivados Completada (100 %) y Fallada
//  (toggle manual → puntaje = 0).
// =====================================================================

const ModuloScorer = (() => {
    // Estado del módulo (reinicia en cada render)
    let state = null;
    let timerId = null;

    // --------------------------------------------------------------
    //  Inicialización y render
    // --------------------------------------------------------------
    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `
                <div class="card empty">
                    <h2>Selecciona un equipo</h2>
                    <p>Elige un equipo en la barra superior para empezar a entrenar.</p>
                    <a class="btn" href="#equipos">Ir a equipos</a>
                </div>`;
            return;
        }

        // Cargar datos base en paralelo
        const [jugadores, misiones, lanzadas] = await Promise.all([
            ApiJugadores.listar(equipoId),
            ApiMisiones.listar(),
            ApiLanzadas.listar(equipoId),
        ]);

        // Mapa mision_id → lanzada (para mostrar en cada tarjeta)
        const lanzadaPorMision = {};
        lanzadas.forEach((l) => {
            l.misiones.forEach((mm) => { lanzadaPorMision[mm.mision_id] = l; });
        });

        state = {
            equipoId,
            jugadores,
            misiones,
            lanzadas,
            lanzadaPorMision,
            // Asignaciones
            baseAzul: [],          // array de jugador_id (máx 2)
            baseRoja: [],
            // Misiones en vivo: { [misionId]: { estado: null|'ok'|'fail', bonus: Set } }
            progresoMisiones: {},
            // Cronómetro
            duracion: 150,
            restante: 150,
            partidaEnCurso: false,
            partidaIniciada: false,
            partidaFinalizada: false,  // true tras finalizar, esperando Registrar
            partidaRegistrada: false,  // true tras guardar correctamente en BD
            inicio: null,
            // Metadatos opcionales
            cuadrillaNombre: "",
            duplaAzulNombre: "",
            duplaRojaNombre: "",
        };
        misiones.forEach((m) => {
            state.progresoMisiones[m.id] = nuevoEstadoMision();
        });

        cont.innerHTML = plantilla();
        conectarEventos(cont);
        renderJugadoresDisponibles();
        renderBases();
        renderMisiones();
        actualizarCronometro();

        // Listener para recargar si cambia el equipo activo
        window.addEventListener("equipo-activo-cambio", recargaPorCambioEquipo);
    }

    function destroy() {
        detenerTimer();
        window.removeEventListener("equipo-activo-cambio", recargaPorCambioEquipo);
        state = null;
    }

    function recargaPorCambioEquipo() {
        Router.navegar();
    }

    // --------------------------------------------------------------
    //  Plantilla HTML
    // --------------------------------------------------------------
    function plantilla() {
        return `
        <section class="scorer scorer--inactivo" id="scorer">
            <div class="scorer-top">
                <div>
                    <div class="cronometro" id="cronometro">
                        <div class="estado" id="crono-estado">Partida detenida</div>
                        <div class="tiempo" id="crono-tiempo">02:30</div>
                        <div class="score" id="crono-score">0 pts</div>
                        <div class="cronometro-acciones">
                            <button class="btn btn--success btn--big" id="btn-iniciar">▶ Iniciar</button>
                            <button class="btn btn--warning"        id="btn-finalizar" disabled>■ Finalizar</button>
                            <button class="btn btn--primary btn--big" id="btn-registrar" hidden>💾 Registrar</button>
                            <button class="btn btn--ghost"          id="btn-repetir">↻ Repetir</button>
                            <button class="btn btn--ghost"          id="btn-limpiar" title="Limpia los controles de todas las misiones (mantiene jugadores en las bases)">🧹 Limpiar controles</button>
                            <button class="btn btn--danger"         id="btn-descartar">✕ Descartar</button>
                        </div>
                    </div>
                </div>

                <div class="jugadores-disponibles">
                    <h3>Jugadores disponibles</h3>
                    <ul id="lista-jugadores"></ul>
                </div>
            </div>

            <div class="bases" id="bases">
                <div class="base base--azul" data-base="azul" aria-label="Base Azul">
                    <h3>🔵 Base Azul</h3>
                    <div class="slots" data-slots="azul"></div>
                </div>
                <div class="base base--roja" data-base="roja" aria-label="Base Roja">
                    <h3>🔴 Base Roja</h3>
                    <div class="slots" data-slots="roja"></div>
                </div>
            </div>

            <div class="config-partida">
                <div class="form-field">
                    <label for="in-cuadrilla">Cuadrilla (opcional)</label>
                    <input type="text" id="in-cuadrilla" placeholder="Ej. Alfa" />
                </div>
                <div class="form-field">
                    <label for="in-dupla-azul">Dupla Azul (opcional)</label>
                    <input type="text" id="in-dupla-azul" placeholder="Ej. Los Arqueólogos" />
                </div>
                <div class="form-field">
                    <label for="in-dupla-roja">Dupla Roja (opcional)</label>
                    <input type="text" id="in-dupla-roja" placeholder="Ej. Los Mineros" />
                </div>
            </div>

            <h3>Misiones</h3>
            <div class="misiones-grid" id="misiones-grid"></div>
        </section>`;
    }

    // --------------------------------------------------------------
    //  Conexión de eventos principales
    // --------------------------------------------------------------
    function conectarEventos(cont) {
        cont.querySelector("#btn-iniciar").addEventListener("click", iniciarPartida);
        cont.querySelector("#btn-finalizar").addEventListener("click", () => finalizarPartida(false));
        cont.querySelector("#btn-registrar").addEventListener("click", registrarPartida);
        cont.querySelector("#btn-repetir").addEventListener("click", repetirPartida);
        cont.querySelector("#btn-limpiar").addEventListener("click", limpiarControlesMisiones);
        cont.querySelector("#btn-descartar").addEventListener("click", descartarPartida);

        cont.querySelector("#in-cuadrilla").addEventListener("input", (e) => {
            state.cuadrillaNombre = e.target.value;
        });
        cont.querySelector("#in-dupla-azul").addEventListener("input", (e) => {
            state.duplaAzulNombre = e.target.value;
        });
        cont.querySelector("#in-dupla-roja").addEventListener("input", (e) => {
            state.duplaRojaNombre = e.target.value;
        });

        // Drop zones
        cont.querySelectorAll(".base").forEach(inicializarDropZone);
    }

    // --------------------------------------------------------------
    //  Render: jugadores disponibles y slots de bases
    // --------------------------------------------------------------
    function renderJugadoresDisponibles() {
        const ul = document.getElementById("lista-jugadores");
        if (!ul) return;
        const asignados = new Set([...state.baseAzul, ...state.baseRoja]);
        const disponibles = state.jugadores.filter((j) => !asignados.has(j.id));

        if (disponibles.length === 0) {
            ul.innerHTML = `<li class="text-dim small">Todos asignados</li>`;
            return;
        }
        ul.innerHTML = "";
        disponibles.forEach((j) => {
            const chip = crearChipJugador(j);
            ul.appendChild(chip);
        });
    }

    function renderBases() {
        ["azul", "roja"].forEach((base) => {
            const cont = document.querySelector(`[data-slots="${base}"]`);
            if (!cont) return;
            const lista = base === "azul" ? state.baseAzul : state.baseRoja;
            cont.innerHTML = "";
            for (let i = 0; i < 2; i++) {
                const jid = lista[i];
                if (jid) {
                    const j = state.jugadores.find((x) => x.id === jid);
                    const chip = crearChipJugador(j, { enBase: base });
                    cont.appendChild(chip);
                } else {
                    const vacio = crearElemento(
                        `<div class="slot-vacio">Arrastra un jugador aquí</div>`
                    );
                    cont.appendChild(vacio);
                }
            }
        });
    }

    /** Crea un chip arrastrable de jugador. */
    function crearChipJugador(j, { enBase = null } = {}) {
        const el = document.createElement("span");
        el.className = "jugador-chip";
        el.dataset.jugadorId = j.id;
        el.innerHTML = `${escapeHtml(j.nombre)}`;

        if (enBase) {
            const x = document.createElement("span");
            x.className = "x";
            x.textContent = "✕";
            x.title = "Quitar de la base";
            x.addEventListener("click", (e) => {
                e.stopPropagation();
                quitarDeBase(j.id);
            });
            el.appendChild(x);
            el.dataset.base = enBase;
        }

        inicializarDragChip(el);
        return el;
    }

    // --------------------------------------------------------------
    //  Drag & Drop (mouse + touch)  — sin librerías externas.
    // --------------------------------------------------------------
    function inicializarDragChip(el) {
        // Un único handler para mouse y touch, con Pointer Events.
        el.addEventListener("pointerdown", onPointerDown);
    }

    // Estado del drag actual
    let drag = null;

    function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;     // solo botón izquierdo
        e.preventDefault();

        const origen   = e.currentTarget;
        const jugadorId= origen.dataset.jugadorId;
        const baseOrig = origen.dataset.base || null;

        // Clon visual que sigue al cursor/dedo.
        const clon = origen.cloneNode(true);
        clon.classList.add("clon-dnd");
        clon.style.left = e.clientX + "px";
        clon.style.top  = e.clientY + "px";
        clon.style.transform = "translate(-50%, -50%) scale(1.05)";
        document.body.appendChild(clon);

        origen.classList.add("arrastrando");

        drag = { origen, clon, jugadorId, baseOrig };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup",   onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
        if (!drag) return;
        drag.clon.style.left = e.clientX + "px";
        drag.clon.style.top  = e.clientY + "px";

        // Resaltado de la base bajo el cursor
        document.querySelectorAll(".base.drop-over")
            .forEach((b) => b.classList.remove("drop-over"));
        const bajo = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest(".base");
        if (bajo) bajo.classList.add("drop-over");
    }

    function onPointerUp(e) {
        if (!drag) return;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup",   onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        const bajo = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest(".base");

        document.querySelectorAll(".base.drop-over")
            .forEach((b) => b.classList.remove("drop-over"));

        drag.clon.remove();
        drag.origen.classList.remove("arrastrando");

        if (bajo) {
            const destino = bajo.dataset.base;   // 'azul' | 'roja'
            asignarJugadorABase(drag.jugadorId, destino, drag.baseOrig);
        }
        drag = null;
    }

    function inicializarDropZone(baseEl) {
        // Respaldo con dragover nativo (no estrictamente necesario por
        // Pointer Events, pero permite soltar desde fuera si se usa HTML5 DnD).
        baseEl.addEventListener("dragover", (e) => e.preventDefault());
    }

    // --------------------------------------------------------------
    //  Lógica de asignación de jugadores a bases
    // --------------------------------------------------------------
    function asignarJugadorABase(jugadorId, destino, origen) {
        const lista = destino === "azul" ? state.baseAzul : state.baseRoja;
        const otraLista = destino === "azul" ? state.baseRoja : state.baseAzul;

        // Ya está en esa base
        if (lista.includes(jugadorId)) return;

        // Si venía de la otra base, quitar primero
        const idxOtra = otraLista.indexOf(jugadorId);
        if (idxOtra !== -1) otraLista.splice(idxOtra, 1);

        if (lista.length >= 2) {
            toast("La base ya tiene 2 jugadores", "error");
            return;
        }
        lista.push(jugadorId);
        renderJugadoresDisponibles();
        renderBases();
    }

    function quitarDeBase(jugadorId) {
        state.baseAzul = state.baseAzul.filter((id) => id !== jugadorId);
        state.baseRoja = state.baseRoja.filter((id) => id !== jugadorId);
        renderJugadoresDisponibles();
        renderBases();
    }

    // --------------------------------------------------------------
    //  Render de misiones (con toggles + bonus + posición)
    // --------------------------------------------------------------
    function renderMisiones() {
        const cont = document.getElementById("misiones-grid");
        if (!cont) return;
        cont.innerHTML = "";
        state.misiones.forEach((m) => {
            cont.appendChild(crearTarjetaMision(m));
        });
        actualizarScoreTotal();
    }

    /** Estado inicial de una misión: sin fallar y sin controles activos. */
    function nuevoEstadoMision() {
        return { fallada: false, valores: {} };
    }

    function crearTarjetaMision(m) {
        const prog    = state.progresoMisiones[m.id];
        const lanzada = state.lanzadaPorMision[m.id];
        const mx      = maxMision(m);

        const el = document.createElement("div");
        el.className = "mision-tarjeta";
        el.dataset.misionId = m.id;

        el.innerHTML = `
            <div class="mision-head">
                <span class="codigo">${escapeHtml(m.codigo)}</span>
                <span class="titulo">${escapeHtml(m.nombre_es)}</span>
                <span class="puntos">
                    <strong data-score>0</strong> / ${mx} pt
                    <span class="pct" data-pct>0%</span>
                </span>
            </div>
            ${m.descripcion ? `<div class="text-dim small">${escapeHtml(m.descripcion)}</div>` : ""}
            <div class="mision-progress">
                <div class="mision-progress__bar" data-bar></div>
            </div>
            <div class="mision-controles">${renderControles(m, prog)}</div>
            <div class="mision-actions">
                <button class="btn btn--ghost btn--sm" data-accion="reset" title="Limpiar todos los controles">
                    ↺ Limpiar
                </button>
                <button class="btn btn--danger btn--sm" data-accion="fail">
                    ✗ Marcar como fallada
                </button>
            </div>
            ${lanzada
                ? `<div class="mision-posicion">🚀 ${escapeHtml(lanzada.nombre)}${
                    lanzada.base
                        ? ` · ${lanzada.base === "azul" ? "🟦 Azul" : "🟥 Roja"}`
                        : ""
                  }${
                    (lanzada.tiempo_recorrido_seg ?? 0) > 0
                        ? ` · ⏱ ${formatearTiempo(lanzada.tiempo_recorrido_seg)}`
                        : ""
                  }${
                    lanzada.orientacion
                        ? ` · ${escapeHtml(lanzada.orientacion)} · #${lanzada.numero_posicion ?? "-"} · ${
                            lanzada.direccion === "izq_der" ? "izq→der" : "der→izq"}`
                        : ""
                  }</div>`
                : `<div class="mision-posicion text-dim">Sin lanzada asignada</div>`
            }
        `;

        conectarEventosControles(el, m);
        aplicarEstadoMision(el, m);
        return el;
    }

    /** Renderiza los controles tipados de una misión. */
    function renderControles(m, prog) {
        const controles = Array.isArray(m.bonus) ? m.bonus : [];
        if (controles.length === 0) {
            return `<p class="text-dim small">Sin controles configurados.</p>`;
        }
        return controles.map((c) => renderControl(c, prog)).join("");
    }

    function renderControl(c, prog) {
        const v = prog.valores[c.codigo];
        if (c.tipo === "contador") {
            const actual = Math.max(0, Math.min(c.max || 0, Number(v) || 0));
            return `
                <div class="ctrl ctrl--contador" data-codigo="${escapeHtml(c.codigo)}" data-tipo="contador" data-max="${c.max}">
                    <div class="ctrl-nombre">
                        ${escapeHtml(c.nombre)}
                        <span class="text-dim small">${c.puntos} pt c/u · máx ${c.max}</span>
                    </div>
                    <div class="ctrl-contador">
                        <button type="button" class="btn btn--ghost btn--icon" data-accion="menos">−</button>
                        <span class="ctrl-valor" data-valor>${actual}</span>
                        <span class="text-dim">/ ${c.max}</span>
                        <button type="button" class="btn btn--ghost btn--icon" data-accion="mas">+</button>
                    </div>
                </div>`;
        }
        if (c.tipo === "opciones") {
            const opciones = Array.isArray(c.opciones) ? c.opciones : [];
            return `
                <div class="ctrl ctrl--opciones" data-codigo="${escapeHtml(c.codigo)}" data-tipo="opciones">
                    <div class="ctrl-nombre">${escapeHtml(c.nombre)}</div>
                    <div class="ctrl-opciones">
                        ${opciones.map((o) =>
                            `<button type="button" class="pill" data-valor="${escapeHtml(String(o.valor))}">
                                ${escapeHtml(o.label ?? String(o.valor))}
                                <span class="text-dim small">${o.puntos} pt</span>
                            </button>`
                        ).join("")}
                    </div>
                </div>`;
        }
        // Default: si_no
        return `
            <div class="ctrl ctrl--si-no" data-codigo="${escapeHtml(c.codigo)}" data-tipo="si_no">
                <label class="ctrl-toggle">
                    <input type="checkbox" ${v === true ? "checked" : ""} />
                    <span class="ctrl-nombre">
                        ${escapeHtml(c.nombre)}
                        <span class="text-dim small">+${c.puntos} pt</span>
                    </span>
                </label>
            </div>`;
    }

    function conectarEventosControles(el, m) {
        const prog = state.progresoMisiones[m.id];

        el.querySelectorAll(".ctrl").forEach((ctrl) => {
            const codigo = ctrl.dataset.codigo;
            const tipo   = ctrl.dataset.tipo;

            if (tipo === "si_no") {
                const chk = ctrl.querySelector('input[type="checkbox"]');
                chk.addEventListener("change", () => {
                    if (!puedeEditarMisiones()) {
                        chk.checked = !chk.checked;
                        toast("Inicia la partida para marcar controles", "info");
                        return;
                    }
                    if (prog.fallada) prog.fallada = false;
                    prog.valores[codigo] = chk.checked;
                    aplicarEstadoMision(el, m);
                    actualizarScoreTotal();
                });
            } else if (tipo === "contador") {
                const max    = parseInt(ctrl.dataset.max, 10) || 0;
                const valorEl = ctrl.querySelector("[data-valor]");
                ctrl.querySelectorAll("button[data-accion]").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        if (!puedeEditarMisiones()) {
                            toast("Inicia la partida para marcar controles", "info");
                            return;
                        }
                        if (prog.fallada) prog.fallada = false;
                        const actual = Number(prog.valores[codigo] || 0);
                        const nuevo  = btn.dataset.accion === "mas"
                            ? Math.min(max, actual + 1)
                            : Math.max(0, actual - 1);
                        prog.valores[codigo] = nuevo;
                        valorEl.textContent = nuevo;
                        aplicarEstadoMision(el, m);
                        actualizarScoreTotal();
                    });
                });
            } else if (tipo === "opciones") {
                ctrl.querySelectorAll(".pill").forEach((pill) => {
                    pill.addEventListener("click", () => {
                        if (!puedeEditarMisiones()) {
                            toast("Inicia la partida para marcar controles", "info");
                            return;
                        }
                        if (prog.fallada) prog.fallada = false;
                        const valor = pill.dataset.valor;
                        // Toggle: si ya estaba seleccionado, deseleccionar.
                        prog.valores[codigo] = (prog.valores[codigo] === valor) ? null : valor;
                        aplicarEstadoMision(el, m);
                        actualizarScoreTotal();
                    });
                });
            }
        });

        const btnFail = el.querySelector('[data-accion="fail"]');
        btnFail.addEventListener("click", () => {
            if (!puedeEditarMisiones()) {
                toast("Inicia la partida para marcar misiones", "info");
                return;
            }
            prog.fallada = !prog.fallada;
            if (prog.fallada) prog.valores = {};
            // Refrescar toda la tarjeta para resincronizar los controles
            const nueva = crearTarjetaMision(m);
            el.replaceWith(nueva);
            actualizarScoreTotal();
        });

        const btnReset = el.querySelector('[data-accion="reset"]');
        btnReset.addEventListener("click", () => {
            if (!puedeEditarMisiones()) {
                toast("Inicia la partida primero", "info");
                return;
            }
            state.progresoMisiones[m.id] = nuevoEstadoMision();
            const nueva = crearTarjetaMision(m);
            el.replaceWith(nueva);
            actualizarScoreTotal();
        });
    }

    /** Aplica estilos (completada/fallada/parcial) y actualiza la barra. */
    function aplicarEstadoMision(el, m) {
        const prog = state.progresoMisiones[m.id];
        const pct  = porcentajeMision(m, prog);
        const pts  = puntajeMision(m, prog);
        const done = misionCompletada(m, prog);

        el.classList.remove("completada", "fallada", "parcial");
        if (prog.fallada)   el.classList.add("fallada");
        else if (done)      el.classList.add("completada");
        else if (pts > 0)   el.classList.add("parcial");

        const sc  = el.querySelector("[data-score]");
        const pc  = el.querySelector("[data-pct]");
        const bar = el.querySelector("[data-bar]");
        if (sc)  sc.textContent = pts;
        if (pc)  pc.textContent = `${pct}%`;
        if (bar) bar.style.width = `${pct}%`;

        // Sincroniza controles (por si el estado cambió desde fuera)
        el.querySelectorAll(".ctrl").forEach((ctrl) => {
            const codigo = ctrl.dataset.codigo;
            const valor  = prog.valores[codigo];
            if (ctrl.dataset.tipo === "si_no") {
                const chk = ctrl.querySelector('input[type="checkbox"]');
                if (chk) chk.checked = valor === true;
            } else if (ctrl.dataset.tipo === "contador") {
                const v = ctrl.querySelector("[data-valor]");
                if (v) v.textContent = Math.max(0, Math.min(
                    parseInt(ctrl.dataset.max, 10) || 0, Number(valor) || 0));
            } else if (ctrl.dataset.tipo === "opciones") {
                ctrl.querySelectorAll(".pill").forEach((p) => {
                    p.classList.toggle("activo", p.dataset.valor === String(valor));
                });
            }
        });
    }

    // --------------------------------------------------------------
    //  Cálculo de puntajes
    // --------------------------------------------------------------
    function puntajePorMision(m) {
        return puntajeMision(m, state.progresoMisiones[m.id]);
    }

    /** Permite editar misiones tanto durante la partida como después de
     *  finalizar (antes de registrar), pero no una vez registrada. */
    function puedeEditarMisiones() {
        if (state.partidaRegistrada) return false;
        return state.partidaIniciada || state.partidaFinalizada;
    }

    function puntajeTotal() {
        return state.misiones.reduce((s, m) => s + puntajePorMision(m), 0);
    }

    function maximoPosible() {
        return state.misiones.reduce((s, m) => s + maxMision(m), 0);
    }

    function actualizarScoreTotal() {
        const el = document.getElementById("crono-score");
        if (el) {
            const mx = maximoPosible();
            el.textContent = `${puntajeTotal()} / ${mx} pts`;
        }
    }

    // --------------------------------------------------------------
    //  Cronómetro 2:30
    // --------------------------------------------------------------
    function iniciarPartida() {
        if (state.baseAzul.length !== 2 || state.baseRoja.length !== 2) {
            toast("Debes asignar 2 jugadores a cada base antes de iniciar", "error");
            return;
        }
        state.partidaIniciada   = true;
        state.partidaEnCurso    = true;
        state.partidaFinalizada = false;
        state.partidaRegistrada = false;
        state.restante          = state.duracion;
        state.inicio            = new Date();

        document.getElementById("scorer").classList.remove("scorer--inactivo");
        document.getElementById("btn-iniciar").disabled   = true;
        document.getElementById("btn-finalizar").disabled = false;
        document.getElementById("btn-registrar").hidden   = true;
        document.getElementById("crono-estado").textContent = "PARTIDA EN CURSO";

        // Tick cada 200ms para suavidad visual, pero solo actualiza al segundo
        const fin = Date.now() + state.duracion * 1000;
        detenerTimer();
        timerId = setInterval(() => {
            const segs = Math.max(0, Math.round((fin - Date.now()) / 1000));
            state.restante = segs;
            actualizarCronometro();
            if (segs <= 0) {
                finalizarPartida(true);
            }
        }, 200);
    }

    function detenerTimer() {
        if (timerId) { clearInterval(timerId); timerId = null; }
    }

    function actualizarCronometro() {
        const t  = document.getElementById("crono-tiempo");
        const c  = document.getElementById("cronometro");
        if (!t || !c) return;
        t.textContent = formatearTiempo(state.restante);
        c.classList.remove("alerta", "critico");
        if (state.partidaEnCurso) {
            if (state.restante <= 10)      c.classList.add("critico");
            else if (state.restante <= 30) c.classList.add("alerta");
        }
    }

    /**
     * Finaliza la partida (por tiempo agotado o pulsación del coach).
     * NO guarda automáticamente: solo detiene el cronómetro y activa el
     * botón "Registrar" para que el coach decida cuándo persistir.
     */
    function finalizarPartida(porTiempo) {
        if (!state.partidaIniciada) return;
        detenerTimer();
        state.partidaEnCurso    = false;
        state.partidaFinalizada = true;
        document.getElementById("crono-estado").textContent =
            porTiempo ? "TIEMPO AGOTADO — Revisa y pulsa Registrar" : "PARTIDA FINALIZADA — Pulsa Registrar";
        document.getElementById("btn-finalizar").disabled = true;
        document.getElementById("btn-iniciar").disabled   = true;
        document.getElementById("btn-registrar").hidden   = false;
        toast(`Partida finalizada (${puntajeTotal()} pts). Ajusta y pulsa Registrar`, "info");
    }

    /**
     * Confirma y envía la partida a la base de datos. Solo disponible
     * tras finalizar; deja la interfaz en estado "registrada" para
     * consulta. El coach puede iniciar otra partida con Repetir / Descartar.
     */
    async function registrarPartida() {
        if (state.partidaRegistrada) {
            toast("Esta partida ya fue registrada", "info");
            return;
        }
        if (!state.partidaFinalizada) {
            toast("Finaliza la partida antes de registrar", "info");
            return;
        }
        const btn = document.getElementById("btn-registrar");
        btn.disabled = true;
        const textoOriginal = btn.textContent;
        btn.textContent = "Guardando…";
        try {
            const pts = puntajeTotal();
            await guardarPartida("finalizada");
            state.partidaRegistrada = true;
            toast(`Partida registrada (${pts} pts). Controles limpiados para la siguiente lanzada.`, "success");
            prepararNuevaPartidaTrasRegistro();
        } catch (err) {
            console.error(err);
            toast(err.message || "No se pudo registrar la partida", "error");
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    }

    /**
     * Resetea el puntaje de todas las misiones pero NO toca las bases ni
     * los nombres de cuadrilla/duplas. Si hay una partida en curso pide
     * confirmación para evitar perder datos por accidente.
     */
    async function limpiarControlesMisiones({ silent = false } = {}) {
        if (!state) return;
        if (!silent && state.partidaEnCurso) {
            const ok = await confirmar(
                "¿Limpiar todos los controles de la partida EN CURSO?");
            if (!ok) return;
        }
        if (!silent && state.partidaFinalizada && !state.partidaRegistrada) {
            const ok = await confirmar(
                "Hay una partida finalizada sin registrar. ¿Limpiar sus controles?");
            if (!ok) return;
        }
        state.misiones.forEach((m) => {
            state.progresoMisiones[m.id] = nuevoEstadoMision();
        });
        renderMisiones();
        if (!silent) toast("Controles limpiados", "info");
    }

    /**
     * Tras registrar con éxito: prepara una nueva partida manteniendo
     * jugadores en las bases y nombres de cuadrilla/duplas, pero
     * limpiando controles y cronómetro.
     */
    function prepararNuevaPartidaTrasRegistro() {
        detenerTimer();
        state.partidaEnCurso    = false;
        state.partidaIniciada   = false;
        state.partidaFinalizada = false;
        state.partidaRegistrada = false;
        state.restante          = state.duracion;
        state.misiones.forEach((m) => {
            state.progresoMisiones[m.id] = nuevoEstadoMision();
        });

        const btnRegistrar = document.getElementById("btn-registrar");
        if (btnRegistrar) {
            btnRegistrar.hidden   = true;
            btnRegistrar.disabled = false;
            btnRegistrar.textContent = "💾 Registrar";
        }
        const btnIni = document.getElementById("btn-iniciar");
        const btnFin = document.getElementById("btn-finalizar");
        if (btnIni) btnIni.disabled = false;
        if (btnFin) btnFin.disabled = true;
        const est = document.getElementById("crono-estado");
        if (est) est.textContent = "Partida detenida — lista para nueva lanzada";
        renderMisiones();
        actualizarCronometro();
    }

    async function repetirPartida() {
        if (state.partidaEnCurso) {
            const ok = await confirmar("¿Reiniciar la partida en curso SIN guardar?");
            if (!ok) return;
        }
        if (state.partidaFinalizada && !state.partidaRegistrada) {
            const ok = await confirmar("Hay una partida finalizada sin registrar. ¿Deseas descartarla y reiniciar?");
            if (!ok) return;
        }
        detenerTimer();
        state.partidaEnCurso    = false;
        state.partidaIniciada   = false;
        state.partidaFinalizada = false;
        state.partidaRegistrada = false;
        state.restante          = state.duracion;
        state.misiones.forEach((m) => {
            state.progresoMisiones[m.id] = nuevoEstadoMision();
        });
        const btnRegistrar = document.getElementById("btn-registrar");
        btnRegistrar.hidden   = true;
        btnRegistrar.disabled = false;
        btnRegistrar.textContent = "💾 Registrar";
        document.getElementById("btn-iniciar").disabled   = false;
        document.getElementById("btn-finalizar").disabled = true;
        document.getElementById("crono-estado").textContent = "Partida detenida";
        renderMisiones();
        actualizarCronometro();
    }

    async function descartarPartida() {
        const ok = await confirmar("¿Descartar esta partida? No se guardará.");
        if (!ok) return;
        detenerTimer();
        state.partidaEnCurso    = false;
        state.partidaIniciada   = false;
        state.partidaFinalizada = false;
        state.partidaRegistrada = false;
        state.restante          = state.duracion;
        state.misiones.forEach((m) => {
            state.progresoMisiones[m.id] = nuevoEstadoMision();
        });
        state.baseAzul = [];
        state.baseRoja = [];
        state.cuadrillaNombre = "";
        state.duplaAzulNombre = "";
        state.duplaRojaNombre = "";
        document.getElementById("in-cuadrilla").value = "";
        document.getElementById("in-dupla-azul").value = "";
        document.getElementById("in-dupla-roja").value = "";
        const btnRegistrar = document.getElementById("btn-registrar");
        btnRegistrar.hidden   = true;
        btnRegistrar.disabled = false;
        btnRegistrar.textContent = "💾 Registrar";
        document.getElementById("btn-iniciar").disabled   = false;
        document.getElementById("btn-finalizar").disabled = true;
        document.getElementById("crono-estado").textContent = "Partida detenida";
        renderJugadoresDisponibles();
        renderBases();
        renderMisiones();
        actualizarCronometro();
        toast("Partida descartada", "info");
    }

    // --------------------------------------------------------------
    //  Persistencia (guardado en Supabase)
    // --------------------------------------------------------------
    async function guardarPartida(estado = "finalizada") {
        const total    = puntajeTotal();
        const duracion = state.duracion - state.restante;

        // Repartir puntaje equitativamente entre los 4 jugadores.
        // (2 por base; companero = el otro de la misma base.)
        const perJugador = Math.round(total / 4);

        const jugadoresPayload = [];
        if (state.baseAzul.length === 2) {
            const [a1, a2] = state.baseAzul;
            jugadoresPayload.push(
                { jugador_id: a1, base: "azul", companero_id: a2, puntaje_individual: perJugador },
                { jugador_id: a2, base: "azul", companero_id: a1, puntaje_individual: perJugador }
            );
        }
        if (state.baseRoja.length === 2) {
            const [r1, r2] = state.baseRoja;
            jugadoresPayload.push(
                { jugador_id: r1, base: "roja", companero_id: r2, puntaje_individual: perJugador },
                { jugador_id: r2, base: "roja", companero_id: r1, puntaje_individual: perJugador }
            );
        }

        // Crear o reutilizar cuadrilla / duplas si se especificó nombre
        let cuadrilla_id = null, dupla_azul_id = null, dupla_roja_id = null;
        try {
            if (state.cuadrillaNombre?.trim() &&
                state.baseAzul.length === 2 && state.baseRoja.length === 2) {
                const c = await ApiCuadrillas.crearOObtener({
                    equipo_id: state.equipoId,
                    nombre: state.cuadrillaNombre.trim(),
                    jugadores: [...state.baseAzul, ...state.baseRoja],
                });
                cuadrilla_id = c.id;
            }
            if (state.duplaAzulNombre?.trim() && state.baseAzul.length === 2) {
                const d = await ApiDuplas.crearOObtener({
                    equipo_id: state.equipoId,
                    nombre: state.duplaAzulNombre.trim(),
                    jugador_a_id: state.baseAzul[0],
                    jugador_b_id: state.baseAzul[1],
                });
                dupla_azul_id = d.id;
            }
            if (state.duplaRojaNombre?.trim() && state.baseRoja.length === 2) {
                const d = await ApiDuplas.crearOObtener({
                    equipo_id: state.equipoId,
                    nombre: state.duplaRojaNombre.trim(),
                    jugador_a_id: state.baseRoja[0],
                    jugador_b_id: state.baseRoja[1],
                });
                dupla_roja_id = d.id;
            }
        } catch (err) {
            // Si no se pudo crear cuadrilla/dupla, seguimos guardando la partida
            // con el nombre libre.
            console.warn("Cuadrilla/dupla no creadas:", err.message);
        }

        // Misiones registradas: solo aquellas con valor distinto al inicial
        // (fallada, o con algún control activo). Cada fila incluye:
        //   - completada: true si el puntaje = máximo teórico
        //   - fallada:    toggle manual
        //   - bonus_obtenidos: snapshot de los valores de los controles
        //   - puntaje: puntos sumados
        const misionesPayload = state.misiones
            .map((m) => {
                const p = state.progresoMisiones[m.id];
                const pts = puntajePorMision(m);
                const tieneValores = Object.values(p.valores || {})
                    .some((v) => v === true || (typeof v === "number" && v > 0)
                              || (typeof v === "string" && v.length > 0));
                if (!p.fallada && !tieneValores) return null;
                return {
                    mision_id: m.id,
                    completada: misionCompletada(m, p),
                    fallada:    !!p.fallada,
                    bonus_obtenidos: p.valores || {},
                    puntaje: pts,
                };
            })
            .filter(Boolean);

        await ApiPartidas.guardar({
            equipo_id: state.equipoId,
            cuadrilla_id, dupla_azul_id, dupla_roja_id,
            cuadrilla_nombre:  state.cuadrillaNombre?.trim() || null,
            dupla_azul_nombre: state.duplaAzulNombre?.trim() || null,
            dupla_roja_nombre: state.duplaRojaNombre?.trim() || null,
            duracion_segundos: duracion > 0 ? duracion : state.duracion,
            puntaje_total: total,
            estado,
            jugadores: jugadoresPayload,
            misiones:  misionesPayload,
        });
    }

    return { render, destroy };
})();
