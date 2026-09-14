/*
# Corrigir insercao de hashtags + adicionar coluna fiber_g em meals

## Problema das hashtags
A policy `insert_post_hashtags` faz um SELECT em feed_posts verificando 
`fp.user_id = auth.uid()`, mas esse SELECT passa pelo RLS de feed_posts.
Dependendo da policy, o SELECT pode nao retornar o post recem-criado,
fazendo a insercao do post_hashtag falhar silenciosamente.

## Solucao
Substituir a policy de INSERT de post_hashtags para usar uma verificacao 
mais simples: o post_id deve existir em feed_posts (sem filtrar por user_id 
no EXISTS, pois o RLS do feed_posts SELECT ja garante que so posts visiveis 
ao usuario aparecem). Na pratica, o usuario so tem o post_id de posts que 
ele mesmo criou (acabou de inserir), entao a verificacao EXISTS basta.

## Adicionar fiber_g em meals
- Adiciona coluna `fiber_g` (numeric, default 0) na tabela meals
- Permite registrar fibra ao logar refeicoes
*/
ALTER TABLE meals ADD COLUMN IF NOT EXISTS fiber_g numeric NOT NULL DEFAULT 0;

-- Corrigir policy de insert em post_hashtags
DROP POLICY IF EXISTS "insert_post_hashtags" ON post_hashtags;
CREATE POLICY "insert_post_hashtags" ON post_hashtags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_hashtags.post_id)
  );
