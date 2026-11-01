-- EDSHOOP — schema inicial de produção (Supabase)
-- Execute no SQL Editor de um projeto Supabase novo.
-- Depois crie o utilizador proprietário em Authentication > Users e associe o UUID
-- na secção indicada no final. Nunca coloque service_role no frontend.

create extension if not exists pgcrypto;

create table if not exists public.edshoop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_edshoop_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.edshoop_admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_edshoop_admin() from public;
grant execute on function public.is_edshoop_admin() to anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_platforms (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  category text not null default '',
  category_name text not null default '',
  image_url text not null default '/products/default.svg',
  price numeric(12,2),
  previous_price numeric(12,2),
  show_price boolean not null default false,
  platform_id uuid references public.affiliate_platforms(id) on delete set null,
  platform text not null default '',
  platform_name text not null default '',
  affiliate_url text not null default '',
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  contact_email text not null default 'edshoopsuporte@gmail.com',
  banner_title text not null default 'As Melhores Ofertas e Recomendações',
  banner_text text not null default 'Produtos selecionados com ofertas especiais para você.',
  show_prices_globally boolean not null default true,
  show_previous_price boolean not null default true,
  show_search boolean not null default true,
  show_featured boolean not null default true,
  products_per_page integer not null default 30,
  updated_at timestamptz not null default now()
);

-- Compatibilidade com tabelas criadas por versões anteriores do protótipo.
alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.products add column if not exists category text not null default '';
alter table public.products add column if not exists category_name text not null default '';
alter table public.products add column if not exists previous_price numeric(12,2);
alter table public.products add column if not exists platform_id uuid references public.affiliate_platforms(id) on delete set null;
alter table public.products add column if not exists platform text not null default '';
alter table public.products add column if not exists platform_name text not null default '';
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.site_settings add column if not exists contact_email text not null default 'edshoopsuporte@gmail.com';
alter table public.site_settings add column if not exists show_prices_globally boolean not null default true;
alter table public.site_settings add column if not exists show_previous_price boolean not null default true;
alter table public.site_settings add column if not exists show_search boolean not null default true;
alter table public.site_settings add column if not exists show_featured boolean not null default true;
alter table public.site_settings add column if not exists products_per_page integer not null default 30;
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  platform_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.click_events add column if not exists platform_name text not null default ''; 

create table if not exists public.admin_backups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  backup_json jsonb not null,
  created_at timestamptz not null default now()
);

-- Remover políticas permissivas do protótipo anterior, se existirem.
drop policy if exists "Public can read published products" on public.products;
drop policy if exists "Authenticated admins manage products" on public.products;
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Authenticated admins manage categories" on public.categories;
drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Authenticated admins update site settings" on public.site_settings;
drop policy if exists "Public can record clicks" on public.click_events;
drop policy if exists "Authenticated admins read clicks" on public.click_events;

-- RLS
alter table public.edshoop_admins enable row level security;
alter table public.categories enable row level security;
alter table public.affiliate_platforms enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.click_events enable row level security;
alter table public.admin_backups enable row level security;

drop policy if exists admin_self_read on public.edshoop_admins;
create policy admin_self_read on public.edshoop_admins
for select to authenticated using (user_id = auth.uid());

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
for select to anon, authenticated using (true);
drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories
for all to authenticated using (public.is_edshoop_admin())
with check (public.is_edshoop_admin());

