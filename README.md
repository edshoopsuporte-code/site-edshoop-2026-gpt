# Edshoop — implementação em andamento

A pasta contém:
- `ABRIR_DEMO.html`: demonstração offline interativa da vitrine e do painel para avaliação local.
- `src/`: aplicação React + Vite com autenticação Supabase e gestão de catálogo.
- `public/products/`: 30 ilustrações SVG individuais.
- `supabase/schema.sql`: estrutura do banco, políticas RLS, plataformas iniciais e catálogo demo.
- `supabase/backup_schedule.sql`: agendamento semanal de snapshots (requer pg_cron).
- `referencias/`: imagens aprovadas usadas como referência do projeto.

## Requisitos incorporados
Vitrine responsiva (5 colunas desktop, 3 tablet, 2 smartphone), categorias dinâmicas, produtos sem limite fixo, preço individual visível/oculto e controle global, Mercado Livre e Shopee iniciais com cadastro de novas plataformas, login exclusivo do administrador `edshoopsuporte@gmail.com`, alteração/recuperação de senha, edição de e-mail público, upload e compressão de imagens, links individuais, destaque, ordenação manual, confirmação de exclusão, estatísticas de cliques, backup manual e snapshots automáticos.

## Visualização
Abra `ABRIR_DEMO.html` com dois cliques. A demonstração usa `localStorage` e serve para testar a navegação e os fluxos de gestão. Não é a autenticação de produção e não deve receber senha real.

## Configuração Supabase
1. Crie um projeto Supabase.
2. Em Authentication > Users, crie `edshoopsuporte@gmail.com` e defina a senha inicial.
3. Copie o UUID do utilizador.
4. Execute `supabase/schema.sql` no SQL Editor.
5. Execute a instrução comentada no fim do SQL com o UUID do proprietário.
6. Desative novos cadastros públicos.
7. Configure `.env` a partir de `.env.example` com a Project URL e chave pública.
8. Execute `supabase/backup_schedule.sql` para ativar backup semanal (requer pg_cron).

Nunca coloque a chave `service_role` no frontend. As políticas RLS permitem escrita apenas ao UUID cadastrado em `edshoop_admins`.

## Backups e imagens
O backup guarda os registos e as URLs das imagens. Os ficheiros de imagem ficam no bucket `product-images`; não são incorporados no JSON de backup. O bucket deve ser preservado e incluído no plano de cópias do projeto Supabase.

## Publicação
O frontend pode ser publicado num host estático (Cloudflare Pages, Netlify, Vercel ou GitHub Pages com `base` ajustado). O Supabase fornece autenticação, banco e storage.

## Estado de validação
A sintaxe do JavaScript da demonstração offline foi verificada com Node. A instalação de dependências para executar `npm run build` não terminou neste ambiente, portanto o build React ainda precisa ser validado antes da publicação. Nenhum dado real, senha ou link afiliado foi configurado.
