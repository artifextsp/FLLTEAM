-- =====================================================================
--  Seed de Misiones - Temporada UNEARTHED 2025-2026
-- ---------------------------------------------------------------------
--  IMPORTANTE: verifica los nombres y puntajes contra el rulebook oficial
--  de tu región antes de competir. Los nombres y puntajes aquí se basan
--  en la información pública de la temporada y pueden requerir ajustes.
--
--  Puedes editar esta lista en cualquier momento desde el panel SQL de
--  Supabase sin tocar el código del frontend.
-- =====================================================================

-- Limpieza opcional (descomenta si quieres resembrar desde cero):
-- delete from public.misiones where temporada = 'UNEARTHED 2025-2026';

insert into public.misiones (codigo, nombre_es, descripcion, puntos_base, bonus, orden, temporada)
values
    ('M00', 'Inspección del Equipo',
     'El robot inicia y sale del área de base con sus piezas listas.',
     0,
     '[]'::jsonb,
     0, 'UNEARTHED 2025-2026'),

    ('M01', 'Cepillado de Superficie',
     'Limpiar y revelar la superficie del yacimiento.',
     20,
     '[{"codigo":"b1","nombre":"Totalmente cepillado","puntos":10}]'::jsonb,
     1, 'UNEARTHED 2025-2026'),

    ('M02', 'Recuperación Cuidadosa',
     'Extraer el artefacto frágil sin dañarlo.',
     30,
     '[{"codigo":"b1","nombre":"Artefacto intacto","puntos":10}]'::jsonb,
     2, 'UNEARTHED 2025-2026'),

    ('M03', '¿Quién Vivió Aquí?',
     'Colocar el marcador de cultura correcto sobre la pieza.',
     20,
     '[]'::jsonb,
     3, 'UNEARTHED 2025-2026'),

    ('M04', 'La Forja',
     'Encender la forja moviendo la palanca al extremo.',
     25,
     '[{"codigo":"b1","nombre":"Horno encendido","puntos":10}]'::jsonb,
     4, 'UNEARTHED 2025-2026'),

    ('M05', 'Operación de Salvamento',
     'Rescatar al menos un objeto del barco hundido.',
     15,
     '[{"codigo":"b1","nombre":"Más de un objeto rescatado","puntos":10},
       {"codigo":"b2","nombre":"Todos los objetos rescatados","puntos":20}]'::jsonb,
     5, 'UNEARTHED 2025-2026'),

    ('M06', 'Reconstrucción de Estatua',
     'Reensamblar las piezas de la estatua.',
     30,
     '[{"codigo":"b1","nombre":"Estatua completa","puntos":15}]'::jsonb,
     6, 'UNEARTHED 2025-2026'),

    ('M07', 'El Foro',
     'Levantar las columnas del foro romano.',
     20,
     '[{"codigo":"b1","nombre":"Todas las columnas en pie","puntos":10}]'::jsonb,
     7, 'UNEARTHED 2025-2026'),

    ('M08', '¿Qué Está en Venta?',
     'Girar el marcador del mercado para revelar la mercancía.',
     15,
     '[]'::jsonb,
     8, 'UNEARTHED 2025-2026'),

    ('M09', 'Panel Solar',
     'Activar el panel solar elevándolo por completo.',
     20,
     '[]'::jsonb,
     9, 'UNEARTHED 2025-2026'),

    ('M10', 'Pez Linterna',
     'Mover al pez linterna hasta la zona iluminada.',
     20,
     '[]'::jsonb,
     10, 'UNEARTHED 2025-2026'),

    ('M11', 'Mapeo del Sitio',
     'Dejar marcadores en cada zona de excavación.',
     10,
     '[{"codigo":"b1","nombre":"Por cada marcador colocado","puntos":5}]'::jsonb,
     11, 'UNEARTHED 2025-2026'),

    ('M12', 'Descifrando el Código',
     'Alinear los símbolos de la tablilla antigua.',
     25,
     '[{"codigo":"b1","nombre":"Código completamente descifrado","puntos":15}]'::jsonb,
     12, 'UNEARTHED 2025-2026'),

    ('M13', 'Museo',
     'Entregar artefactos al museo.',
     10,
     '[{"codigo":"b1","nombre":"Por cada artefacto entregado","puntos":5},
       {"codigo":"b2","nombre":"Artefacto de valor especial","puntos":15}]'::jsonb,
     13, 'UNEARTHED 2025-2026'),

    ('M14', 'Protección del Patrimonio',
     'Colocar la cubierta protectora sobre el hallazgo.',
     20,
     '[]'::jsonb,
     14, 'UNEARTHED 2025-2026'),

    ('M15', 'Precisión',
     'Conservar los tokens de precisión al final del partido.',
     50,
     '[{"codigo":"p6","nombre":"6 tokens restantes","puntos":60},
       {"codigo":"p5","nombre":"5 tokens restantes","puntos":45},
       {"codigo":"p4","nombre":"4 tokens restantes","puntos":30},
       {"codigo":"p3","nombre":"3 tokens restantes","puntos":20},
       {"codigo":"p2","nombre":"2 tokens restantes","puntos":10},
       {"codigo":"p1","nombre":"1 token restante","puntos":5}]'::jsonb,
     99, 'UNEARTHED 2025-2026')
on conflict (codigo) do update
    set nombre_es    = excluded.nombre_es,
        descripcion  = excluded.descripcion,
        puntos_base  = excluded.puntos_base,
        bonus        = excluded.bonus,
        orden        = excluded.orden,
        temporada    = excluded.temporada,
        activo       = true;
