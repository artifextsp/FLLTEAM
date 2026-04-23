// =====================================================================
//  Módulo RANKINGS - Clasificaciones por jugador, base, cuadrilla y dupla
// =====================================================================

const ModuloRankings = (() => {
    async function render(cont) {
        const equipoId = EquipoActivo.get();
        if (!equipoId) {
            cont.innerHTML = `<div class="card empty">
                <h2>Selecciona un equipo</h2></div>`;
            return;
        }

        cont.innerHTML = `
            <div class="page-header"><h2>Rankings</h2></div>
            <div class="grid">
                <div class="card">
                    <h3>🏆 General (por puntos totales)</h3>
                    <div class="tabla-wrap"><table class="tabla tabla--compact" id="rk-general">
                        <thead><tr><th>#</th><th>Jugador</th><th>Total</th><th>Prom.</th><th>Lanz.</th></tr></thead>
                        <tbody></tbody>
                    </table></div>
                </div>
                <div class="card">
                    <h3>🔵 Por Base Azul</h3>
                    <div class="tabla-wrap"><table class="tabla tabla--compact" id="rk-azul">
                        <thead><tr><th>#</th><th>Jugador</th><th>Pts Azul</th><th>Lanz.</th></tr></thead>
                        <tbody></tbody>
                    </table></div>
                </div>
                <div class="card">
                    <h3>🔴 Por Base Roja</h3>
                    <div class="tabla-wrap"><table class="tabla tabla--compact" id="rk-roja">
                        <thead><tr><th>#</th><th>Jugador</th><th>Pts Roja</th><th>Lanz.</th></tr></thead>
                        <tbody></tbody>
                    </table></div>
                </div>
                <div class="card">
                    <h3>🧑‍🤝‍🧑 Cuadrillas (nombradas)</h3>
                    <div class="tabla-wrap"><table class="tabla tabla--compact" id="rk-cuadrillas">
                        <thead><tr><th>#</th><th>Cuadrilla</th><th>Partidas</th><th>Total</th><th>Prom.</th></tr></thead>
                        <tbody></tbody>
                    </table></div>
                </div>
                <div class="card">
                    <h3>👥 Duplas (nombradas)</h3>
                    <div class="tabla-wrap"><table class="tabla tabla--compact" id="rk-duplas">
                        <thead><tr><th>#</th><th>Dupla</th><th>Base</th><th>Partidas</th><th>Total</th><th>Prom.</th></tr></thead>
                        <tbody></tbody>
                    </table></div>
                </div>
            </div>`;

        await cargar(equipoId);
    }

    async function cargar(equipoId) {
        // Stats de jugadores (vía vista)
        const stats = await ApiJugadores.estadisticas(equipoId);

        pintarGeneral(stats);
        pintarBase(stats, "azul");
        pintarBase(stats, "roja");

        // Para cuadrillas y duplas traemos las partidas finalizadas del equipo.
        const partidas = await ApiPartidas.listar(equipoId, 500);
        pintarCuadrillas(partidas);
        pintarDuplas(partidas);
    }

    function pintarGeneral(stats) {
        const tbody = document.querySelector("#rk-general tbody");
        const orden = [...stats].sort((a, b) => b.puntos_totales - a.puntos_totales);
        tbody.innerHTML = orden.length === 0
            ? `<tr><td colspan="5" class="text-dim text-c">Sin datos</td></tr>`
            : orden.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(s.nombre)}</td>
                    <td><strong>${s.puntos_totales}</strong></td>
                    <td>${s.promedio}</td>
                    <td>${s.lanzamientos_totales}</td>
                </tr>`).join("");
    }

    function pintarBase(stats, base) {
        const tbody = document.querySelector(`#rk-${base} tbody`);
        const campo = base === "azul" ? "puntos_base_azul" : "puntos_base_roja";
        const campoL= base === "azul" ? "lanzamientos_azul" : "lanzamientos_roja";
        const orden = [...stats]
            .filter((s) => (s[campo] || 0) > 0)
            .sort((a, b) => b[campo] - a[campo]);
        tbody.innerHTML = orden.length === 0
            ? `<tr><td colspan="4" class="text-dim text-c">Sin datos</td></tr>`
            : orden.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(s.nombre)}</td>
                    <td><strong>${s[campo]}</strong></td>
                    <td>${s[campoL]}</td>
                </tr>`).join("");
    }

    function pintarCuadrillas(partidas) {
        const mapa = {};
        partidas.forEach((p) => {
            const k = p.cuadrilla_nombre?.trim();
            if (!k) return;
            if (!mapa[k]) mapa[k] = { nombre: k, partidas: 0, total: 0 };
            mapa[k].partidas += 1;
            mapa[k].total    += p.puntaje_total || 0;
        });
        const filas = Object.values(mapa)
            .map((x) => ({ ...x, promedio: +(x.total / x.partidas).toFixed(2) }))
            .sort((a, b) => b.total - a.total);

        const tbody = document.querySelector("#rk-cuadrillas tbody");
        tbody.innerHTML = filas.length === 0
            ? `<tr><td colspan="5" class="text-dim text-c">
                Aún no se han registrado partidas con nombre de cuadrilla.
               </td></tr>`
            : filas.map((f, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(f.nombre)}</td>
                    <td>${f.partidas}</td>
                    <td><strong>${f.total}</strong></td>
                    <td>${f.promedio}</td>
                </tr>`).join("");
    }

    function pintarDuplas(partidas) {
        // Contamos por (nombre, base) — una dupla se identifica por su base.
        const mapa = {};
        partidas.forEach((p) => {
            if (p.dupla_azul_nombre?.trim()) {
                agregarDupla(mapa, p.dupla_azul_nombre.trim(), "azul", p.puntaje_total);
            }
            if (p.dupla_roja_nombre?.trim()) {
                agregarDupla(mapa, p.dupla_roja_nombre.trim(), "roja", p.puntaje_total);
            }
        });
        const filas = Object.values(mapa)
            .map((x) => ({ ...x, promedio: +(x.total / x.partidas).toFixed(2) }))
            .sort((a, b) => b.total - a.total);

        const tbody = document.querySelector("#rk-duplas tbody");
        tbody.innerHTML = filas.length === 0
            ? `<tr><td colspan="6" class="text-dim text-c">
                Aún no se han registrado partidas con nombre de dupla.
               </td></tr>`
            : filas.map((f, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(f.nombre)}</td>
                    <td><span class="chip chip--${f.base}">${f.base}</span></td>
                    <td>${f.partidas}</td>
                    <td><strong>${f.total}</strong></td>
                    <td>${f.promedio}</td>
                </tr>`).join("");
    }

    function agregarDupla(mapa, nombre, base, puntos) {
        const k = `${nombre}::${base}`;
        if (!mapa[k]) mapa[k] = { nombre, base, partidas: 0, total: 0 };
        mapa[k].partidas += 1;
        mapa[k].total    += puntos || 0;
    }

    return { render };
})();
