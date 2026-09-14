/*
# Remove synthetic "Atacadão Comparou Compensou" brand duplicates

## Context
A previous migration inserted ~140 food items under a synthetic brand "Atacadão Comparou Compensou".
Atacadao.com.br is a grocery retailer, not a food brand — their website requires CEP/store selection
and does not expose a public product catalog. The synthetic brand duplicated many items that already
existed under their generic names (e.g. "Feijão Carioca 1kg", "Arroz Branco Polido 5kg").

## Changes
1. Deletes all rows from `foods` where `brand = 'Atacadão Comparou Compensou'` AND a matching
   generic entry (same name) exists with a different brand or NULL brand.
2. For items that exist ONLY under the synthetic brand (no generic counterpart), clears the brand
   to NULL so they remain in the catalog as unbranded generic items.
3. Adds new non-duplicate food items with brand = NULL across existing categories.
4. Seeds community_recipes with 6 ready-made recipes including photos.

## Safety
- No schema changes, no table drops, no column changes.
- Only removes duplicate data rows; unique items are preserved (brand cleared).
*/

-- Step 1: Delete synthetic-brand rows where a generic counterpart exists
DELETE FROM public.foods
WHERE brand = 'Atacadão Comparou Compensou'
  AND name IN (
    SELECT name FROM public.foods
    WHERE (brand IS NULL OR brand != 'Atacadão Comparou Compensou')
  );

-- Step 2: Clear brand for remaining synthetic-brand items (keep them as generic)
UPDATE public.foods
SET brand = NULL
WHERE brand = 'Atacadão Comparou Compensou';

