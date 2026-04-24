// =====================================================================
//  Router por hash (#scorer, #equipos, ...) — sin dependencias.
//  Cada ruta mapea a un módulo con `render(contenedor)` y, opcional,
//  `destroy()` para limpiar listeners/intervalos al cambiar.
//
//  Para evitar race conditions cuando el usuario navega rápido entre
//  módulos (un await pendiente resuelve después de que el DOM ya fue
//  limpiado por otra navegación), el router expone un "token" que cada
//  `navegar()` incrementa. Los módulos pueden consultar `Router.vigente(t)`
//  tras cada `await` para abortar silenciosamente si ya no son el módulo
//  activo.
// =====================================================================

const Router = (() => {
    const rutas = {};
    let actual = null;
    let token  = 0;

    function registrar(nombre, modulo) {
        rutas[nombre] = modulo;
    }

    /** Token de la navegación en curso. Los módulos deben capturarlo al
     *  iniciar su `render()` y usarlo tras cada `await`. */
    function tokenActual() { return token; }

    /** `true` si el token sigue siendo el de la navegación actual. */
    function vigente(t) { return t === token; }

    async function navegar() {
        const nombre = (location.hash || "#scorer").replace(/^#/, "");
        const modulo = rutas[nombre] || rutas["scorer"];

        // Destruir el módulo previo (limpiar timers, sockets, etc.)
        if (actual && typeof actual.destroy === "function") {
            try { actual.destroy(); } catch (_) {}
        }
        actual = modulo;
        token += 1;
        const miToken = token;

        // Marcar enlace activo en el nav.
        document.querySelectorAll(".app-nav a").forEach((a) => {
            a.classList.toggle("activo", a.dataset.ruta === nombre);
        });

        const cont = document.getElementById("vista");
        cont.innerHTML = "";
        try {
            await modulo.render(cont);
        } catch (err) {
            // Si ya no somos la ruta activa, no mostramos el error — es
            // el resultado de una navegación cancelada.
            if (!vigente(miToken)) return;
            console.error(err);
            cont.innerHTML = `<div class="card"><p class="text-dim">
                Error cargando módulo: ${escapeHtml(err.message || err)}</p></div>`;
        }
    }

    function iniciar() {
        window.addEventListener("hashchange", navegar);
        navegar();
    }

    return { registrar, navegar, iniciar, tokenActual, vigente };
})();
