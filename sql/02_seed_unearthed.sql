-- =====================================================================
--  Seed oficial de Misiones · Temporada UNEARTHED 2025-2026
--  Fuente: FIRST Event Hub Official Scoring Calculator
--  https://eventhub.firstinspires.org/scoresheet
--  Corroborado con https://ostermiller.org/fll/unearthed.html
-- ---------------------------------------------------------------------
--  Esquema de puntos (NUEVO FORMATO POR CONTROLES TIPADOS)
--  -------------------------------------------------------
--  Se reutiliza la columna `bonus` (jsonb) como arreglo de "controles"
--  que el scorer renderiza directamente. Cada control puede ser:
--
--    {"codigo":"…","tipo":"si_no",   "nombre":"…","puntos":N}
--       → toggle. Suma N si está activo.
--
--    {"codigo":"…","tipo":"contador","nombre":"…","puntos":N,"max":M}
--       → slider 0..M. Suma (valor × N).
--
--    {"codigo":"…","tipo":"opciones","nombre":"…",
--        "opciones":[{"valor":0,"puntos":0,"label":"0"}, …]}
--       → selección única. Suma los puntos de la opción marcada.
--
--  `puntos_base` queda en 0 para TODAS las misiones: los puntos ahora
--  viven dentro de los controles. Esto alinea el scorer con la versión
--  oficial y permite calcular un % de cumplimiento por misión
--  (puntos_obtenidos / max_mision × 100).
--
--  Máximo teórico total: 545 puntos (sin GP — que lo asigna el árbitro).
-- =====================================================================

delete from public.misiones where temporada = 'UNEARTHED 2025-2026';

insert into public.misiones
    (codigo, nombre_es, descripcion, puntos_base, bonus, orden, temporada)
values

-- ---------- EI · Inspección de Equipamiento · máx 20 -----------------
('EI', 'Inspección de Equipamiento',
 'El robot y todo el equipamiento caben completamente en un área de lanzamiento y por debajo del límite de altura.',
 0,
 '[
   {"codigo":"fit","tipo":"si_no","nombre":"Cabe en el área y bajo el límite","puntos":20}
 ]'::jsonb,
 0, 'UNEARTHED 2025-2026'),

-- ---------- M01 · Surface Brushing · máx 30 --------------------------
('M01', 'Cepillado de superficie',
 'Retirar los depósitos de sedimento tocando el tapete. El cepillo no toca el sitio al final.',
 0,
 '[
   {"codigo":"soil","tipo":"contador","nombre":"Sedimentos completamente retirados","puntos":10,"max":2},
   {"codigo":"brush","tipo":"si_no","nombre":"Cepillo no toca el sitio","puntos":10}
 ]'::jsonb,
 1, 'UNEARTHED 2025-2026'),

-- ---------- M02 · Map Reveal · máx 30 --------------------------------
('M02', 'Revelación del mapa',
 'Secciones de capa superficial completamente retiradas.',
 0,
 '[
   {"codigo":"topsoil","tipo":"contador","nombre":"Secciones de tierra retiradas","puntos":10,"max":3}
 ]'::jsonb,
 2, 'UNEARTHED 2025-2026'),

-- ---------- M03 · Mineshaft Explorer · máx 40 ------------------------
('M03', 'Explorador del tiro de mina',
 'Tu carro de mina queda en el campo del oponente; bonus si el carro oponente queda en tu campo.',
 0,
 '[
   {"codigo":"mine","tipo":"si_no","nombre":"Tu carro en el campo oponente","puntos":30},
   {"codigo":"opp","tipo":"si_no","nombre":"Bonus: carro oponente en tu campo","puntos":10}
 ]'::jsonb,
 3, 'UNEARTHED 2025-2026'),

-- ---------- M04 · Careful Recovery · máx 40 --------------------------
('M04', 'Recuperación cuidadosa',
 'El artefacto valioso no toca la mina y ambos soportes quedan de pie.',
 0,
 '[
   {"codigo":"art","tipo":"si_no","nombre":"Artefacto valioso no toca la mina","puntos":30},
   {"codigo":"sup","tipo":"si_no","nombre":"Ambos soportes de pie","puntos":10}
 ]'::jsonb,
 4, 'UNEARTHED 2025-2026'),

-- ---------- M05 · Who Lived Here? · máx 30 ---------------------------
('M05', '¿Quiénes vivieron aquí?',
 'El suelo de la estructura queda completamente vertical.',
 0,
 '[
   {"codigo":"floor","tipo":"si_no","nombre":"Suelo completamente vertical","puntos":30}
 ]'::jsonb,
 5, 'UNEARTHED 2025-2026'),

-- ---------- M06 · Forge · máx 30 -------------------------------------
('M06', 'Forja',
 'Bloques de mineral fuera de la forja (no tocándola).',
 0,
 '[
   {"codigo":"ore","tipo":"contador","nombre":"Bloques fuera de la forja","puntos":10,"max":3}
 ]'::jsonb,
 6, 'UNEARTHED 2025-2026'),

