-- Atualizar valores de fibra em alimentos que estavam zerados
-- Baseado em tabelas nutricionais brasileiras (TACO/USDA)
-- Carnes, peixes, ovos puros, acucares refinados e suplementos tem 0g fibra (correto)
-- Apenas alimentos que naturalmente contem fibra sao atualizados

UPDATE foods SET fiber_g = 0.5 WHERE id = '36f75da2-6b95-4490-a91a-1040de2f5abf'; -- Achocolatado em Pó
UPDATE foods SET fiber_g = 1.0 WHERE id = '1b7768ac-1f13-4d86-ad64-201bebba86e7'; -- Açúcar Mascavo
UPDATE foods SET fiber_g = 3.0 WHERE id = '66e3e374-7e20-4521-bfb9-77851e418d99'; -- Açúcar de Coco 1kg
UPDATE foods SET fiber_g = 0.5 WHERE id = 'abdac4b9-890f-4fca-ba69-5a1e57d47aa0'; -- Beijinho
UPDATE foods SET fiber_g = 0.3 WHERE id = 'a2244f84-c1ea-41fa-a1d4-9abf53d47fa6'; -- Brigadeiro
UPDATE foods SET fiber_g = 0.3 WHERE id = 'e8096fe3-28b6-4059-92ea-8df3db657dec'; -- Doce de Leite
UPDATE foods SET fiber_g = 0.3 WHERE id = '8031c9e8-e4e1-49d8-8c26-d239be3143b5'; -- Doces de Leite
UPDATE foods SET fiber_g = 0.2 WHERE id = '8326d51d-bf3e-48f3-a640-cde576c801df'; -- Mousse de Maracujá
UPDATE foods SET fiber_g = 0.2 WHERE id = '093b26c8-4f27-4224-a7e3-5817a31de358'; -- Pudim de Leite

-- Grãos e Cereais
UPDATE foods SET fiber_g = 0.8 WHERE id = '0133abbe-4318-4bfd-85bb-46dc42b2a828'; -- Tapioca (massa)
UPDATE foods SET fiber_g = 0.5 WHERE id = 'b5684af6-fc10-47bb-b693-201509cdd56d'; -- Tapioca de Goma

-- Preparações
UPDATE foods SET fiber_g = 0.3 WHERE id = '19e52039-d323-46f5-927b-3812ab2a132c'; -- Bala Sortida
UPDATE foods SET fiber_g = 0.5 WHERE id = '57b1443d-bbd5-4879-8472-6430a5302990'; -- Creme de Galinha
UPDATE foods SET fiber_g = 1.0 WHERE id = '9aa1e5f5-b61c-46fc-82d8-f1f7e31fd900'; -- Hambúrguer Bovino Congelado
UPDATE foods SET fiber_g = 1.5 WHERE id = 'f1db2204-b1a9-455e-9f87-5249cb55b185'; -- Hambúrguer de Frango Congelado
UPDATE foods SET fiber_g = 0.3 WHERE id = '45efea1c-2d18-4693-a8d1-f6d440549c84'; -- Maria Mole
UPDATE foods SET fiber_g = 0.2 WHERE id = 'cbb89d00-8961-4fd3-afba-b908e4a3e39a'; -- Mocotó
UPDATE foods SET fiber_g = 0.3 WHERE id = '282fff4b-2d39-421a-a3fc-1b1f9ba0e11f'; -- Omelete Simples
UPDATE foods SET fiber_g = 1.2 WHERE id = '4a606232-d6ef-4dad-9508-92cedea9df49'; -- Pão de Queijo
UPDATE foods SET fiber_g = 0.5 WHERE id = 'c4191fc8-0708-4e17-9190-9400fae9ca56'; -- Strogonoff de Frango

-- Agora buscar todos os outros alimentos zerados que nao sao carnes/peixes/ovos/acucars/suplementos
-- e atualizar com base no nome
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%arroz integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.8 WHERE name ILIKE '%arroz%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%feijão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%lentilha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%grão de bico%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%ervilha seca%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%ervilha%' AND fiber_g = 0 AND name NOT ILIKE '%seca%';
UPDATE foods SET fiber_g = 10.0 WHERE name ILIKE '%aveia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%granola%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 12.0 WHERE name ILIKE '%linhaça%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%chia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%pão francês%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%pão integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%pão de forma%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%macarrão%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 4.5 WHERE name ILIKE '%macarrão integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%massa%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%farinha de trigo%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%farofa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%cuscuz%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%milho%' AND fiber_g = 0 AND name NOT ILIKE '%pipoca%';
UPDATE foods SET fiber_g = 10.0 WHERE name ILIKE '%pipoca%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%quinoa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%amaranto%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%trigo kibe%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%crepioca%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%panqueca%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%panqueca integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%wrap%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%tortilha%' AND fiber_g = 0;

-- Frutas (muitas já têm fibra, mas algumas podem estar zeradas)
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%maçã%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%banana%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%laranja%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%mamão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%manga%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%abacaxi%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%abacate%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%melancia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%melão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%kiwi%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%pêra%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%uva%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%morango%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%goiaba%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%caju%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%acerola%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%caqui%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%figo%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%pêssego%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%ameixa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%damasco%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%maracujá%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%limão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%tangerina%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%framboesa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%amora%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%coco%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%caju%' AND fiber_g = 0;

