// =====================================================================
//  Router por hash (#scorer, #equipos, ...) — sin dependencias.
//  Cada ruta mapea a un módulo con `render(contenedor)` y, opcional,
//  `destroy()` para limpiar listeners/intervalos al cambiar.
// =====================================================================

const Router = (() => {
    const rutas = {};
    let actual = null;

    function registrar(nombre, modulo) {
        rutas[nombre] = modulo;
    }

    async function navegar() {
        const nombre = (location.hash || "#scorer").replace(/^#/, "");
        const modulo = rutas[nombre] || rutas["scorer"];

        // Destruir el módulo previo (limpiar timers, sockets, etc.)
        if (actual && typeof actual.destroy === "function") {
            try { actual.destroy(); } catch (_) {}
        }
        actual = modulo;

        // Marcar enlace activo en el nav.
        document.querySelectorAll(".app-nav a").forEach((a) => {
            a.classList.toggle("activo", a.dataset.ruta === nombre);
        });

        const cont = document.getElementById("vista");
        cont.innerHTML = "";
        try {
            await modulo.render(cont);
        } catch (err) {
            console.error(err);
            cont.innerHTML = `<div class="card"><p class="text-dim">
                Error cargando módulo: ${escapeHtml(err.message || err)}</p></div>`;
        }
    }

    function iniciar() {
        window.addEventListener("hashchange", navegar);
        navegar();
    }

    return { registrar, navegar, iniciar };
})();
