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

/**
 * Guarda/lee el equipo activo en localStorage (persiste entre recargas).
 */
const EquipoActivo = {
    CLAVE: "fll_equipo_activo",
    get() { return localStorage.getItem(this.CLAVE) || ""; },
    set(id) { id ? localStorage.setItem(this.CLAVE, id)
                  : localStorage.removeItem(this.CLAVE); },
};
