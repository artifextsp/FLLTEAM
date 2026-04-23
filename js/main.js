// =====================================================================
//  Punto de entrada del app.html
//  - Garantiza sesión (o redirige a login).
//  - Rellena el selector de equipo activo (global en el header).
//  - Registra módulos en el router y arranca la navegación.
// =====================================================================

(async () => {
    await FllAuth.requireAuth();

    // Registrar módulos (orden alfabético no relevante)
    Router.registrar("scorer",    ModuloScorer);
    Router.registrar("equipos",   ModuloEquipos);
    Router.registrar("jugadores", ModuloJugadores);
    Router.registrar("misiones",  ModuloMisiones);
    Router.registrar("lanzadas",  ModuloLanzadas);
    Router.registrar("rankings",  ModuloRankings);
    Router.registrar("analisis",  ModuloAnalisis);

    // Selector global de equipo activo
    const sel = document.getElementById("selector-equipo");
    async function recargarEquipos() {
        const equipos = await ApiEquipos.listar();
        const activo  = EquipoActivo.get();
        sel.innerHTML =
            '<option value="">— Selecciona equipo —</option>' +
            equipos.map((e) =>
                `<option value="${e.id}" ${e.id === activo ? "selected" : ""}>
                    ${escapeHtml(e.nombre)}
                 </option>`).join("");
        // Si no había activo y hay al menos uno, selecciona el primero.
        if (!activo && equipos.length > 0) {
            EquipoActivo.set(equipos[0].id);
            sel.value = equipos[0].id;
        }
    }
    sel.addEventListener("change", () => {
        EquipoActivo.set(sel.value);
        // Notificar a los módulos activos para que recarguen si aplica.
        window.dispatchEvent(new CustomEvent("equipo-activo-cambio"));
    });
    // Exponer para que otros módulos disparen una recarga tras CRUD de equipos.
    window.recargarSelectorEquipos = recargarEquipos;
    await recargarEquipos();

    // Logout
    document.getElementById("btn-logout").addEventListener("click", async () => {
        try {
            await FllAuth.cerrarSesion();
            EquipoActivo.set("");
            window.location.replace("login.html");
        } catch (err) {
            toast(err.message || "No se pudo cerrar sesión", "error");
        }
    });

    // Arrancar router
    Router.iniciar();
})();
