// =====================================================================
//  Módulo ADMIN - usuarios y contraseñas
// =====================================================================

const ModuloAdmin = (() => {
    async function render(cont) {
        const esAdmin = await FllAuth.esAdmin();
        if (!esAdmin) {
            cont.innerHTML = `<div class="card"><p class="text-dim">
                No tienes permisos para ver esta sección.
            </p></div>`;
            return;
        }

        cont.innerHTML = `
            <div class="page-header">
                <h2>Administración</h2>
                <div class="acciones">
                    <button class="btn" id="btn-nuevo-usuario">+ Crear usuario</button>
                </div>
            </div>

            <!-- ─── PURGA DE DATOS ─── primero para que siempre sea visible -->
            <div class="card card--purga" id="card-purga-datos">
                <div class="purga-header">
                    <div>
                        <h3 style="margin:0 0 .25rem;">🗑 Purgar datos del equipo activo</h3>
                        <p class="text-dim small" style="margin:0;">
                            El equipo se toma del selector superior. Las acciones son
                            <strong>irreversibles</strong>.
                        </p>
                    </div>
                </div>
                <div class="purga-botones">
                    <div class="purga-btn-wrap">
                        <button type="button" class="btn btn--danger btn--purga" id="btn-purga-ranking">
                            🏆 Purgar ranking y puntajes de jugadores
                        </button>
                        <p class="text-dim small" style="margin:.25rem 0 0;">
                            Elimina <em>todas</em> las partidas y puntajes. Ranking queda vacío.
                        </p>
                    </div>
                    <div class="purga-btn-wrap">
                        <button type="button" class="btn btn--warning btn--purga" id="btn-purga-analisis">
                            📊 Purgar efectividad de misiones (análisis)
                        </button>
                        <p class="text-dim small" style="margin:.25rem 0 0;">
                            Elimina solo el detalle por misión. Los puntajes totales se conservan.
                        </p>
                    </div>
                </div>
            </div>

            <!-- ─── USUARIOS ─── -->
            <div class="card">
                <p class="text-dim small">
                    Crea coaches, cambia roles, activa/desactiva cuentas y resetea contraseñas.
                </p>
                <ul class="item-list" id="lista-usuarios"></ul>
            </div>`;

        cont.querySelector("#btn-nuevo-usuario")
            .addEventListener("click", () => formularioCrearUsuario());
        cont.querySelector("#btn-purga-ranking")
            .addEventListener("click", () => ejecutarPurgaRanking());
        cont.querySelector("#btn-purga-analisis")
            .addEventListener("click", () => ejecutarPurgaAnalisis());

        await refrescar();
    }

    async function refrescar() {
        const lista = document.getElementById("lista-usuarios");
        if (!lista) return;

        const usuarios = await ApiAdmin.listarUsuarios();
        if (usuarios.length === 0) {
            lista.innerHTML = `<li class="text-dim">No hay usuarios registrados.</li>`;
            return;
        }

        lista.innerHTML = "";
        usuarios.forEach((u) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div>
                    <div><strong>${escapeHtml(u.email)}</strong></div>
                    <div class="text-dim small">
                        ${escapeHtml(u.nombre || "Sin nombre")} · Rol: ${escapeHtml(u.rol)} ·
                        ${u.activo ? "Activo" : "Inactivo"} ·
                        ${u.debe_cambiar_password ? "Debe cambiar contraseña" : "Contraseña OK"}
                    </div>
                </div>
                <div class="acciones">
                    <button class="btn btn--ghost" data-accion="toggle">
                        ${u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button class="btn btn--ghost" data-accion="rol">Cambiar rol</button>
                    <button class="btn btn--warning" data-accion="pass">Reset pass</button>
                </div>`;

            li.querySelector('[data-accion="toggle"]')
                .addEventListener("click", () => toggleActivo(u));
            li.querySelector('[data-accion="rol"]')
                .addEventListener("click", () => cambiarRol(u));
            li.querySelector('[data-accion="pass"]')
                .addEventListener("click", () => resetearPassword(u));
            lista.appendChild(li);
        });
    }

    async function ejecutarPurgaRanking() {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            toast("Selecciona un equipo arriba antes de purgar", "error");
            return;
        }
        const ok = await confirmar(
            "¿Eliminar TODAS las partidas y puntajes de jugadores de este equipo? No se puede deshacer.");
        if (!ok) return;
        try {
            const n = await ApiAdmin.purgarRankingEquipo(equipoId);
            toast(`Se eliminaron ${n} partida(s). Rankings y análisis quedan vacíos para este equipo.`, "success");
        } catch (err) {
            console.error(err);
            toast(err.message || "No se pudo purgar", "error");
        }
    }

    async function ejecutarPurgaAnalisis() {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            toast("Selecciona un equipo arriba antes de purgar", "error");
            return;
        }
        const ok = await confirmar(
            "¿Eliminar solo los registros de misiones (efectividad / análisis)? Las partidas y puntajes de jugadores se conservan.");
        if (!ok) return;
        try {
            const n = await ApiAdmin.purgarAnalisisMisionesEquipo(equipoId);
            toast(`Se eliminaron ${n} fila(s) de misiones en partidas.`, "success");
        } catch (err) {
            console.error(err);
            toast(err.message || "No se pudo purgar", "error");
        }
    }

    async function formularioCrearUsuario() {
        const html = `
            <div class="form-field">
                <label>Correo</label>
                <input type="email" id="f-email" required placeholder="coach@correo.com" />
            </div>
            <div class="form-field">
                <label>Nombre (opcional)</label>
                <input type="text" id="f-nombre" placeholder="Nombre visible" />
            </div>
            <div class="form-field">
                <label>Contraseña temporal (mínimo 6)</label>
                <input type="text" id="f-pass" required minlength="6" placeholder="Temporal123" />
            </div>
            <div class="form-field">
                <label>Rol</label>
                <select id="f-rol">
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                </select>
            </div>`;

        await abrirModal("Crear usuario", html, {
            okTexto: "Crear",
            onSubmit: async (body) => {
                const email = body.querySelector("#f-email").value.trim().toLowerCase();
                const nombre = body.querySelector("#f-nombre").value.trim();
                const pass = body.querySelector("#f-pass").value.trim();
                const rol = body.querySelector("#f-rol").value;

                if (!email || !pass) {
                    toast("Correo y contraseña temporal son obligatorios", "error");
                    return false;
                }

                await ApiAdmin.crearUsuario({
                    email,
                    passwordTemporal: pass,
                    nombre,
                    rol,
                    activo: true,
                });
                toast("Usuario creado", "success");
                await refrescar();
            },
        });
    }

    async function toggleActivo(usuario) {
        await ApiAdmin.actualizarPerfil(usuario.user_id, { activo: !usuario.activo });
        toast(usuario.activo ? "Usuario desactivado" : "Usuario activado", "success");
        await refrescar();
    }

    async function cambiarRol(usuario) {
        const html = `
            <div class="form-field">
                <label>Rol</label>
                <select id="f-rol">
                    <option value="coach" ${usuario.rol === "coach" ? "selected" : ""}>Coach</option>
                    <option value="admin" ${usuario.rol === "admin" ? "selected" : ""}>Admin</option>
                </select>
            </div>`;

        await abrirModal(`Rol para ${escapeHtml(usuario.email)}`, html, {
            okTexto: "Guardar",
            onSubmit: async (body) => {
                const rol = body.querySelector("#f-rol").value;
                await ApiAdmin.actualizarPerfil(usuario.user_id, { rol });
                toast("Rol actualizado", "success");
                await refrescar();
            },
        });
    }

    async function resetearPassword(usuario) {
        const html = `
            <div class="form-field">
                <label>Nueva contraseña temporal</label>
                <input type="text" id="f-pass" required minlength="6" placeholder="Temporal123" />
            </div>
            <p class="text-dim small">El usuario deberá cambiarla al entrar.</p>`;

        await abrirModal(`Resetear password: ${escapeHtml(usuario.email)}`, html, {
            okTexto: "Resetear",
            onSubmit: async (body) => {
                const nuevaTemporal = body.querySelector("#f-pass").value.trim();
                if (!nuevaTemporal || nuevaTemporal.length < 6) {
                    toast("La contraseña debe tener al menos 6 caracteres", "error");
                    return false;
                }
                await ApiAdmin.resetearPassword({
                    userId: usuario.user_id,
                    nuevaTemporal,
                });
                toast("Contraseña reseteada", "success");
                await refrescar();
            },
        });
    }

    return { render };
})();