-- Step 3: Add new non-duplicate food items (brand NULL)
-- Using ON CONFLICT DO NOTHING on a unique (name, category) would be ideal,
-- but foods table has no unique constraint on (name, category), so we use
-- a NOT EXISTS check to avoid duplicates.
INSERT INTO public.foods (name, category, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g)
SELECT * FROM (VALUES
  -- New items not already in catalog
  ('Café em Grãos Arábica', 'Bebidas', NULL::text, '10g (infusão)', 2, 0.2, 0.3, 0, 0),
  ('Chá Verde em Sachê', 'Bebidas', NULL::text, '200ml (infusão)', 2, 0, 0.5, 0, 0),
  ('Chá de Camomila', 'Bebidas', NULL::text, '200ml (infusão)', 1, 0, 0.3, 0, 0),
  ('Chá de Hortelã', 'Bebidas', NULL::text, '200ml (infusão)', 1, 0, 0.3, 0, 0),
  ('Leite de Amêndoas', 'Bebidas', NULL::text, '200ml', 50, 1, 2, 1.5, 0.5),
  ('Leite de Coco', 'Bebidas', NULL::text, '100ml', 165, 1.7, 6, 15, 0.9),
  ('Iogurte Grego Natural', 'Ovos e Laticínios', NULL::text, '170g', 130, 15, 6, 5, 0),
  ('Iogurte Grego com Mel', 'Ovos e Laticínios', NULL::text, '170g', 160, 13, 16, 4, 0),
  ('Requeijão Light', 'Ovos e Laticínios', NULL::text, '30g', 45, 2, 2, 3, 0),
  ('Queijo Cottage', 'Ovos e Laticínios', NULL::text, '100g', 98, 11, 3, 4, 0),
  ('Queijo Parmesão Ralado', 'Ovos e Laticínios', NULL::text, '30g', 129, 12, 1, 9, 0),
  ('Queijo Brie', 'Ovos e Laticínios', NULL::text, '30g', 95, 6, 0.2, 8, 0),
  ('Cream Cheese', 'Ovos e Laticínios', NULL::text, '30g', 100, 2, 1, 9, 0),
  ('Leite Sem Lactose 1L', 'Ovos e Laticínios', NULL::text, '200ml', 120, 6, 10, 6, 0),
  ('Ovo de Codorna (unidade)', 'Ovos e Laticínios', NULL::text, '1 unid', 15, 1.3, 0.1, 1, 0),
  ('Clara de Ovo Pasteurizada', 'Ovos e Laticínios', NULL::text, '100ml', 48, 11, 0.7, 0.1, 0),
  ('Patinho Moído Bovino', 'Carnes', NULL::text, '100g', 180, 24, 0, 8, 0),
  ('Carne Moída Bovina', 'Carnes', NULL::text, '100g', 200, 20, 0, 13, 0),
  ('Frango Desfiado', 'Carnes', NULL::text, '100g', 150, 30, 0, 3, 0),
  ('Filé de Salmão', 'Peixes', NULL::text, '100g', 208, 20, 0, 13, 0),
  ('Filé de Pintado', 'Peixes', NULL::text, '100g', 105, 22, 0, 2, 0),
  ('Filé de Pangasius', 'Peixes', NULL::text, '100g', 90, 17, 0, 2, 0),
  ('Atum Fresco em Posta', 'Peixes', NULL::text, '100g', 144, 23, 0, 5, 0),
  ('Salmão Defumado', 'Peixes', NULL::text, '100g', 117, 18, 0, 4, 0),
  ('Sardinha Fresca', 'Peixes', NULL::text, '100g', 208, 25, 0, 12, 0),
  ('Polvo Cozido', 'Peixes', NULL::text, '100g', 82, 15, 2, 1, 0),
  ('Camão Cozido', 'Peixes', NULL::text, '100g', 99, 21, 0.2, 1, 0),
  ('Quinoa em Grãos', 'Grãos e Cereais', NULL::text, '100g (cozida)', 120, 4.4, 21, 1.9, 2.8),
  ('Amaranto em Grãos', 'Grãos e Cereais', NULL::text, '100g (cozido)', 102, 3.8, 19, 1.6, 2.1),
  ('Linhaça Dourada', 'Grãos e Cereais', NULL::text, '100g', 534, 18, 29, 42, 27),
  ('Linhaça Marrom', 'Grãos e Cereais', NULL::text, '100g', 534, 18, 29, 42, 27),
  ('Chia em Sementes', 'Grãos e Cereais', NULL::text, '100g', 486, 17, 42, 31, 34),
  ('Flocos de Arroz', 'Grãos e Cereais', NULL::text, '100g', 362, 7, 80, 1, 1),
  ('Flocos de Milho', 'Grãos e Cereais', NULL::text, '100g', 357, 6, 82, 1, 2),
  ('Goma de Tapioca', 'Grãos e Cereais', NULL::text, '100g', 358, 0.5, 88, 0, 0.5),
  ('Massa de Lasanha', 'Grãos e Cereais', NULL::text, '100g', 158, 5, 31, 1, 1.5),
  ('Massa Integral Penne', 'Grãos e Cereais', NULL::text, '100g', 145, 6, 29, 1, 4),
  ('Cuscuz Marroquino', 'Grãos e Cereais', NULL::text, '100g (cozido)', 112, 3.8, 23, 0.2, 1.4),
  ('Trigo em Grãos', 'Grãos e Cereais', NULL::text, '100g (cozido)', 130, 5, 28, 1, 3),
  ('Farinha de Aveia', 'Grãos e Cereais', NULL::text, '100g', 389, 13, 66, 7, 10),
  ('Farinha de Amêndoas', 'Grãos e Cereais', NULL::text, '100g', 575, 21, 20, 49, 11),
  ('Farinha de Coco', 'Grãos e Cereais', NULL::text, '100g', 660, 19, 26, 64, 36),
  ('Coco Ralado', 'Grãos e Cereais', NULL::text, '100g', 660, 7, 25, 65, 16),
  ('Polvilho Doce', 'Grãos e Cereais', NULL::text, '100g', 381, 0.2, 94, 0, 0.1),
  ('Polvilho Azedo', 'Grãos e Cereais', NULL::text, '100g', 381, 0.2, 94, 0, 0.1),
  ('Aveia em Pó (Aveia Instantânea)', 'Grãos e Cereais', NULL::text, '100g', 379, 13, 67, 7, 10),
  ('Abacate', 'Frutas', NULL::text, '100g', 160, 2, 9, 15, 7),
  ('Papaya (Mamão Papaya)', 'Frutas', NULL::text, '100g', 43, 0.5, 11, 0.3, 1.7),
  ('Fruta do Conde (Ata)', 'Frutas', NULL::text, '100g', 94, 1.6, 24, 0.4, 3),
  ('Jaca', 'Frutas', NULL::text, '100g', 95, 1.7, 23, 0.6, 1.5),
  ('Lichia', 'Frutas', NULL::text, '100g', 66, 0.8, 17, 0.4, 1.3),
  ('Caju', 'Frutas', NULL::text, '100g', 55, 1.7, 13, 0.5, 1.1),
  ('Açaí Polpa', 'Frutas', NULL::text, '100g', 70, 1.2, 16, 0.2, 2.6),
  ('Cupuaçu Polpa', 'Frutas', NULL::text, '100g', 65, 1, 16, 0.5, 2),
  ('Graviola', 'Frutas', NULL::text, '100g', 66, 1, 17, 0.3, 3.2),
  ('Figo', 'Frutas', NULL::text, '100g', 74, 1.3, 19, 0.3, 2.9),
  ('Ameixa Fresca', 'Frutas', NULL::text, '100g', 46, 0.7, 11, 0.3, 1.4),
  ('Ameixa Seca', 'Frutas', NULL::text, '100g', 240, 2.2, 63, 0.4, 7),
  ('Caqui', 'Frutas', NULL::text, '100g', 70, 0.6, 19, 0.2, 3.6),
  ('Carambola', 'Frutas', NULL::text, '100g', 31, 1, 7, 0.3, 2.8),
  ('Pitanga', 'Frutas', NULL::text, '100g', 43, 1.2, 10, 0.4, 3.5),
  ('Tamarindo', 'Frutas', NULL::text, '100g', 239, 2.8, 63, 0.6, 5.1),
  ('Banana Maçã', 'Frutas', NULL::text, '100g', 89, 1.1, 23, 0.3, 2.6),
  ('Banana Ouro', 'Frutas', NULL::text, '100g', 89, 1.1, 23, 0.3, 2.6),
  ('Tomate Cereja', 'Verduras e Legumes', NULL::text, '100g', 18, 0.9, 3.9, 0.2, 1.2),
  ('Rúcula', 'Verduras e Legumes', NULL::text, '100g', 25, 2.6, 3.7, 0.7, 1.6),
  ('Agrião', 'Verduras e Legumes', NULL::text, '100g', 11, 0.8, 1.3, 0.1, 0.5),
  ('Aipo (Salsão)', 'Verduras e Legumes', NULL::text, '100g', 16, 0.7, 3, 0.2, 1.6),
  ('Funcho (Erva-Doce)', 'Verduras e Legumes', NULL::text, '100g', 31, 1.2, 7, 0.2, 3.1),
  ('Alho-Poró', 'Verduras e Legumes', NULL::text, '100g', 61, 1.5, 14, 0.3, 1.8),
  ('Pupunha (Palmito)', 'Verduras e Legumes', NULL::text, '100g', 36, 1.8, 8, 0.2, 2.5),
  ('Beterraba Ralada', 'Verduras e Legumes', NULL::text, '100g', 43, 1.6, 10, 0.2, 2.8),
  ('Abóbora Cabotiá', 'Verduras e Legumes', NULL::text, '100g', 40, 1, 10, 0.1, 2),
  ('Abóbora Moranga', 'Verduras e Legumes', NULL::text, '100g', 34, 1, 8, 0.1, 1.5),
  ('Berinjela Italiana', 'Verduras e Legumes', NULL::text, '100g', 25, 1, 6, 0.2, 2.5),
  ('Vagem', 'Verduras e Legumes', NULL::text, '100g', 31, 2, 7, 0.2, 2.7),
  ('Ervilha Fresca', 'Verduras e Legumes', NULL::text, '100g', 81, 5.4, 14, 0.4, 5.1),
  ('Milho Verde em Espiga', 'Verduras e Legumes', NULL::text, '100g', 86, 3.2, 19, 1.2, 2),
  ('Brócolis Ninja', 'Verduras e Legumes', NULL::text, '100g', 34, 2.8, 7, 0.4, 2.6),
  ('Couve-Flor', 'Verduras e Legumes', NULL::text, '100g', 25, 1.9, 5, 0.3, 2),
  ('Mostarda (Folha)', 'Verduras e Legumes', NULL::text, '100g', 27, 2.9, 4.7, 0.4, 3.3),
  ('Rabanete', 'Verduras e Legumes', NULL::text, '100g', 16, 0.7, 3.4, 0.1, 1.6),
  ('Nabo', 'Verduras e Legumes', NULL::text, '100g', 28, 0.9, 6, 0.1, 1.8),
  ('Cogumelo Paris', 'Verduras e Legumes', NULL::text, '100g', 22, 3.1, 3.3, 0.3, 1),
  ('Cogumelo Shimeji', 'Verduras e Legumes', NULL::text, '100g', 34, 2.8, 5, 0.5, 2.6),
  ('Azeitona Verde', 'Verduras e Legumes', NULL::text, '100g', 115, 0.8, 1, 11, 1.6),
  ('Azeitona Preta', 'Verduras e Legumes', NULL::text, '100g', 116, 0.9, 6, 11, 1.6),
  ('Macadâmia', 'Oleaginosas', NULL::text, '100g', 718, 8, 14, 76, 8.6),
  ('Pistache', 'Oleaginosas', NULL::text, '100g', 562, 20, 28, 45, 10),
  ('Castanha de Baru', 'Oleaginosas', NULL::text, '100g', 538, 24, 18, 42, 11),
  ('Lupino', 'Oleaginosas', NULL::text, '100g', 371, 36, 39, 10, 30),
  ('Pasta de Amendoim Cremosa', 'Oleaginosas', NULL::text, '100g', 588, 25, 20, 50, 6),
  ('Pasta de Amendoim Integral', 'Oleaginosas', NULL::text, '100g', 588, 25, 20, 50, 6),
  ('Tahine (Pasta de Gergelim)', 'Oleaginosas', NULL::text, '100g', 595, 17, 21, 54, 9.3),
  ('Gergelim', 'Oleaginosas', NULL::text, '100g', 573, 18, 23, 50, 11.8),
  ('Gergelim Negro', 'Oleaginosas', NULL::text, '100g', 560, 18, 11, 48, 11),
  ('Cacau em Pó 100%', 'Açúcares', NULL::text, '100g', 349, 11, 52, 15, 33),
  ('Cacau em Pó Solúvel', 'Açúcares', NULL::text, '20g', 80, 1.5, 16, 1.5, 0.5),
  ('Tâmaras Secas', 'Açúcares', NULL::text, '100g', 277, 1.8, 75, 0.2, 7),
  ('Erva-Mate Chimarrão', 'Bebidas', NULL::text, '200ml (infusão)', 3, 0, 0.5, 0, 0),
  ('Café Espresso', 'Bebidas', NULL::text, '50ml', 5, 0.3, 0.7, 0, 0),
  ('Leite Fermentado', 'Bebidas', NULL::text, '100ml', 62, 3, 10, 1.5, 0),
  ('Kombucha', 'Bebidas', NULL::text, '200ml', 30, 0, 7, 0, 0),
  ('Suco de Beterraba', 'Bebidas', NULL::text, '200ml', 70, 2, 17, 0.2, 1.5),
  ('Suco Verde Detox', 'Bebidas', NULL::text, '200ml', 80, 2, 18, 0.3, 2),
  ('Suco de Açaí', 'Bebidas', NULL::text, '200ml', 130, 2.5, 30, 0.5, 5),
  ('Água de Coco', 'Bebidas', NULL::text, '200ml', 38, 0.7, 9, 0.2, 1.1),
  ('Pimenta Caiena', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.5, 0, 0.2),
  ('Páprica Doce', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.6, 0.1, 0.3),
  ('Páprica Defumada', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.6, 0.1, 0.3),
  ('Cominho em Pó', 'Condimentos', NULL::text, '1g', 8, 0.4, 1, 0.5, 0.1),
  ('Cúrcuma (Açafrão da Terra)', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.7, 0, 0.2),
  ('Gengibre em Pó', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.7, 0, 0.2),
  ('Gengibre Fresco', 'Condimentos', NULL::text, '100g', 80, 1.8, 18, 0.8, 2),
  ('Canela em Pó', 'Condimentos', NULL::text, '1g', 2, 0, 0.6, 0, 0.4),
  ('Cravo da Índia', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.6, 0.1, 0.3),
  ('Noz-Moscada', 'Condimentos', NULL::text, '1g', 3, 0, 0.6, 0.1, 0.3),
  ('Salsinha Fresca', 'Condimentos', NULL::text, '100g', 36, 3, 6, 1, 3.7),
  ('Coentro Fresco', 'Condimentos', NULL::text, '100g', 23, 2.1, 3.7, 0.5, 2.8),
  ('Manjericão Fresco', 'Condimentos', NULL::text, '100g', 23, 3.2, 2.7, 0.6, 1.6),
  ('Hortelã Fresca', 'Condimentos', NULL::text, '100g', 70, 3.8, 15, 1, 8),
  ('Alecrim Fresco', 'Condimentos', NULL::text, '100g', 131, 3.3, 21, 5.9, 14),
  ('Tomilho Fresco', 'Condimentos', NULL::text, '100g', 101, 5.6, 24, 1.7, 14),
  ('Louro (Folha Seca)', 'Condimentos', NULL::text, '1g', 3, 0.1, 0.7, 0.1, 0.3),
  ('Molho Pesto', 'Condimentos', NULL::text, '100g', 288, 6, 5, 27, 2.4),
  ('Molho Branco', 'Condimentos', NULL::text, '100g', 180, 5, 12, 12, 0.3),
  ('Molho de Pimenta', 'Condimentos', NULL::text, '15ml', 5, 0.2, 1, 0.1, 0.2),
  ('Molho Rosé', 'Condimentos', NULL::text, '100g', 320, 3, 8, 32, 0.3),
  ('Açafrão da Terra Fresco', 'Condimentos', NULL::text, '100g', 354, 8, 65, 10, 21),
  ('Gengibre em Conserva', 'Condimentos', NULL::text, '100g', 51, 1, 12, 0.3, 2)
) AS v(name, category, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g)
WHERE NOT EXISTS (
  SELECT 1 FROM public.foods f WHERE f.name = v.name AND f.category = v.category
);

