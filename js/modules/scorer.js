// =====================================================================
//  Módulo SCORER - Pantalla principal de lanzamiento (prioridad #1)
//  ---------------------------------------------------------------
//  Funcionalidades:
//   - Cronómetro descendente 2:30 dominante y centrado.
//   - Drag & drop (mouse + touch) de jugadores a Base Azul / Roja.
//   - Toggles por misión (completada / fallada) + bonus por misión.
//     Los bonus pueden activarse independientemente para soportar
//     misiones "c/u" (puntos_base=0 + varios chips de bonus).
//   - Cuadrilla y duplas opcionales (con nombre libre).
//   - Botones: Iniciar, Finalizar, Repetir, Descartar.
//   - AL FINALIZAR: la partida NO se guarda automáticamente; se muestra
//     un botón "Registrar" que el coach debe presionar para enviar la
//     partida a la base de datos. Entre finalizar y registrar el coach
//     puede ajustar misiones/bonus.
//   - Guarda partida completa al registrar (cabecera + jugadores + misiones)
//     repartiendo el puntaje total equitativamente entre los 4 jugadores
//     (2 por base); tambien se registra el puntaje total con base.
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
            state.progresoMisiones[m.id] = { estado: null, bonus: new Set() };
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

    function crearTarjetaMision(m) {
        const prog    = state.progresoMisiones[m.id];
        const lanzada = state.lanzadaPorMision[m.id];

        const el = document.createElement("div");
        el.className = "mision-tarjeta";
        el.dataset.misionId = m.id;

        const maxMision = (m.puntos_base || 0) +
            (Array.isArray(m.bonus) ? m.bonus.reduce((s, b) => s + (b.puntos || 0), 0) : 0);

        el.innerHTML = `
            <div class="mision-head">
                <span class="codigo">${escapeHtml(m.codigo)}</span>
                <span class="titulo">${escapeHtml(m.nombre_es)}</span>
                <span class="puntos" title="Puntaje máximo posible">hasta ${maxMision} pt</span>
            </div>
            ${m.descripcion ? `<div class="text-dim small">${escapeHtml(m.descripcion)}</div>` : ""}
            <div class="mision-actions">
                <button class="toggle-btn" data-accion="ok">✓ Completada</button>
                <button class="toggle-btn" data-accion="fail">✗ Fallada</button>
            </div>
            ${Array.isArray(m.bonus) && m.bonus.length
                ? `<div class="bonus-list">` +
                  m.bonus.map((b) =>
                      `<button class="bonus-chip" data-bonus="${escapeHtml(b.codigo)}">
                         +${b.puntos} ${escapeHtml(b.nombre)}
                       </button>`).join("") +
                  `</div>` : ""}
            ${lanzada
                ? `<div class="mision-posicion">🚀 ${escapeHtml(lanzada.nombre)}${
                    lanzada.base
                        ? ` · ${lanzada.base === "azul" ? "🟦 Azul" : "🟥 Roja"}`
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

        // Estado visual inicial
        aplicarEstadoMision(el, m, prog);

        el.querySelectorAll(".toggle-btn").forEach((b) => {
            b.addEventListener("click", () => {
                if (!puedeEditarMisiones()) {
                    toast("Inicia la partida para marcar misiones", "info");
                    return;
                }
                const accion = b.dataset.accion; // 'ok' | 'fail'
                const nuevo  = prog.estado === accion ? null : accion;
                prog.estado = nuevo;
                // Al marcar "fallada" se descartan los bonus; al completar o
                // limpiar, los bonus se mantienen para permitir ajustes.
                if (nuevo === "fail") prog.bonus.clear();
                aplicarEstadoMision(el, m, prog);
                actualizarScoreTotal();
            });
        });

        // Los bonus son independientes del estado "completada" para
        // soportar misiones tipo "c/u" (puntos_base=0). Solo se bloquean
        // si la misión fue marcada explícitamente como fallada.
        el.querySelectorAll(".bonus-chip").forEach((c) => {
            c.addEventListener("click", () => {
                if (!puedeEditarMisiones()) {
                    toast("Inicia la partida para marcar bonus", "info");
                    return;
                }
                if (prog.estado === "fail") {
                    toast("La misión está marcada como fallada — desmárcala para sumar bonus", "info");
                    return;
                }
                const cod = c.dataset.bonus;
                prog.bonus.has(cod) ? prog.bonus.delete(cod) : prog.bonus.add(cod);
                c.classList.toggle("activo", prog.bonus.has(cod));
                actualizarScoreTotal();
            });
        });

        return el;
    }

    function aplicarEstadoMision(el, m, prog) {
        el.classList.remove("completada", "fallada");
        if (prog.estado === "ok")   el.classList.add("completada");
        if (prog.estado === "fail") el.classList.add("fallada");
        el.querySelectorAll(".toggle-btn").forEach((b) => {
            b.classList.remove("activo--completada", "activo--fallada");
            if (prog.estado === "ok"   && b.dataset.accion === "ok")   b.classList.add("activo--completada");
            if (prog.estado === "fail" && b.dataset.accion === "fail") b.classList.add("activo--fallada");
        });
        el.querySelectorAll(".bonus-chip").forEach((c) => {
            c.classList.toggle("activo", prog.bonus.has(c.dataset.bonus));
        });
    }

    // --------------------------------------------------------------
    //  Cálculo de puntajes
    // --------------------------------------------------------------
    function puntajePorMision(m) {
        const prog = state.progresoMisiones[m.id];
        if (!prog) return 0;
        if (prog.estado === "fail") return 0;
        let total = 0;
        if (prog.estado === "ok") total += (m.puntos_base || 0);
        (m.bonus || []).forEach((b) => {
            if (prog.bonus.has(b.codigo)) total += (b.puntos || 0);
        });
        return total;
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

    function actualizarScoreTotal() {
        const el = document.getElementById("crono-score");
        if (el) el.textContent = `${puntajeTotal()} pts`;
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
            await guardarPartida("finalizada");
            state.partidaRegistrada = true;
            toast(`Partida registrada (${puntajeTotal()} pts)`, "success");
            document.getElementById("crono-estado").textContent = "PARTIDA REGISTRADA";
            btn.textContent = "✓ Registrada";
            // Tras registrar, habilitar inicio de una nueva partida.
            document.getElementById("btn-iniciar").disabled = false;
        } catch (err) {
            console.error(err);
            toast(err.message || "No se pudo registrar la partida", "error");
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
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
            state.progresoMisiones[m.id] = { estado: null, bonus: new Set() };
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
            state.progresoMisiones[m.id] = { estado: null, bonus: new Set() };
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

        // Misiones registradas (solo las que tienen estado)
        const misionesPayload = state.misiones
            .map((m) => {
                const p = state.progresoMisiones[m.id];
                if (!p.estado) return null;
                return {
                    mision_id: m.id,
                    completada: p.estado === "ok",
                    fallada:    p.estado === "fail",
                    bonus_obtenidos: [...p.bonus],
                    puntaje: puntajePorMision(m),
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
