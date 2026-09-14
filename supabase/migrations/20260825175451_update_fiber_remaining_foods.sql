-- Atualizar fibra dos alimentos restantes que naturalmente contêm fibra
-- Açúcares: rapadura e quindim têm traços de fibra
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%rapadura%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%quindim%' AND fiber_g = 0;

-- Carnes processadas (salsicha, hambúrguer, etc já foram atualizadas, mas algumas podem ter ficado)
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%salsicha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%linguiça%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%mortadela%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%salame%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%presunto%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%bacon%' AND fiber_g = 0;

-- Peixes: peixe puro = 0 fibra (correto), mas alguns preparados podem ter
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%peixe frito%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%sushi%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%temaki%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%nugget%' AND fiber_g = 0;

-- Ovos e Laticínios: ovos puros = 0, mas preparados com vegetais podem ter
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%omelete%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%quesadilha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%lasanha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%pizza%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%crepe%' AND fiber_g = 0;

-- Bebidas: algumas têm fibra
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%caldo de cana%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%café com leite%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.2 WHERE name ILIKE '%achocolatado%' AND fiber_g = 0 AND category = 'Bebidas';
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%smoothie%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%vitamina%' AND fiber_g = 0 AND category = 'Bebidas';

-- Condimentos: alguns têm fibra
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%geleia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%molho de tomate%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%ketchup%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%mostarda%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%pesto%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%molho branco%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%molho rose%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%molho bolonhesa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%maionese%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%guacamole%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%hummus%' AND fiber_g = 0;

-- Suplementos: alguns têm fibra (massa gainer, barras)
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%massa gainer%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%mass%' AND fiber_g = 0 AND category = 'Suplementos';
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%gainer%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%barra protein%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%barra de cereal%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%bcaa%' AND fiber_g = 0 AND name ILIKE '%barra%';
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%pre workout%' AND fiber_g = 0 AND name NOT ILIKE '%pó%' AND name NOT ILIKE '%powder%';
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%l-carnitina%' AND fiber_g = 0 AND name ILIKE '%barra%';
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%psyllium%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%colágeno%' AND fiber_g = 0 AND name ILIKE '%barra%';

-- Preparações restantes
UPDATE foods SET fiber_g = 0.2 WHERE name ILIKE '%gelatina%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.0 WHERE name ILIKE '%pirulito%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%salsicha de viena%' AND fiber_g = 0;