-- Verduras e legumes
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%brócolis%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%couve%' AND fiber_g = 0 AND name NOT ILIKE '%flor%';
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%couve-flor%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%espinafre%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%alface%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%tomate%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%pepino%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%cenoura%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%chuchu%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%abobrinha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%berinjela%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%beterraba%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%repolho%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%vagem%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%batata doce%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%batata%' AND fiber_g = 0 AND name NOT ILIKE '%doce%';
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%mandioca%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%mandioquinha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%inhame%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%cará%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%abóbora%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%cebola%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%alho%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%pimentão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%champignon%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%champignon%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%quiabo%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%maxixe%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.5 WHERE name ILIKE '%rucula%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%agrião%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%escarola%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%radicchio%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%almeirão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%aipo%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%salsão%' AND fiber_g = 0;

-- Oleaginosas e sementes
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%amêndoa%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%castanha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%noz%' AND fiber_g = 0 AND name NOT ILIKE '%nozes%';
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%nozes%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%pistache%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 10.0 WHERE name ILIKE '%amendoim%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%caju%' AND fiber_g = 0 AND name ILIKE '%castanha%';
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%macadâmia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%pecã%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%avelã%' AND fiber_g = 0;

-- Suplementos (whey, creatina, etc. = 0 fibra, correto)
-- Bebidas (sucos, refrigerantes, água = geralmente 0 fibra, mas sucos integrais têm)
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%suco integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%suco natural%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%vitamina%' AND fiber_g = 0 AND category = 'Bebidas';
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%smoothie%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%achocolatado%' AND fiber_g = 0 AND category = 'Bebidas';

-- Laticínios e derivados com frutas
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%iogurte com fruta%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.3 WHERE name ILIKE '%iogurte%' AND fiber_g = 0 AND name NOT ILIKE '%fruta%';
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%danone%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%danoninho%' AND fiber_g = 0;

-- Condimentos e molhos
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%ketchup%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%mostarda%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%molho de tomate%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%maionese%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%pesto%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 0.5 WHERE name ILIKE '%molho branco%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%geleia%' AND fiber_g = 0;

-- Pães e massas extras
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%pão alemão%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%pão de centeio%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%pão doce%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%croc%' AND fiber_g = 0 AND name ILIKE '%pão%';
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%pão multicereal%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%pão de aveia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%bolo de fubá%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%bolo%' AND fiber_g = 0 AND name NOT ILIKE '%fubá%' AND name NOT ILIKE '%integral%' AND name NOT ILIKE '%cenoura%';
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%bolo de cenoura%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%bolo integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%biscoito%' AND fiber_g = 0 AND name NOT ILIKE '%integral%' AND name NOT ILIKE '%aveia%';
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%biscoito integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.5 WHERE name ILIKE '%biscoito de aveia%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%cookie%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%cookie integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%torrada%' AND fiber_g = 0 AND name NOT ILIKE '%integral%';
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%torrada integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%crecker%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%wafer%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%barra de cereal%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%barra protein%' AND fiber_g = 0;

-- Cereais matinais
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%cereais matinais%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%cereal integral%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 10.0 WHERE name ILIKE '%all bran%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%fibra%' AND fiber_g = 0 AND category = 'Grãos e Cereais';

-- Outros grãos
UPDATE foods SET fiber_g = 11.0 WHERE name ILIKE '%grão de bico%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 16.0 WHERE name ILIKE '%soja%' AND fiber_g = 0 AND name NOT ILIKE '%óleo%' AND name NOT ILIKE '%leite%';
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%soja texturizada%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%tofu%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%tempeh%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%missô%' AND fiber_g = 0;

-- Leguminosas extras
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%feijão preto%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%feijão carioca%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 7.0 WHERE name ILIKE '%feijão branco%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 8.0 WHERE name ILIKE '%feijão fradinho%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.0 WHERE name ILIKE '%feijão verde%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 9.0 WHERE name ILIKE '%feijão carioca cozido%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 6.5 WHERE name ILIKE '%feijão cozido%' AND fiber_g = 0 AND name NOT ILIKE '%preto%' AND name NOT ILIKE '%carioca%';

-- Mandioca e derivados
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%tapioca%' AND fiber_g = 0 AND name NOT ILIKE '%goma%';
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%polvilho%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%crepe%' AND fiber_g = 0;

-- Nutella e cremes
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%nutella%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%pasta de amendoim%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.0 WHERE name ILIKE '%doce de leite%' AND fiber_g = 0;

-- Produtos especiais
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%hummus%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 3.0 WHERE name ILIKE '%tabule%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 4.0 WHERE name ILIKE '%quibe%' AND fiber_g = 0 AND name NOT ILIKE '%crudo%';
UPDATE foods SET fiber_g = 5.0 WHERE name ILIKE '%quibe crudo%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%esfiha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%pastel%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%coxinha%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%empada%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%rissole%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 1.5 WHERE name ILIKE '%enroladinho%' AND fiber_g = 0;
UPDATE foods SET fiber_g = 2.0 WHERE name ILIKE '%pASTEL%' AND fiber_g = 0;
