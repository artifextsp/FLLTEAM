// =====================================================================
//  Módulo LANZADAS — recorridos del equipo (agrupación de misiones)
//  ------------------------------------------------------------------
//  Flujo: el coach crea lanzadas (recorridos) con base, tiempo del
//  recorrido en segundos, posición de lanzamiento (orientación, número,
//  dirección) y arrastra las misiones
//  desde el panel "Disponibles" hacia cada lanzada. Una misión puede
//  pertenecer a una sola lanzada por equipo (garantizado por DB).
//
//  Drag & drop implementado con Pointer Events (mouse + touch).
// =====================================================================

const ModuloLanzadas = (() => {
    let state = null;   // { equipoId, misiones, lanzadas }
    let drag  = null;   // { misionId, clon, origen }

    // --------------------------------------------------------------
    //  Render principal
    // --------------------------------------------------------------
    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `<div class="card empty">
                <h2>Selecciona un equipo</h2>
                <p>Elige un equipo para configurar sus lanzadas.</p>
            </div>`;
            return;
        }

        cont.innerHTML = `
            <div class="page-header">
                <h2>Lanzadas · Recorridos</h2>
                <div class="acciones">
                    <button class="btn" id="btn-nueva-lanzada">+ Nueva lanzada</button>
                </div>
            </div>
            <p class="text-dim small">
                Cada lanzada guarda el tiempo que lleva el recorrido (segundos)
                para comparar y optimizar. Arrastra las misiones que lo componen;
                una misión solo puede estar en una lanzada por equipo.
            </p>
            <div class="card lanzadas-resumen" id="lanzadas-resumen" hidden></div>
            <div class="lanzadas-layout">
                <aside class="lanzadas-disponibles card" id="panel-disponibles">
                    <h3>
                        🧩 Misiones disponibles
                        <span class="disp-contador" id="disp-contador"></span>
                    </h3>
                    <ul class="mision-palette" id="lista-disponibles"></ul>
                </aside>
                <section class="lanzadas-lista" id="panel-lanzadas"></section>
            </div>`;

        state = { equipoId, misiones: [], lanzadas: [] };
        await cargar();

        document.getElementById("btn-nueva-lanzada")
            .addEventListener("click", crearLanzadaPrompt);
    }

    function destroy() {
        state = null;
        drag  = null;
    }

    async function cargar() {
        if (!state) return;
        const equipoId = state.equipoId;
        const [misiones, lanzadas] = await Promise.all([
            ApiMisiones.listar(),
            ApiLanzadas.listar(equipoId),
        ]);
        // Puede haberse destruido el módulo mientras esperábamos.
        if (!state) return;
        state.misiones = misiones;
        state.lanzadas = lanzadas;
        pintarDisponibles();
        pintarLanzadas();
        pintarResumenTiempos(state.lanzadas);
    }

    const PARTIDA_FLL_SEG = 150;

    function pintarResumenTiempos(lanzadas) {
        const el = document.getElementById("lanzadas-resumen");
        if (!el) return;
        if (!lanzadas.length) {
            el.hidden = true;
            el.innerHTML = "";
            return;
        }
        el.hidden = false;
        const byBase = { azul: [], roja: [] };
        lanzadas.forEach((l) => {
            if (l.base === "azul" || l.base === "roja") {
                // Guardar el tiempo tal como viene de la DB (0 si no tiene)
                const t = (l.tiempo_recorrido_seg != null && l.tiempo_recorrido_seg > 0)
                    ? Number(l.tiempo_recorrido_seg)
                    : 0;
                byBase[l.base].push({ id: l.id, nombre: l.nombre, t, orden: Number(l.orden) || 0 });
            }
        });
        ["azul", "roja"].forEach((k) =>
            byBase[k].sort((a, b) => a.orden - b.orden)
        );

        function bloqueBase(titulo, key) {
            const arr = byBase[key];
            const n = arr.length;

            if (n === 0) {
                return `<div class="lanzadas-resumen__col lanzadas-resumen__col--${key}">
                    <h4>${titulo}</h4>
                    <p class="text-dim small" style="margin:0;">Sin lanzadas asignadas a esta base.</p>
                </div>`;
            }

            // Lanzadas con tiempo configurado (para la suma real)
            const conTiempo = arr.filter((x) => x.t > 0);
            // Suma calculada exactamente a partir de los mismos objetos que se renderizan
            const sum = conTiempo.reduce((s, x) => s + x.t, 0);
            const restante = PARTIDA_FLL_SEG - sum;
            // Huecos entre lanzadas CON tiempo configurado (los cambios de mecanismo planificados)
            const huecos = Math.max(0, conTiempo.length - 1);
            const porHueco = huecos > 0 ? restante / huecos : restante;
            const sobra = restante < 0;

            // Verificación: suma + restante siempre = PARTIDA_FLL_SEG (150)
            // Se muestra explícitamente para que el coach pueda validar los números

            const items = arr.map((x, i) => {
                const esUltima = i === n - 1;
                const sinTiempo = x.t === 0;

                // Tiempo de cambio solo aplica entre lanzadas que SÍ tienen tiempo
                let transTxt = "";
                if (!esUltima) {
                    if (sinTiempo || arr[i + 1]?.t === 0) {
                        transTxt = `<span class="lan-trans lan-trans--warn">⏱ Sin tiempo configurado</span>`;
                    } else if (sobra) {
                        transTxt = `<span class="lan-trans lan-trans--bad">⚠ excede ${PARTIDA_FLL_SEG}s — ajusta tiempos</span>`;
                    } else if (huecos > 0) {
                        transTxt = `<span class="lan-trans">↳ cambio mecanismo: <strong>~${porHueco.toFixed(0)}s</strong></span>`;
                    }
                } else {
                    if (sobra) {
                        transTxt = `<span class="lan-trans lan-trans--bad">⚠ exceso: ${Math.abs(restante)}s — revisa tiempos</span>`;
                    } else {
                        transTxt = `<span class="lan-trans lan-trans--ok">✓ margen restante: <strong>${restante}s</strong> (${sum}s + ${restante}s = ${PARTIDA_FLL_SEG}s)</span>`;
                    }
                }

                return `<li>
                    <span class="lan-num">${i + 1}</span>
                    <span class="lan-nombre">${escapeHtml(x.nombre)}</span>
                    <span class="lan-t">${x.t > 0 ? `⏱ ${x.t}s` : `<span class="text-dim">sin tiempo</span>`}</span>
                    ${transTxt}
                </li>`;
            }).join("");

            const tieneSinTiempo = arr.some((x) => x.t === 0);
            const cabezera = sobra
                ? `<p class="lanzadas-resumen__alerta">
                    ⚠ La suma de recorridos (<strong>${sum}s</strong>) supera los <strong>${PARTIDA_FLL_SEG}s</strong>
                    de la partida. Exceso: <strong>${Math.abs(restante)}s</strong> — ajusta los tiempos.
                </p>`
                : tieneSinTiempo
                ? `<p class="text-dim small" style="margin:0 0 .5rem;">
                    Algunas lanzadas no tienen tiempo configurado — el cálculo de cambios es parcial.
                    <strong>${sum}s</strong> de recorridos planificados · <strong>${restante}s</strong> de margen.
                </p>`
                : (huecos > 0
                    ? `<p class="text-dim small" style="margin:0 0 .5rem;">
                        Ecuación: <strong>${arr.map((x) => x.t + "s").join(" + ")}</strong>
                        = <strong>${sum}s</strong> recorridos + <strong>${restante}s</strong> para
                        <strong>${huecos}</strong> cambio(s) ≈ <strong>${porHueco.toFixed(0)}s</strong> c/u
                        = <strong>${PARTIDA_FLL_SEG}s</strong> ✓
                    </p>`
                    : `<p class="text-dim small" style="margin:0 0 .5rem;">
                        Recorrido: <strong>${sum}s</strong> · Margen libre: <strong>${restante}s</strong>
                        (total: ${sum}s + ${restante}s = ${PARTIDA_FLL_SEG}s ✓)
                    </p>`);

            return `<div class="lanzadas-resumen__col lanzadas-resumen__col--${key}">
                <h4>${titulo} · <span class="text-dim">${n} lanzada(s)</span></h4>
                ${cabezera}
                <ol class="lan-secuencia">${items}</ol>
            </div>`;
        }

        el.innerHTML = `
            <h3 style="margin-top:0;">⏱ Tiempos por base y cambios de mecanismo</h3>
            <p class="text-dim small">
                En competición ambas bases corren en <strong>paralelo</strong> dentro de la misma ventana
                de <strong>${PARTIDA_FLL_SEG}s</strong>. Para cada base: suma de recorridos + cambios
                de mecanismo = ${PARTIDA_FLL_SEG}s.
            </p>
            <div class="lanzadas-resumen__grid">
                ${bloqueBase("🟦 Base azul", "azul")}
                ${bloqueBase("🟥 Base roja", "roja")}
            </div>`;
    }

    // --------------------------------------------------------------
    //  Pintado
    // --------------------------------------------------------------
    function pintarDisponibles() {
        if (!state) return;
        const ul = document.getElementById("lista-disponibles");
        const contador = document.getElementById("disp-contador");
        if (!ul) return;
        const asignadas = new Set();
        state.lanzadas.forEach((l) =>
            l.misiones.forEach((mm) => asignadas.add(mm.mision_id))
        );
        const libres = state.misiones.filter((m) => !asignadas.has(m.id));

        if (contador) {
            contador.textContent = `${libres.length} / ${state.misiones.length}`;
        }

        if (libres.length === 0) {
            ul.innerHTML = `<li class="text-dim small">
                Todas las misiones están asignadas a una lanzada.
            </li>`;
            return;
        }
        ul.innerHTML = "";
        libres.forEach((m) => ul.appendChild(crearChipMision(m)));
    }

    function pintarLanzadas() {
        if (!state) return;
        const cont = document.getElementById("panel-lanzadas");
        if (!cont) return;
        if (state.lanzadas.length === 0) {
            cont.innerHTML = `<div class="card empty">
                <h3>Sin lanzadas todavía</h3>
                <p>Pulsa "+ Nueva lanzada" para crear tu primer recorrido.</p>
            </div>`;
            return;
        }
        cont.innerHTML = "";
        state.lanzadas.forEach((l) => cont.appendChild(crearTarjetaLanzada(l)));
    }

    function crearTarjetaLanzada(l) {
        const card = document.createElement("div");
        card.className = "card lanzada-card";
        card.dataset.lanzadaId = l.id;

        const misionesOrdenadas = [...l.misiones]
            .sort((a, b) => a.orden - b.orden)
            .map((mm) => state.misiones.find((m) => m.id === mm.mision_id))
            .filter(Boolean);

        const maxPotencial = misionesOrdenadas.reduce(
            (s, m) => s + maxMision(m), 0);

        const posTexto = l.orientacion
            ? `${l.orientacion} · #${l.numero_posicion ?? "-"} · ${l.direccion === "izq_der" ? "izq → der" : "der → izq"}`
            : `<span class="text-dim">Posición sin definir</span>`;
        const chipBase = l.base
            ? `<span class="chip chip--${l.base}">${l.base === "azul" ? "🟦 Base Azul" : "🟥 Base Roja"}</span>`
            : `<span class="chip">Base sin definir</span>`;
        const chipTiempo = (l.tiempo_recorrido_seg != null && l.tiempo_recorrido_seg > 0)
            ? `<span class="chip" title="Tiempo planificado del recorrido">⏱ ${formatearTiempo(l.tiempo_recorrido_seg)} <span class="text-dim">(${l.tiempo_recorrido_seg}s)</span></span>`
            : `<span class="chip text-dim">⏱ Sin tiempo</span>`;

        card.innerHTML = `
            <div class="lanzada-head">
                <div>
                    <h3 style="margin:0;">${escapeHtml(l.nombre)}</h3>
                    <div class="lanzada-chips">
                        ${chipBase}
                        ${chipTiempo}
                    </div>
                    <div class="text-dim small">${posTexto}</div>
                    ${l.descripcion ? `<div class="text-dim small">${escapeHtml(l.descripcion)}</div>` : ""}
                </div>
                <div class="lanzada-meta">
                    <span class="chip">Hasta ${maxPotencial} pt</span>
                    <button class="btn btn--ghost btn--sm" data-accion="agregar" title="Agregar misiones sin arrastrar">
                        + Agregar
                    </button>
                    <button class="btn btn--ghost btn--icon" data-accion="editar" title="Editar">✎</button>
                    <button class="btn btn--ghost btn--icon" data-accion="eliminar" title="Eliminar">🗑</button>
                </div>
            </div>
            <ul class="lanzada-drop" data-lanzada-id="${l.id}"></ul>
        `;

        const ul = card.querySelector(".lanzada-drop");
        if (misionesOrdenadas.length === 0) {
            ul.innerHTML = `<li class="drop-hint text-dim small">
                Arrastra aquí las misiones de este recorrido
            </li>`;
        } else {
            misionesOrdenadas.forEach((m) =>
                ul.appendChild(crearChipMision(m, { enLanzada: l.id }))
            );
        }

        inicializarDropLanzada(ul);

        card.querySelector('[data-accion="editar"]').addEventListener("click", () => editarLanzada(l));
        card.querySelector('[data-accion="eliminar"]').addEventListener("click", () => eliminarLanzada(l));
        card.querySelector('[data-accion="agregar"]').addEventListener("click", () => agregarMisionesPrompt(l));

        return card;
    }

    /**
     * Alternativa al drag & drop: modal con checkboxes para agregar varias
     * misiones disponibles a una lanzada en un solo paso. Muy útil cuando el
     * panel izquierdo ya no está a la vista por el scroll.
     */
    async function agregarMisionesPrompt(l) {
        const asignadas = new Set();
        state.lanzadas.forEach((x) =>
            x.misiones.forEach((mm) => asignadas.add(mm.mision_id))
        );
        const libres = state.misiones.filter((m) => !asignadas.has(m.id));

        if (libres.length === 0) {
            toast("No hay misiones disponibles — todas están asignadas", "info");
            return;
        }

        const html = `
            <p class="text-dim small" style="margin-top:0;">
                Marca las misiones que forman parte de
                <strong>${escapeHtml(l.nombre)}</strong>.
            </p>
            <ul class="picker-misiones">
                ${libres.map((m) => `
                    <li>
                        <label>
                            <input type="checkbox" value="${m.id}" />
                            <span class="codigo">${escapeHtml(m.codigo)}</span>
                            <span class="nombre">${escapeHtml(m.nombre_es)}</span>
                            <span class="puntos text-dim">${maxMision(m)} pt</span>
                        </label>
                    </li>`).join("")}
            </ul>`;

        await abrirModal(`Agregar misiones · ${l.nombre}`, html, {
            okTexto: "Agregar",
            onSubmit: async (body) => {
                const ids = [...body.querySelectorAll('input[type="checkbox"]:checked')]
                    .map((c) => c.value);
                if (ids.length === 0) {
                    toast("Selecciona al menos una misión", "info");
                    return false;
                }
                for (const misionId of ids) {
                    await ApiLanzadas.asignarMision({
                        lanzada_id: l.id,
                        mision_id: misionId,
                        equipo_id: state.equipoId,
                    });
                }
                toast(`${ids.length} misión(es) añadida(s) a ${l.nombre}`, "success");
                await cargar();
            },
        });
    }

    /** Chip arrastrable de misión. */
    function crearChipMision(m, { enLanzada = null } = {}) {
        const li = document.createElement("li");
        li.className = "mision-chip";
        li.dataset.misionId = m.id;

        const max = maxMision(m);

        li.innerHTML = `
            <span class="codigo">${escapeHtml(m.codigo)}</span>
            <span class="nombre">${escapeHtml(m.nombre_es)}</span>
            <span class="puntos">${max} pt</span>
        `;

        if (enLanzada) {
            li.dataset.lanzadaId = enLanzada;
            const x = document.createElement("button");
            x.className = "chip-x";
            x.textContent = "✕";
            x.title = "Quitar de la lanzada";
            x.addEventListener("click", (e) => {
                e.stopPropagation();
                quitarMision(m.id, enLanzada);
            });
            li.appendChild(x);
        }

        li.addEventListener("pointerdown", onPointerDown);
        return li;
    }

    // --------------------------------------------------------------
    //  Drag & drop (Pointer Events)
    // --------------------------------------------------------------
    function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        // Evitar iniciar drag al tocar la X de quitar.
        if (e.target.classList?.contains("chip-x")) return;
        e.preventDefault();

        const origen    = e.currentTarget;
        const misionId  = origen.dataset.misionId;
        const lanzadaOrig = origen.dataset.lanzadaId || null;

        const clon = origen.cloneNode(true);
        clon.classList.add("mision-chip--clon");
        clon.style.left = e.clientX + "px";
        clon.style.top  = e.clientY + "px";
        document.body.appendChild(clon);

        origen.classList.add("arrastrando");
        drag = { origen, clon, misionId, lanzadaOrig };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup",   onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
        if (!drag) return;
        drag.clon.style.left = e.clientX + "px";
        drag.clon.style.top  = e.clientY + "px";

        document.querySelectorAll(".lanzada-drop.drop-over, .lanzadas-disponibles.drop-over")
            .forEach((el) => el.classList.remove("drop-over"));
        const bajo = document.elementFromPoint(e.clientX, e.clientY);
        const zona = bajo?.closest(".lanzada-drop, .lanzadas-disponibles");
        if (zona) zona.classList.add("drop-over");
    }

    async function onPointerUp(e) {
        if (!drag) return;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup",   onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        const bajo = document.elementFromPoint(e.clientX, e.clientY);
        const zonaLanzada      = bajo?.closest(".lanzada-drop");
        const zonaDisponibles  = bajo?.closest(".lanzadas-disponibles");

        document.querySelectorAll(".lanzada-drop.drop-over, .lanzadas-disponibles.drop-over")
            .forEach((el) => el.classList.remove("drop-over"));
        drag.clon.remove();
        drag.origen.classList.remove("arrastrando");

        const { misionId, lanzadaOrig } = drag;
        drag = null;

        try {
            if (zonaLanzada) {
                const lanzadaDestino = zonaLanzada.dataset.lanzadaId;
                if (lanzadaDestino && lanzadaDestino !== lanzadaOrig) {
                    await ApiLanzadas.asignarMision({
                        lanzada_id: lanzadaDestino,
                        mision_id: misionId,
                        equipo_id: state.equipoId,
                    });
                    await cargar();
                }
            } else if (zonaDisponibles && lanzadaOrig) {
                // Se soltó sobre "disponibles" → quitar de la lanzada origen
                await ApiLanzadas.quitarMision({
                    lanzada_id: lanzadaOrig, mision_id: misionId,
                });
                await cargar();
            }
        } catch (err) {
            console.error(err);
            toast(err.message || "No se pudo mover la misión", "error");
        }
    }

    function inicializarDropLanzada(ul) {
        ul.addEventListener("dragover", (e) => e.preventDefault());
    }

    // --------------------------------------------------------------
    //  CRUD lanzadas
    // --------------------------------------------------------------
    async function crearLanzadaPrompt() {
        const html = plantillaFormulario({});
        await abrirModal("Nueva lanzada", html, {
            okTexto: "Crear",
            onSubmit: async (body) => {
                const campos = leerFormulario(body);
                if (!campos.nombre) {
                    toast("El nombre es obligatorio", "error");
                    return false;
                }
                if (!campos.base) {
                    toast("Selecciona la base de salida", "error");
                    return false;
                }
                if (campos.tiempo_recorrido_seg == null || !Number.isFinite(campos.tiempo_recorrido_seg)
                    || campos.tiempo_recorrido_seg < 1) {
                    toast("Indica el tiempo del recorrido en segundos (número entero, mín. 1)", "error");
                    return false;
                }
                await ApiLanzadas.crear({
                    equipo_id: state.equipoId,
                    ...campos,
                    orden: state.lanzadas.length,
                });
                toast("Lanzada creada", "success");
                await cargar();
            },
        });
    }

    async function editarLanzada(l) {
        const html = plantillaFormulario(l);
        await abrirModal(`Editar · ${l.nombre}`, html, {
            okTexto: "Guardar",
            onSubmit: async (body) => {
                const campos = leerFormulario(body);
                if (!campos.nombre) {
                    toast("El nombre es obligatorio", "error");
                    return false;
                }
                if (!campos.base) {
                    toast("Selecciona la base de salida", "error");
                    return false;
                }
                if (campos.tiempo_recorrido_seg == null || !Number.isFinite(campos.tiempo_recorrido_seg)
                    || campos.tiempo_recorrido_seg < 1) {
                    toast("Indica el tiempo del recorrido en segundos (número entero, mín. 1)", "error");
                    return false;
                }
                await ApiLanzadas.actualizar(l.id, campos);
                toast("Lanzada actualizada", "success");
                await cargar();
            },
        });
    }

    async function eliminarLanzada(l) {
        const ok = await confirmar(`¿Eliminar la lanzada "${l.nombre}"? Las misiones volverán al panel de disponibles.`);
        if (!ok) return;
        try {
            await ApiLanzadas.eliminar(l.id);
            toast("Lanzada eliminada", "info");
            await cargar();
        } catch (err) {
            toast(err.message || "No se pudo eliminar", "error");
        }
    }

    async function quitarMision(misionId, lanzadaId) {
        try {
            await ApiLanzadas.quitarMision({ lanzada_id: lanzadaId, mision_id: misionId });
            await cargar();
        } catch (err) {
            toast(err.message || "No se pudo quitar la misión", "error");
        }
    }

    // --------------------------------------------------------------
    //  Formulario (reutilizado en crear/editar)
    // --------------------------------------------------------------
    function plantillaFormulario(l) {
        return `
            <div class="form-field">
                <label>Nombre *</label>
                <input type="text" id="f-nombre" value="${escapeHtml(l.nombre || "")}" placeholder="Lanzada 1" />
            </div>
            <div class="form-field">
                <label>Descripción (opcional)</label>
                <input type="text" id="f-desc" value="${escapeHtml(l.descripcion || "")}" placeholder="Ej. Ruta este del tapete" />
            </div>
            <div class="form-field">
                <label>Base de salida *</label>
                <select id="f-base">
                    <option value="">— Selecciona base —</option>
                    <option value="azul" ${l.base === "azul" ? "selected" : ""}>🟦 Base Azul</option>
                    <option value="roja" ${l.base === "roja" ? "selected" : ""}>🟥 Base Roja</option>
                </select>
            </div>
            <div class="form-field">
                <label for="f-tiempo">Tiempo del recorrido (segundos) *</label>
                <input type="number" id="f-tiempo" min="1" step="1"
                    value="${l.tiempo_recorrido_seg != null ? escapeHtml(String(l.tiempo_recorrido_seg)) : ""}"
                    placeholder="Ej. 45" />
                <div class="text-dim small">
                    Cuánto tarda el equipo en ejecutar esta lanzada en entrenamiento (cronómetro).
                </div>
            </div>
            <div class="grid grid-3">
                <div class="form-field">
                    <label>Orientación</label>
                    <select id="f-orient">
                        <option value="">—</option>
                        <option value="horizontal" ${l.orientacion === "horizontal" ? "selected" : ""}>Horizontal</option>
                        <option value="vertical"   ${l.orientacion === "vertical"   ? "selected" : ""}>Vertical</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>Número pos.</label>
                    <input type="number" id="f-num" value="${l.numero_posicion ?? ""}" />
                </div>
                <div class="form-field">
                    <label>Dirección</label>
                    <select id="f-dir">
                        <option value="">—</option>
                        <option value="izq_der" ${l.direccion === "izq_der" ? "selected" : ""}>Izquierda → Derecha</option>
                        <option value="der_izq" ${l.direccion === "der_izq" ? "selected" : ""}>Derecha → Izquierda</option>
                    </select>
                </div>
            </div>`;
    }

    function leerFormulario(body) {
        const nombre      = body.querySelector("#f-nombre").value.trim();
        const descripcion = body.querySelector("#f-desc").value.trim() || null;
        const base        = body.querySelector("#f-base").value || null;
        const orientacion = body.querySelector("#f-orient").value || null;
        const direccion   = body.querySelector("#f-dir").value || null;
        const numVal      = body.querySelector("#f-num").value;
        const numero_posicion = numVal === "" ? null : parseInt(numVal, 10);
        const tVal        = body.querySelector("#f-tiempo").value.trim();
        const tiempo_recorrido_seg = tVal === "" ? null : parseInt(tVal, 10);
        return { nombre, descripcion, base, tiempo_recorrido_seg, orientacion, direccion, numero_posicion };
    }

    return { render, destroy };
})();
