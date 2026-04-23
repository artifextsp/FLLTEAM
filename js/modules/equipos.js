// =====================================================================
//  Módulo EQUIPOS - CRUD de equipos del coach autenticado
// =====================================================================

const ModuloEquipos = (() => {
    async function render(cont) {
        cont.innerHTML = `
            <div class="page-header">
                <h2>Equipos</h2>
                <div class="acciones">
                    <button class="btn" id="btn-nuevo-equipo">+ Nuevo equipo</button>
                </div>
            </div>
            <div class="card">
                <ul class="item-list" id="lista-equipos"></ul>
            </div>`;

        cont.querySelector("#btn-nuevo-equipo")
            .addEventListener("click", () => formulario());

        await refrescar();
    }

    async function refrescar() {
        const equipos = await ApiEquipos.listar();
        const lista   = document.getElementById("lista-equipos");
        if (!lista) return;
        if (equipos.length === 0) {
            lista.innerHTML = `<li class="text-dim">Aún no tienes equipos. Crea el primero.</li>`;
            return;
        }
        lista.innerHTML = "";
        equipos.forEach((e) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div>
                    <div><strong>${escapeHtml(e.nombre)}</strong></div>
                    <div class="text-dim small">${escapeHtml(e.descripcion || "")}</div>
                </div>
                <div class="acciones">
                    <button class="btn btn--ghost"  data-accion="editar">Editar</button>
                    <button class="btn btn--danger" data-accion="eliminar">Eliminar</button>
                </div>`;
            li.querySelector('[data-accion="editar"]')
                .addEventListener("click", () => formulario(e));
            li.querySelector('[data-accion="eliminar"]')
                .addEventListener("click", () => eliminar(e));
            lista.appendChild(li);
        });
    }

    async function formulario(equipo = null) {
        const html = `
            <div class="form-field">
                <label>Nombre</label>
                <input type="text" id="f-nombre" required
                       value="${escapeHtml(equipo?.nombre || "")}" />
            </div>
            <div class="form-field">
                <label>Descripción</label>
                <textarea id="f-desc">${escapeHtml(equipo?.descripcion || "")}</textarea>
            </div>`;
        await abrirModal(equipo ? "Editar equipo" : "Nuevo equipo", html, {
            okTexto: "Guardar",
            onSubmit: async (body) => {
                const nombre = body.querySelector("#f-nombre").value.trim();
                const desc   = body.querySelector("#f-desc").value.trim();
                if (!nombre) { toast("Nombre obligatorio", "error"); return false; }
                if (equipo) {
                    await ApiEquipos.actualizar(equipo.id,
                        { nombre, descripcion: desc || null });
                } else {
                    await ApiEquipos.crear({ nombre, descripcion: desc });
                }
                await refrescar();
                await window.recargarSelectorEquipos?.();
                toast("Guardado", "success");
            },
        });
    }

    async function eliminar(equipo) {
        const ok = await confirmar(
            `Eliminar "${equipo.nombre}" borrará también sus jugadores y partidas. ¿Continuar?`
        );
        if (!ok) return;
        try {
            await ApiEquipos.eliminar(equipo.id);
            if (EquipoActivo.get() === equipo.id) EquipoActivo.set("");
            await refrescar();
            await window.recargarSelectorEquipos?.();
            toast("Eliminado", "success");
        } catch (err) {
            toast(err.message, "error");
        }
    }

    return { render };
})();
