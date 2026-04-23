-- =====================================================================
--  Seed oficial de Misiones - Temporada UNEARTHED 2025-2026
--  Fuente: FLL_Challenge_Reglas_UNEARTHED.pdf (edición en español)
--  https://fll.robotica.com.py/archivos/Challenge/FLL_Challenge_Reglas_UNEARTHED.pdf
-- ---------------------------------------------------------------------
--  Esquema de puntos:
--   - puntos_base: puntaje al marcar la misión como "Completada".
--   - bonus: arreglo de objetos {codigo,nombre,puntos} — cada chip suma
--     sus puntos cuando se activa (p.ej. items repetibles "c/u" se
--     listan como bonus independientes).
--
--  NOTA SOBRE CONTEO DE ITEMS "c/u":
--  Algunas misiones puntúan "X puntos cada uno" sobre varios modelos
--  (sedimentos, bloques, piezas, banderines…). El PDF no siempre indica
--  explícitamente la cantidad exacta; los conteos aquí se basan en lo
--  estándar observado en los videos/imágenes oficiales. Si tu mesa tiene
--  más o menos items, simplemente AÑADE o ELIMINA chips de bonus
--  editando la columna `bonus` en la tabla `misiones`.
-- =====================================================================

-- Resembrar desde cero (solo UNEARTHED). Seguro porque `misiones` es
-- referenciada por `posiciones_mision` y `partidas_misiones` con
-- FK on delete restrict, pero si aún no hay partidas se limpia bien.
delete from public.misiones where temporada = 'UNEARTHED 2025-2026';

insert into public.misiones
    (codigo, nombre_es, descripcion, puntos_base, bonus, orden, temporada)
values
-- -------------------- M00 -------------------------------------------
('M00', 'Inspección de Equipamiento',
 'Todo el equipamiento cabe en una sola área de lanzamiento y por debajo del límite de 305 mm de altura.',
 20,
 '[]'::jsonb,
 0, 'UNEARTHED 2025-2026'),

-- -------------------- M01 -------------------------------------------
('M01', 'Cepillado de superficie',
 'Retirar los sedimentos tocando el tapete. El cepillo de arqueología no toca el sitio de excavación al final.',
 0,
 '[
   {"codigo":"s1","nombre":"Sedimento 1 retirado","puntos":10},
   {"codigo":"s2","nombre":"Sedimento 2 retirado","puntos":10},
   {"codigo":"s3","nombre":"Sedimento 3 retirado","puntos":10},
   {"codigo":"cep","nombre":"Cepillo no toca el sitio","puntos":10}
 ]'::jsonb,
 1, 'UNEARTHED 2025-2026'),

-- -------------------- M02 -------------------------------------------
('M02', 'Revelación de mapa',
 'Las secciones de la capa superficial del suelo se han retirado completamente (10 c/u).',
 0,
 '[
   {"codigo":"sec1","nombre":"Sección 1 retirada","puntos":10},
   {"codigo":"sec2","nombre":"Sección 2 retirada","puntos":10},
   {"codigo":"sec3","nombre":"Sección 3 retirada","puntos":10}
 ]'::jsonb,
 2, 'UNEARTHED 2025-2026'),

-- -------------------- M03 -------------------------------------------
('M03', 'Recuperación cuidadosa',
 'Extraer el artefacto valioso de la mina garantizando la estabilidad del sitio.',
 30,
 '[
   {"codigo":"sop","nombre":"Las dos estructuras de soporte de pie","puntos":10}
 ]'::jsonb,
 3, 'UNEARTHED 2025-2026'),

-- -------------------- M04 -------------------------------------------
('M04', 'Exploración de minas',
 'El carro de mina del equipo pasa completamente al terreno del oponente.',
 30,
 '[
   {"codigo":"b1","nombre":"Bono: carro oponente en tu terreno","puntos":10}
 ]'::jsonb,
 4, 'UNEARTHED 2025-2026'),

-- -------------------- M05 -------------------------------------------
('M05', '¿Quiénes vivieron aquí?',
 'Reconstruir la estructura: el suelo queda completamente horizontal.',
 30,
 '[]'::jsonb,
 5, 'UNEARTHED 2025-2026'),

-- -------------------- M06 -------------------------------------------
('M06', 'Forja',
 'Liberar los bloques de mineral de la forja (10 c/u).',
 0,
 '[
   {"codigo":"bl1","nombre":"Bloque 1 fuera de la forja","puntos":10},
   {"codigo":"bl2","nombre":"Bloque 2 fuera de la forja","puntos":10},
   {"codigo":"bl3","nombre":"Bloque 3 fuera de la forja","puntos":10}
 ]'::jsonb,
 6, 'UNEARTHED 2025-2026'),

-- -------------------- M07 -------------------------------------------
('M07', 'Levantamiento de cargas pesadas',
 'La piedra de molino ya no toca su base.',
 30,
 '[]'::jsonb,
 7, 'UNEARTHED 2025-2026'),