drop policy if exists platforms_public_read on public.affiliate_platforms;
create policy platforms_public_read on public.affiliate_platforms
for select to anon, authenticated using (active = true or public.is_edshoop_admin());
drop policy if exists platforms_admin_all on public.affiliate_platforms;
create policy platforms_admin_all on public.affiliate_platforms
for all to authenticated using (public.is_edshoop_admin())
with check (public.is_edshoop_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
for select to anon, authenticated using (published = true or public.is_edshoop_admin());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
for all to authenticated using (public.is_edshoop_admin())
with check (public.is_edshoop_admin());

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings
for select to anon, authenticated using (true);
drop policy if exists settings_admin_all on public.site_settings;
create policy settings_admin_all on public.site_settings
for all to authenticated using (public.is_edshoop_admin())
with check (public.is_edshoop_admin());

drop policy if exists clicks_public_insert on public.click_events;
create policy clicks_public_insert on public.click_events
for insert to anon, authenticated
with check (
  exists (select 1 from public.products p
          where p.id = product_id and p.published = true)
);
drop policy if exists clicks_admin_read on public.click_events;
create policy clicks_admin_read on public.click_events
for select to authenticated using (public.is_edshoop_admin());

drop policy if exists backups_admin_all on public.admin_backups;
create policy backups_admin_all on public.admin_backups
for all to authenticated using (public.is_edshoop_admin())
with check (public.is_edshoop_admin());

-- Storage: bucket público para servir imagens; somente administrador pode enviar/alterar/apagar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'product-images' and public.is_edshoop_admin()
);
drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects
for update to authenticated using (
  bucket_id = 'product-images' and public.is_edshoop_admin()
) with check (
  bucket_id = 'product-images' and public.is_edshoop_admin()
);
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'product-images' and public.is_edshoop_admin()
);

-- Dados iniciais: categorias e as DUAS plataformas combinadas.
insert into public.categories(name, sort_order) values
('Beleza e Maquiagem',1),('Automotivo',2),('Eletrônicos',3),
('Casa e Utilidades',4),('Moda e Acessórios',5)
on conflict (name) do nothing;

insert into public.affiliate_platforms(name, active, sort_order) values
('Mercado Livre',true,1),('Shopee',true,2)
on conflict (name) do nothing;

insert into public.site_settings(id, contact_email)
values (1, 'edshoopsuporte@gmail.com')
on conflict (id) do nothing;

-- INSERIR O ADMINISTRADOR:
-- 1) Crie o utilizador edshoopsuporte@gmail.com em Authentication > Users.
-- 2) Copie o UUID desse utilizador.
-- 3) Execute a instrução abaixo, substituindo UUID_DO_ADMIN:
-- insert into public.edshoop_admins(user_id)
-- values ('UUID_DO_ADMIN') on conflict do nothing;

-- Importante: desligue "Allow new users to sign up" em Authentication > Settings.
-- Não há criação pública de contas. A senha é definida ao criar o utilizador no Supabase.
-- O backup automático periódico deve ser configurado por agendamento/Edge Function após
-- conectar o projeto. O botão de backup manual fica disponível no painel.


-- Catálogo demonstrativo inicial (30 produtos, sem links reais e preços ocultos).
-- A inserção é idempotente: não duplica produtos com o mesmo nome.
insert into public.products
  (name, description, category, category_name, image_url, platform, platform_name,
   show_price, affiliate_url, published, featured, sort_order)
select v.name, v.description, v.category, v.category, v.image_url, v.platform, v.platform,
       false, '', true, v.featured, v.sort_order
