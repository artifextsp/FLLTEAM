// =====================================================================
//  Utilidades compartidas: toasts, modales, confirmación, formato de
//  fecha/tiempo, helpers de DOM.
// =====================================================================

/**
 * Muestra un mensaje tipo toast (top-center, autodesaparece).
 * @param {string} texto
 * @param {"info"|"success"|"error"} tipo
 * @param {number} ms
 */
function toast(texto, tipo = "info", ms = 3000) {
    const contenedor =
        document.getElementById("toasts") ||
        (() => {
            const c = document.createElement("div");
            c.className = "toast-container";
            c.id = "toasts";
            document.body.appendChild(c);
            return c;
        })();

    const t = document.createElement("div");
    t.className = `toast toast--${tipo}`;
    t.textContent = texto;
    contenedor.appendChild(t);

    setTimeout(() => {
        t.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        t.style.opacity = "0";
        t.style.transform = "translateY(-6px)";
        setTimeout(() => t.remove(), 300);
    }, ms);
}

/**
 * Abre un modal sencillo con contenido HTML/DOM y devuelve una promesa
 * resuelta con un valor cuando se pulsa aceptar, o `null` al cancelar.
 * @param {string} titulo
 * @param {string|HTMLElement} contenido
 * @param {{okTexto?: string, cancelTexto?: string, onSubmit?: () => Promise<any>|any}} opts
 */
function abrirModal(titulo, contenido, opts = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <h2>${escapeHtml(titulo)}</h2>
                <div class="modal-body"></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn--ghost" data-rol="cancel">
                        ${escapeHtml(opts.cancelTexto || "Cancelar")}
                    </button>
                    <button type="button" class="btn" data-rol="ok">
                        ${escapeHtml(opts.okTexto || "Aceptar")}
                    </button>
                </div>
            </div>`;
        const body = overlay.querySelector(".modal-body");
        if (typeof contenido === "string") body.innerHTML = contenido;
        else body.appendChild(contenido);
        document.body.appendChild(overlay);

        const cerrar = (v) => { overlay.remove(); resolve(v); };

        overlay.querySelector('[data-rol="cancel"]').addEventListener(
            "click", () => cerrar(null)
        );
        overlay.querySelector('[data-rol="ok"]').addEventListener(
            "click", async () => {
                try {
                    const v = opts.onSubmit ? await opts.onSubmit(body) : true;
                    if (v !== false) cerrar(v);
                } catch (err) {
                    toast(err.message || "Error al procesar", "error");
                }
            }
        );
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) cerrar(null);
        });
    });
}

/**
 * Prompt de confirmación con modal.
 * @param {string} mensaje
 * @returns {Promise<boolean>}
 */
async function confirmar(mensaje) {
    const r = await abrirModal("¿Estás seguro?", `<p>${escapeHtml(mensaje)}</p>`, {
        okTexto: "Sí, continuar",
        cancelTexto: "Cancelar",
    });
    return r === true;
}

/** Escapa HTML mínimo para insertar strings en innerHTML de forma segura. */
function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Formatea segundos como mm:ss. */
function formatearTiempo(segs) {
    const s = Math.max(0, Math.floor(segs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Formatea fecha ISO a local "dd/mm/yyyy hh:mm". */
function formatearFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Crea un elemento DOM a partir de un string HTML. */
function crearElemento(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    return tmp.firstElementChild;
}

/** Debounce simple. */
function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// =====================================================================
//  Helpers de puntaje por MISIÓN con "controles tipados".
//  -------------------------------------------------------------------
//  El campo `bonus` en la tabla `misiones` es un arreglo de controles
//  con uno de estos tipos:
//    si_no     → {codigo, nombre, puntos}
//    contador  → {codigo, nombre, puntos, max}
//    opciones  → {codigo, nombre, opciones:[{valor, puntos, label}]}
//  Para retrocompat, un control sin `tipo` se asume si_no.
// =====================================================================

/** Máximo teórico de puntos posibles en una misión. */
function maxMision(m) {
    let total = m.puntos_base || 0;
    const controles = Array.isArray(m.bonus) ? m.bonus : [];
    for (const c of controles) {
        if (c.tipo === "contador") {
            total += (c.puntos || 0) * (c.max || 0);
        } else if (c.tipo === "opciones") {
            const mx = (c.opciones || []).reduce(
                (x, o) => Math.max(x, o.puntos || 0), 0);
            total += mx;
        } else {
            total += c.puntos || 0;
        }
    }
    return total;
}

/**
 * Puntaje actual de una misión a partir del estado de sus controles.
 *   `estado = { fallada: bool, valores: { [codigo]: valor } }`
 *   valor según tipo:
 *     si_no    → true/false
 *     contador → entero 0..max
 *     opciones → valor de la opción seleccionada
 */
function puntajeMision(m, estado) {
    if (!estado || estado.fallada) return 0;
    const controles = Array.isArray(m.bonus) ? m.bonus : [];
    let total = 0;
    for (const c of controles) {
        const v = estado.valores?.[c.codigo];
        if (v == null) continue;
        if (c.tipo === "contador") {
            total += Math.max(0, Math.min(c.max || 0, Number(v) || 0)) * (c.puntos || 0);
        } else if (c.tipo === "opciones") {
            const op = (c.opciones || []).find((o) => String(o.valor) === String(v));
            if (op) total += op.puntos || 0;
        } else {
            if (v === true) total += c.puntos || 0;
        }
    }
    // puntos_base solo si no hay controles activos equivalentes y el legacy
    // marcaba "completada" explícita. En el nuevo modelo puntos_base=0.
    if ((m.puntos_base || 0) > 0 && estado.completadaLegacy) {
        total += m.puntos_base;
    }
    return total;
}

/** Porcentaje redondeado de cumplimiento (0..100). */
function porcentajeMision(m, estado) {
    const mx = maxMision(m);
    if (mx <= 0) return 0;
    return Math.round((puntajeMision(m, estado) / mx) * 100);
}

/** Devuelve `true` si el estado de la misión equivale a Completada (100%). */
function misionCompletada(m, estado) {
    const mx = maxMision(m);
    return mx > 0 && puntajeMision(m, estado) >= mx && !estado.fallada;
}

/**
 * Guarda/lee el equipo activo en localStorage (persiste entre recargas).
 */
const EquipoActivo = {
    CLAVE: "fll_equipo_activo",
    get() { return localStorage.getItem(this.CLAVE) || ""; },
    set(id) { id ? localStorage.setItem(this.CLAVE, id)
                  : localStorage.removeItem(this.CLAVE); },
};