-- -------------------- M08 -------------------------------------------
('M08', 'Silo',
 'Extraer las piezas preservadas del silo (10 c/u).',
 0,
 '[
   {"codigo":"p1","nombre":"Pieza 1 fuera del silo","puntos":10},
   {"codigo":"p2","nombre":"Pieza 2 fuera del silo","puntos":10},
   {"codigo":"p3","nombre":"Pieza 3 fuera del silo","puntos":10}
 ]'::jsonb,
 8, 'UNEARTHED 2025-2026'),

-- -------------------- M09 -------------------------------------------
('M09', '¿Qué hay a la venta?',
 'Restaurar el puesto del mercado.',
 20,
 '[
   {"codigo":"art","nombre":"Artículos del mercado completamente levantados","puntos":10}
 ]'::jsonb,
 9, 'UNEARTHED 2025-2026'),

-- -------------------- M10 -------------------------------------------
('M10', 'Artefactos para pesca',
 'Los artefactos se elevan por encima del cúmulo de tierra.',
 20,
 '[
   {"codigo":"b1","nombre":"Bono: banderín azul al menos parcialmente hacia abajo","puntos":10}
 ]'::jsonb,
 10, 'UNEARTHED 2025-2026'),

-- -------------------- M11 -------------------------------------------
('M11', 'Inclinación de balanza',
 'La balanza está inclinada hacia el otro lado y toca el tapete.',
 20,
 '[
   {"codigo":"plato","nombre":"Platillo con loop retirado completamente","puntos":10}
 ]'::jsonb,
 11, 'UNEARTHED 2025-2026'),

-- -------------------- M12 -------------------------------------------
('M12', 'Operación de salvamento',
 'La arena se ha removido completamente (palanca pasa la línea en el tapete).',
 20,
 '[
   {"codigo":"balsa","nombre":"Balsa levantada completamente","puntos":10}
 ]'::jsonb,
 12, 'UNEARTHED 2025-2026'),

-- -------------------- M13 -------------------------------------------
('M13', 'Reconstrucción de estatua',
 'La estatua está completamente levantada.',
 30,
 '[]'::jsonb,
 13, 'UNEARTHED 2025-2026'),

-- -------------------- M14 -------------------------------------------
('M14', 'Banderines de sitio',
 'Colocar banderines para marcar los sitios (10 c/u, banderín al menos parcialmente dentro y tocando el tapete).',
 0,
 '[
   {"codigo":"b1","nombre":"Banderín en sitio 1","puntos":10},
   {"codigo":"b2","nombre":"Banderín en sitio 2","puntos":10},
   {"codigo":"b3","nombre":"Banderín en sitio 3","puntos":10},
   {"codigo":"b4","nombre":"Banderín en sitio 4","puntos":10},
   {"codigo":"b5","nombre":"Banderín en sitio 5","puntos":10},
   {"codigo":"b6","nombre":"Banderín en sitio 6","puntos":10}
 ]'::jsonb,
 14, 'UNEARTHED 2025-2026'),

-- -------------------- M15 -------------------------------------------
('M15', 'Foro',
 'Artefactos al menos parcialmente en el foro y tocando el tapete (5 c/u por cada tipo de artefacto entregado).',
 0,
 '[
   {"codigo":"cep","nombre":"Cepillo en el foro","puntos":5},
   {"codigo":"cap","nombre":"Capa superficial de suelo en el foro","puntos":5},
   {"codigo":"val","nombre":"Artefacto valioso en el foro","puntos":5},
   {"codigo":"car","nombre":"Carro de mina del equipo oponente en el foro","puntos":5},
   {"codigo":"min","nombre":"Mineral con artefacto fosilizado en el foro","puntos":5},
   {"codigo":"mol","nombre":"Piedra de molino en el foro","puntos":5},
   {"codigo":"pla","nombre":"Platillo de balanza en el foro","puntos":5}
 ]'::jsonb,
 15, 'UNEARTHED 2025-2026'),

-- -------------------- M16 - Fichas de precisión ---------------------
-- Especial: se registra al final de la partida la cantidad restante
-- de fichas (de 1 a 6). Elige UN solo bonus.
('M16', 'Fichas de precisión',
 'Fichas restantes al final de la partida (seleccionar UNA opción según la cantidad que quede).',
 0,
 '[
   {"codigo":"f6","nombre":"6 fichas restantes","puntos":50},
   {"codigo":"f5","nombre":"5 fichas restantes","puntos":50},
   {"codigo":"f4","nombre":"4 fichas restantes","puntos":35},
   {"codigo":"f3","nombre":"3 fichas restantes","puntos":25},
   {"codigo":"f2","nombre":"2 fichas restantes","puntos":15},
   {"codigo":"f1","nombre":"1 ficha restante","puntos":10}
 ]'::jsonb,
 16, 'UNEARTHED 2025-2026');