from (values
('Kit de maquiagem profissional','Estojo completo para organizar seus itens de beleza.','Beleza e Maquiagem','/products/kit-maquiagem.svg','Mercado Livre',true,1),
('Secador de cabelo compacto','Praticidade para sua rotina de cuidados.','Beleza e Maquiagem','/products/secador.svg','Shopee',true,2),
('Escova modeladora','Uma opção prática para modelar os cabelos.','Beleza e Maquiagem','/products/escova-modeladora.svg','Shopee',true,3),
('Kit de pincéis de maquiagem','Conjunto ilustrativo para sua coleção de beleza.','Beleza e Maquiagem','/products/pinceis.svg','Mercado Livre',true,4),
('Organizador de cosméticos','Mantenha seus produtos organizados.','Beleza e Maquiagem','/products/organizador-cosmeticos.svg','Shopee',true,5),
('Aspirador portátil automotivo','Acessório compacto para limpeza do veículo.','Automotivo','/products/aspirador-carro.svg','Mercado Livre',true,6),
('Suporte veicular para celular','Mais praticidade para usar o celular no carro.','Automotivo','/products/suporte-celular.svg','Shopee',true,7),
('Kit de limpeza automotiva','Itens para os cuidados do seu automóvel.','Automotivo','/products/limpeza-auto.svg','Mercado Livre',true,8),
('Carregador veicular USB','Carregamento prático durante seus trajetos.','Automotivo','/products/carregador-carro.svg','Shopee',true,9),
('Capa para banco automotivo','Acessório para proteção e conservação.','Automotivo','/products/capa-banco.svg','Mercado Livre',true,10),
('Fone de ouvido sem fio','Liberdade para ouvir músicas e conteúdos.','Eletrônicos','/products/fone.svg','Mercado Livre',false,11),
('Smartwatch esportivo','Acompanhe informações do dia a dia.','Eletrônicos','/products/smartwatch.svg','Shopee',false,12),
('Caixa de som Bluetooth','Som portátil para diferentes momentos.','Eletrônicos','/products/caixa-som.svg','Mercado Livre',false,13),
('Carregador portátil power bank','Energia extra para seus dispositivos.','Eletrônicos','/products/powerbank.svg','Shopee',false,14),
('Luminária LED de mesa','Iluminação funcional para seu espaço.','Eletrônicos','/products/luminaria.svg','Mercado Livre',false,15),
('Kit de potes organizadores','Organização prática para cozinha e despensa.','Casa e Utilidades','/products/potes.svg','Mercado Livre',false,16),
('Garrafa térmica','Ideal para levar sua bebida preferida.','Casa e Utilidades','/products/garrafa.svg','Shopee',false,17),
('Jogo de utensílios de cozinha','Acessórios úteis para o preparo das refeições.','Casa e Utilidades','/products/utensilios.svg','Mercado Livre',false,18),
('Organizador multiuso','Ajuda a aproveitar melhor os espaços.','Casa e Utilidades','/products/organizador.svg','Shopee',false,19),
('Luminária decorativa','Um detalhe acolhedor para sua casa.','Casa e Utilidades','/products/luminaria-casa.svg','Mercado Livre',false,20),
('Mochila casual','Modelo versátil para rotina e passeios.','Moda e Acessórios','/products/mochila.svg','Mercado Livre',false,21),
('Bolsa transversal','Acessório prático para o dia a dia.','Moda e Acessórios','/products/bolsa.svg','Shopee',false,22),
('Óculos de sol','Um clássico para complementar seu visual.','Moda e Acessórios','/products/oculos.svg','Mercado Livre',false,23),
('Relógio casual','Acessório discreto para diferentes ocasiões.','Moda e Acessórios','/products/relogio.svg','Shopee',false,24),
('Carteira compacta','Organização para cartões e documentos.','Moda e Acessórios','/products/carteira.svg','Mercado Livre',false,25),
('Kit skincare facial','Itens demonstrativos para rotina de cuidados.','Beleza e Maquiagem','/products/skincare.svg','Shopee',false,26),
('Câmera de segurança Wi-Fi','Solução conectada para monitoramento residencial.','Eletrônicos','/products/camera.svg','Mercado Livre',false,27),
('Mini processador de alimentos','Ajuda no preparo de receitas.','Casa e Utilidades','/products/processador.svg','Shopee',false,28),
('Tapete automotivo','Acessório para proteção do interior do carro.','Automotivo','/products/tapete-carro.svg','Mercado Livre',false,29),
('Tênis casual','Opção versátil para compor seu visual.','Moda e Acessórios','/products/tenis.svg','Shopee',false,30)
) as v(name,description,category,image_url,platform,featured,sort_order)
where not exists (select 1 from public.products p where p.name = v.name);