-- Step 4: Seed community recipes with photos
INSERT INTO public.community_recipes (user_id, title, description, ingredients, instructions, prep_time_min, servings, calories, protein_g, carbs_g, fat_g, image_url)
SELECT * FROM (VALUES
  ('ab1a8120-1847-4a55-a129-f22f75a60545'::uuid, 'Bowl Fit de Frango com Arroz', 'Marmita fit prática com frango grelhado, arroz integral e feijão — perfeita para o dia a dia.', '200g filé de peito de frango
100g arroz integral cozido
50g feijão carioca cozido
1 colher de sopa de azeite
Sal, alho e temperos a gosto', '1. Tempere o frango com alho, sal e azeite.
2. Grelhe em frigideira quente por 4 minutos de cada lado.
3. Sirva com o arroz e feijão já cozidos.
4. Monte a marmita e leve para o dia.', 20, 1, 480, 42, 55, 12, 'https://images.pexels.com/photos/30635705/pexels-photo-30635705.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('ab1a8120-1847-4a55-a129-f22f75a60545'::uuid, 'Overnight Oats com Frutas Vermelhas', 'Aveia em flocos hidratada no leite com frutas vermelhas e chia — um café da manhã pronto desde a noite anterior.', '40g aveia em flocos
150ml leite desnatado
1 colher de sopa de chia
50g frutas vermelhas congeladas
1 colher de chá de mel', '1. Misture a aveia, o leite e a chia em um pote.
2. Adicione o mel e mexa bem.
3. Cubra e leve à geladeira por no mínimo 6 horas.
4. Antes de servir, coloque as frutas vermelhas por cima.', 5, 1, 280, 10, 48, 5, 'https://images.pexels.com/photos/27850091/pexels-photo-27850091.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('939921e1-14f9-440c-8fb5-c57654035643'::uuid, 'Salada de Grão de Bico Colorida', 'Salada rica em proteína vegetal com grão de bico, cenoura, pimentão e temperos frescos.', '200g grão de bico cozido
1 cenoura média ralada
1/2 pimentão vermelho em cubos
1/2 cebola roxa picada
Salsinha, azeite, limão e sal a gosto', '1. Em uma tigela, misture o grão de bico cozido com a cenoura, o pimentão e a cebola.
2. Tempere com azeite, suco de limão, sal e salsinha.
3. Mexa bem e sirva gelada.', 15, 2, 320, 14, 45, 8, 'https://images.pexels.com/photos/23384627/pexels-photo-23384627.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('939921e1-14f9-440c-8fb5-c57654035643'::uuid, 'Feijoada Fitness Leve', 'Versão mais leve da feijoada tradicional, com menos carne gordurosa e mais legumes.', '300g feijão preto cozido
100g carne magra em cubos
1 linguiça calabresa light em rodelas
1 cebola, 2 dentes de alho
1 folha de louro, sal e pimenta a gosto', '1. Refogue a cebola e o alho em panela de pressão.
2. Adicione a carne e a linguiça e doure levemente.
3. Junte o feijão cozido, o louro e água.
4. Cozinhe por 20 minutos em pressão.
5. Ajuste o sal e sirva com couve refogada.', 45, 4, 380, 22, 35, 14, 'https://images.pexels.com/photos/34195321/pexels-photo-34195321.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('a4dd56a0-1cc3-4415-9cde-432d40041791'::uuid, 'Omelete Proteico de Forno', 'Omelete recheado com queijo, tomate e espinafre — rico em proteína e ideal para o pós-treino.', '3 ovos inteiros
2 claras
30g queijo mussarela ralado
1/2 tomate em cubos
1 punhado de espinafre fresco
Sal, pimenta e orégano a gosto', '1. Bata os ovos e as claras com sal e pimenta.
2. Despeje em assunteira untada.
3. Adicione o tomate, o espinafre e o queijo por cima.
4. Asse em forno 180°C por 15 minutos.
5. Polvilhe orégano e sirva.', 20, 1, 320, 28, 6, 18, 'https://images.pexels.com/photos/1437268/pexels-photo-1437268.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('a4dd56a0-1cc3-4415-9cde-432d40041791'::uuid, 'Smoothie Bowl de Banana com Granola', 'Tigela de smoothie cremoso de banana com granola e chia — docinho natural e cheio de fibras.', '2 bananas congeladas
100ml leite de amêndoas
1 colher de sopa de chia
30g granola
1 colher de chá de mel
Meio morango para decorar', '1. Bata no liquidificador as bananas com o leite até virar um creme grosso.
2. Despeje em uma tigela.
3. Cubra com a granola, a chia e o mel.
4. Decore com o morango e sirva imediatamente.', 5, 1, 310, 7, 60, 6, 'https://images.pexels.com/photos/34227829/pexels-photo-34227829.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('ab1a8120-1847-4a55-a129-f22f75a60545'::uuid, 'Frango Assado com Batata Doce', 'Frango temperado no forno servido com batata doce assada — refeição completa e nutritiva.', '250g coxa de frango sem pele
200g batata doce em cubos
1 colher de sopa de azeite
1 colher de chá de páprica doce
Sal, alho e alecrim a gosto', '1. Tempere o frango com alho, sal, páprica e alecrim.
2. Coloque a batata doce em cubos em assunteira com azeite.
3. Disponha o frango sobre a batata.
4. Asse em forno 200°C por 35 minutos.', 40, 1, 450, 35, 40, 14, 'https://images.pexels.com/photos/9213962/pexels-photo-9213962.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('939921e1-14f9-440c-8fb5-c57654035643'::uuid, 'Salada de Atum com Folhas', 'Salada leve e proteica com atum, alface, tomate e cenoura — pronta em 10 minutos.', '1 lata de atum em água (120g escorrido)
2 folhas de alface americana
1 tomate em rodelas
1/2 cenoura ralada
1 colher de chá de azeite
Suco de meio limão
Sal e pimenta a gosto', '1. Escorra o atum e coloque em uma tigela.
2. Adicione a alface, o tomate e a cenoura.
3. Tempere com azeite, limão, sal e pimenta.
4. Mexa delicadamente e sirva.', 10, 1, 220, 28, 8, 7, 'https://images.pexels.com/photos/19572488/pexels-photo-19572488.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('a4dd56a0-1cc3-4415-9cde-432d40041791'::uuid, 'Pancakes Proteicos de Aveia e Banana', 'Panquecas fofinhas com aveia, banana e ovos — perfeitas para um café da manhã pós-treino.', '1 banana madura
2 ovos
40g aveia em flocos
1 colher de chá de canela
1 colher de chá de mel
Óleo de coco para untar', '1. Amasse a banana com um garfo.
2. Misture os ovos, a aveia e a canela.
3. Aqueça uma frigideira untada.
4. Coloque porções da massa e doure dos dois lados.
5. Sirva com o mel por cima.', 15, 1, 340, 16, 52, 8, 'https://images.pexels.com/photos/38370352/pexels-photo-38370352.jpeg?auto=compress&cs=tinysrgb&h=650&w=940')
) AS v(user_id, title, description, ingredients, instructions, prep_time_min, servings, calories, protein_g, carbs_g, fat_g, image_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_recipes r WHERE r.title = v.title
);
