# FLL Team · Sistema de Entrenamientos (UNEARTHED 2025-2026)

Aplicación web responsive (móvil + portátil) para gestionar entrenamientos de un equipo **FIRST LEGO League**. Construida con **HTML + CSS + JavaScript vanilla** y **Supabase** (PostgreSQL + Auth + Realtime).

---

## ✨ Funcionalidades

- **Autenticación** de coaches con email/contraseña (Supabase Auth). Cada coach ve únicamente sus datos (RLS).
- **Equipos y Jugadores**: CRUD completo, estadísticas acumuladas por jugador.
- **Scorer de misiones** (pantalla principal):
  - Countdown 2:30 grande y centrado.
  - Drag & drop de jugadores a Base Azul / Base Roja (mouse **y** touch).
  - Misiones con toggles *completada / fallada* + bonus por misión.
  - Cuadrilla y duplas **opcionales** (nombre libre).
  - Botones: Iniciar, Finalizar, Descartar, Repetir.
- **Misiones editables desde la DB**: tabla `misiones` con seed UNEARTHED; sin tocar código.
- **Posición de lanzamiento por misión y equipo**: orientación (H/V), número, dirección.
- **Rankings**: general, por base azul/roja, por cuadrilla y por dupla (nombradas).
- **Análisis**: efectividad por misión + gráfico de tendencia (Chart.js) + alertas de baja efectividad/tendencia decreciente.
- **Sincronización en tiempo real** activada sobre todas las tablas (publicación `supabase_realtime`).
- **100% responsive**, mobile-first, minimalista, botones grandes para uso táctil.

---

## 📁 Estructura

```text
FLLTEAM/
├── index.html                # Redirige a login o app según sesión
├── login.html                # Login/registro de coach
├── app.html                  # SPA (scorer, equipos, jugadores, misiones, rankings, análisis)
├── config.example.js         # Plantilla de config — copiar a config.js
├── .gitignore
├── css/                      # base, components, layout, scorer, responsive
├── js/
│   ├── supabaseClient.js
│   ├── utils.js, auth.js, router.js, main.js
│   ├── api/                  # Capa de datos (1 archivo por tabla)
│   └── modules/              # scorer, equipos, jugadores, misiones, rankings, analisis
└── sql/
    ├── 01_schema.sql         # Tablas + índices + RLS + vistas + realtime
    └── 02_seed_unearthed.sql # Misiones UNEARTHED 2025-2026
```

---

## 🚀 Puesta en marcha paso a paso

### 1) Crear el proyecto en Supabase

1. Entra en <https://supabase.com> → **New project**.
2. Ponle nombre (p. ej. `fll-team`) y una contraseña segura para la DB.
3. Elige la región más cercana.
4. Espera a que el proyecto se aprovisione (~1 min).

### 2) Configurar Auth (muy importante)

1. En el panel de tu proyecto → **Authentication** → **Providers** → asegúrate de que **Email** está habilitado.
2. **Authentication → Sign In / Up → Email**: para entrenamientos es cómodo **desactivar** la verificación obligatoria por correo (*Confirm email* → OFF). Si prefieres dejarla activa, cada nuevo coach deberá confirmar su email antes de entrar.
3. **Authentication → URL Configuration**: añade tu URL de producción a *Site URL* y *Redirect URLs* (p. ej. `https://tu-sitio.netlify.app`). Para desarrollo local añade también `http://localhost:5500` o el puerto que uses.

### 3) Ejecutar el esquema SQL

1. Panel Supabase → **SQL Editor** → **New query**.
2. Pega el contenido de `sql/01_schema.sql` → **Run**. Verás que se crean todas las tablas, vistas, índices y políticas RLS.
3. Pega el contenido de `sql/02_seed_unearthed.sql` → **Run**. Se insertan las misiones de la temporada. Puedes editar nombres, puntos y bonus aquí sin tocar el frontend.

> 💡 **Verificar misiones**: los nombres y puntajes del seed se basan en información pública de la temporada y pueden requerir ajustes. Revisa contra el rulebook oficial y edita la tabla `misiones` con un `UPDATE` o desde **Table Editor**.