-- ---------- M07 · Heavy Lifting · máx 30 -----------------------------
('M07', 'Levantamiento de cargas pesadas',
 'La piedra de molino ya no toca su base.',
 0,
 '[
   {"codigo":"mill","tipo":"si_no","nombre":"Piedra de molino no toca su base","puntos":30}
 ]'::jsonb,
 7, 'UNEARTHED 2025-2026'),

-- ---------- M08 · Silo · máx 30 --------------------------------------
('M08', 'Silo',
 'Piezas preservadas fuera del silo.',
 0,
 '[
   {"codigo":"pcs","tipo":"contador","nombre":"Piezas fuera del silo","puntos":10,"max":3}
 ]'::jsonb,
 8, 'UNEARTHED 2025-2026'),

-- ---------- M09 · What''s on Sale? · máx 30 --------------------------
('M09', '¿Qué hay a la venta?',
 'Techo del mercado completamente levantado y mercancías levantadas.',
 0,
 '[
   {"codigo":"roof","tipo":"si_no","nombre":"Techo completamente levantado","puntos":20},
   {"codigo":"wares","tipo":"si_no","nombre":"Mercancías levantadas","puntos":10}
 ]'::jsonb,
 9, 'UNEARTHED 2025-2026'),

-- ---------- M10 · Tip the Scales · máx 30 ----------------------------
('M10', 'Inclinar la balanza',
 'Balanza inclinada tocando el tapete; platillo completamente removido.',
 0,
 '[
   {"codigo":"scale","tipo":"si_no","nombre":"Balanza inclinada tocando el tapete","puntos":20},
   {"codigo":"pan","tipo":"si_no","nombre":"Platillo completamente removido","puntos":10}
 ]'::jsonb,
 10, 'UNEARTHED 2025-2026'),

-- ---------- M11 · Angler Artifacts · máx 30 --------------------------
('M11', 'Artefactos del pescador',
 'Artefactos elevados por encima del nivel del suelo; bonus si la bandera de la grúa queda al menos parcialmente bajada.',
 0,
 '[
   {"codigo":"raised","tipo":"si_no","nombre":"Artefactos elevados sobre el suelo","puntos":20},
   {"codigo":"flag","tipo":"si_no","nombre":"Bonus: bandera de la grúa bajada","puntos":10}
 ]'::jsonb,
 11, 'UNEARTHED 2025-2026'),

-- ---------- M12 · Salvage Operation · máx 30 -------------------------
('M12', 'Operación de salvamento',
 'Arena completamente removida y barco completamente levantado.',
 0,
 '[
   {"codigo":"sand","tipo":"si_no","nombre":"Arena completamente removida","puntos":20},
   {"codigo":"ship","tipo":"si_no","nombre":"Barco completamente levantado","puntos":10}
 ]'::jsonb,
 12, 'UNEARTHED 2025-2026'),

-- ---------- M13 · Statue Rebuild · máx 30 ----------------------------
('M13', 'Reconstrucción de la estatua',
 'Estatua completamente levantada.',
 0,
 '[
   {"codigo":"st","tipo":"si_no","nombre":"Estatua completamente levantada","puntos":30}
 ]'::jsonb,
 13, 'UNEARTHED 2025-2026'),

-- ---------- M14 · Forum · máx 35 -------------------------------------
('M14', 'Foro',
 'Artefactos tocando el tapete y al menos parcialmente dentro del foro (5 c/u: Cepillo, Tierra, Artefacto Valioso, Carro oponente, Mineral con fósil, Piedra de molino, Platillo).',
 0,
 '[
   {"codigo":"forum","tipo":"contador","nombre":"Artefactos en el foro","puntos":5,"max":7}
 ]'::jsonb,
 14, 'UNEARTHED 2025-2026'),

-- ---------- M15 · Site Marking · máx 30 ------------------------------
('M15', 'Marcado de sitios',
 'Sitios con bandera al menos parcialmente dentro y tocando el tapete.',
 0,
 '[
   {"codigo":"sites","tipo":"contador","nombre":"Sitios marcados con bandera","puntos":10,"max":3}
 ]'::jsonb,
 15, 'UNEARTHED 2025-2026'),

-- ---------- PT · Precision Tokens · máx 50 ---------------------------
('PT', 'Fichas de precisión',
 'Cantidad de fichas de precisión que quedan al final de la partida (seleccionar cuántas).',
 0,
 '[
   {"codigo":"pt","tipo":"opciones","nombre":"Fichas restantes",
    "opciones":[
       {"valor":0,"puntos":0,"label":"0"},
       {"valor":1,"puntos":10,"label":"1"},
       {"valor":2,"puntos":15,"label":"2"},
       {"valor":3,"puntos":25,"label":"3"},
       {"valor":4,"puntos":35,"label":"4"},
       {"valor":5,"puntos":50,"label":"5"},
       {"valor":6,"puntos":50,"label":"6"}
    ]}
 ]'::jsonb,
 16, 'UNEARTHED 2025-2026');

-- Máximo teórico:
--   EI 20 + M01 30 + M02 30 + M03 40 + M04 40 + M05 30 + M06 30 +
--   M07 30 + M08 30 + M09 30 + M10 30 + M11 30 + M12 30 + M13 30 +
--   M14 35 + M15 30 + PT 50 = 545
