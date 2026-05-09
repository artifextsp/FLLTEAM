// =====================================================================
//  Punto de entrada del app.html
//  - Garantiza sesión (o redirige a login).
//  - Rellena el selector de equipo activo (global en el header).
//  - Registra módulos en el router y arranca la navegación.
// =====================================================================

(async () => {
    await FllAuth.requireAuth();
    const perfil = await FllAuth.miPerfil().catch(() => null);
    const esAdmin = await FllAuth.esAdmin().catch(() => false);

    // Registrar módulos (orden alfabético no relevante)
    Router.registrar("scorer",    ModuloScorer);
    Router.registrar("admin",     ModuloAdmin);
    Router.registrar("equipos",   ModuloEquipos);
    Router.registrar("jugadores", ModuloJugadores);
    Router.registrar("misiones",  ModuloMisiones);
    Router.registrar("lanzadas",  ModuloLanzadas);
    Router.registrar("rankings",  ModuloRankings);
    Router.registrar("analisis",  ModuloAnalisis);

    // Muestra enlace admin solo a perfiles admin.
    const linkAdmin = document.querySelector('.app-nav a[data-ruta="admin"]');
    if (linkAdmin) linkAdmin.style.display = esAdmin ? "" : "none";

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

    // Si el admin marcó reset, obliga cambio de contraseña al entrar.
    if (perfil?.debe_cambiar_password) {
        const cambioOk = await abrirModal("Cambio obligatorio de contraseña", `
            <p class="text-dim small">
                Debes cambiar tu contraseña temporal antes de continuar.
            </p>
            <div class="form-field">
                <label>Nueva contraseña</label>
                <input type="password" id="f-pass1" minlength="6" required />
            </div>
            <div class="form-field">
                <label>Confirmar contraseña</label>
                <input type="password" id="f-pass2" minlength="6" required />
            </div>
        `, {
            okTexto: "Guardar",
            cancelTexto: "Salir",
            onSubmit: async (body) => {
                const p1 = body.querySelector("#f-pass1").value.trim();
                const p2 = body.querySelector("#f-pass2").value.trim();
                if (p1.length < 6) {
                    toast("La contraseña debe tener al menos 6 caracteres", "error");
                    return false;
                }
                if (p1 !== p2) {
                    toast("Las contraseñas no coinciden", "error");
                    return false;
                }
                await FllAuth.cambiarMiPassword(p1);
                await FllAuth.marcarPasswordCambiada();
                toast("Contraseña actualizada", "success");
            },
        });
        if (cambioOk == null) {
            await FllAuth.cerrarSesion();
            window.location.replace("login.html");
            return;
        }
    }

    // Arrancar router
    Router.iniciar();
})();