### 4) Obtener URL y Anon Key

1. Panel Supabase → **Project Settings** → **API**.
2. Copia:
   - **Project URL** → `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** → una cadena larga tipo `eyJhbGciOi...`

### 5) Configurar el frontend

```bash
cp config.example.js config.js
```

Edita `config.js`:

```js
window.FLL_CONFIG = {
    SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
    SUPABASE_ANON_KEY: "TU_ANON_KEY_AQUI",
};
```

> `config.js` está en `.gitignore`, no se subirá al repositorio. La *anon key* es pública y segura para el frontend; todas las consultas están protegidas por RLS.

### 6) Probar en local

No hay bundler ni build. Sirve la carpeta con cualquier servidor estático; dos opciones rápidas:

```bash
# Python (viene en macOS/Linux)
python3 -m http.server 5500

# O con Node (si lo tienes):
npx serve -l 5500 .
```

Abre <http://localhost:5500> en el navegador, regístrate como coach y empieza a usar la app.

### 7) Desplegar (Netlify o Vercel)

Al ser una web estática pura, cualquier hosting estático funciona:

**Netlify (drag & drop)**

1. <https://app.netlify.com> → *Add new site* → *Deploy manually*.
2. Arrastra toda la carpeta del proyecto (con `config.js` ya configurado).
3. Copia la URL asignada y añádela en **Supabase → Auth → URL Configuration** (Site URL + Redirect URL).

**Vercel**

1. `npm i -g vercel` (una sola vez).
2. Dentro del proyecto: `vercel`. Acepta defaults.
3. Añade la URL al panel de Supabase como en Netlify.

> Alternativa: **GitHub Pages**. Sube el repo (sin `config.js`) y añade manualmente `config.js` al deploy, o usa una acción que lo genere desde secretos.

---

## 🧪 Primera vez usando la app

1. Abre la URL y **regístrate** con tu email.
2. Crea un **equipo** (barra superior → *Equipos*).
3. Añade 4+ **jugadores** al equipo.
4. Ve a **Scorer**:
   - Arrastra 2 jugadores a Base Azul y 2 a Base Roja.
   - (Opcional) escribe nombres de **Cuadrilla** y **Duplas**.
   - Pulsa **▶ Iniciar** y comienza el entrenamiento de 2:30.
   - Marca misiones como completadas/falladas y aplica bonus.
   - Al finalizar (o al pulsar **Finalizar**) se guarda automáticamente.
5. Revisa **Rankings** y **Análisis** tras varias partidas.

---

## 🔐 Modelo de seguridad

- Cada tabla en `public` tiene **RLS activado**.
- Política general: `coach_id = auth.uid()` para `SELECT / INSERT / UPDATE / DELETE`.
- `misiones` es de **solo lectura** desde la API (solo `SELECT` para usuarios autenticados). Se edita desde el panel de Supabase (DB).
- Las tablas hijas (`partidas_jugadores`, `partidas_misiones`) se validan por la partida padre (EXISTS con `coach_id = auth.uid()`).
- Las **vistas** `v_estadisticas_jugador` y `v_efectividad_mision` usan `security_invoker = true` para respetar RLS del usuario que consulta.

---

## 🛠️ Editar misiones sin tocar código

Desde **SQL Editor** de Supabase:

```sql
update public.misiones
set puntos_base = 25,
    bonus = '[{"codigo":"b1","nombre":"Sin fallos","puntos":15}]'::jsonb
where codigo = 'M02';
```

O desde **Table Editor** → tabla `misiones` → editar celdas.

---

## 🧩 Tecnologías

- **Frontend**: HTML5, CSS3 (variables CSS, grid, flexbox), JavaScript ES2020 vanilla.
- **CDN**: `@supabase/supabase-js@2`, `chart.js@4.4.1`.
- **Backend**: Supabase (PostgreSQL 15+, Auth, Realtime).
- **Sin build step, sin Node en runtime.**

---

## 📝 Licencia

Uso libre para tu equipo FLL.
