import { useEffect, useMemo, useState } from 'react';
import {
  Search, ExternalLink, LockKeyhole, X, Plus, Pencil, Trash2, Eye, EyeOff,
  BarChart3, Package, Tags, Settings, Upload, Save, LogOut, Copy, Link2,
  ChevronUp, ChevronDown, Download, RotateCcw, ShieldCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { demoProducts, categories as initialCategories, type Product } from './data/products';

const ADMIN_EMAIL = 'edshoopsuporte@gmail.com';
type Platform = { id: string; name: string; active: boolean; sort_order: number };
type Settings = {
  contact_email: string; banner_title: string; banner_text: string;
  show_prices_globally: boolean; show_previous_price: boolean;
  show_search: boolean; show_featured: boolean; products_per_page: number;
};
type Tab = 'dashboard'|'products'|'categories'|'platforms'|'settings'|'backup'|'password';
const defaultSettings: Settings = {
  contact_email: ADMIN_EMAIL,
  banner_title: 'As Melhores Ofertas e Recomendações',
  banner_text: 'Produtos selecionados com ofertas especiais para você.',
  show_prices_globally: true, show_previous_price: true, show_search: true,
  show_featured: true, products_per_page: 30
};

export default function App() {
  const [products,setProducts]=useState<Product[]>(demoProducts);
  const [cats,setCats]=useState<string[]>(initialCategories);
  const [platforms,setPlatforms]=useState<Platform[]>([
    {id:'demo-ml',name:'Mercado Livre',active:true,sort_order:1},
    {id:'demo-shopee',name:'Shopee',active:true,sort_order:2}
  ]);
  const [settings,setSettings]=useState<Settings>(defaultSettings);
  const [query,setQuery]=useState(''); const [category,setCategory]=useState('Todas');
  const [showAll,setShowAll]=useState(false);
  const [session,setSession]=useState<any>(null);
  const [adminOpen,setAdminOpen]=useState(false);
  const [tab,setTab]=useState<Tab>('dashboard');
  const [email,setEmail]=useState(ADMIN_EMAIL); const [password,setPassword]=useState('');
  const [loginError,setLoginError]=useState(''); const [notice,setNotice]=useState('');
  const [editing,setEditing]=useState<Product|null>(null);
  const [newCategory,setNewCategory]=useState('');
  const [newPlatform,setNewPlatform]=useState('');
  const [loading,setLoading]=useState(false);
  const [clickCounts,setClickCounts]=useState<Record<string,number>>({});
  const [totalClicks,setTotalClicks]=useState(0);

  useEffect(() => {
  const client = supabase;
  if (!client) return;

  let alive = true;

  client.auth.getSession().then(async ({ data }) => {
    if (!alive || !data.session) return;

    const { data: admin } = await client
      .from('edshoop_admins')
      .select('user_id')
      .eq('user_id', data.session.user.id)
      .maybeSingle();

    if (alive && admin) {
      setSession(data.session);
    } else if (alive) {
      await client.auth.signOut();
    }
  });

  const { data: { subscription } } =
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setSession(null);
      if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
      }
    });

  return () => {
    alive = false;
    subscription.unsubscribe();
  };
}, []);

  useEffect(()=>{
    if(!supabase)return;
    (async()=>{
      const [{data:pd},{data:cd},{data:pl},{data:st}] = await Promise.all([
        supabase.from('products').select('*').order('sort_order',{ascending:true}),
        supabase.from('categories').select('*').order('sort_order',{ascending:true}),
        supabase.from('affiliate_platforms').select('*').order('sort_order',{ascending:true}),
        supabase.from('site_settings').select('*').eq('id',1).maybeSingle()
      ]);
      if(pd?.length)setProducts(pd as Product[]);
      if(cd?.length)setCats(cd.map(x=>x.name));
      if(pl?.length)setPlatforms(pl as Platform[]);
      if(st)setSettings({...defaultSettings,...st});
    })();
  },[session]);

  useEffect(()=>{
    if(!supabase||!session)return;
    supabase.from('click_events').select('id',{count:'exact',head:true}).then(({count})=>setTotalClicks(count||0));
    supabase.from('click_events').select('product_id').then(({data})=>{
      const counts:Record<string,number>={};
      (data||[]).forEach((x:any)=>{if(x.product_id)counts[x.product_id]=(counts[x.product_id]||0)+1;});
      setClickCounts(counts);
    });
  },[session]);

  const visible=useMemo(()=>products
    .filter(p=>p.published&&(category==='Todas'||p.category===category)&&`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>(settings.show_featured?(Number(b.featured)-Number(a.featured)):0)||((a as any).sort_order??0)-((b as any).sort_order??0)),
    [products,category,query]);
  const shown=showAll?visible:visible.slice(0,Number(settings.products_per_page)||30);

  function notify(s:string){setNotice(s);window.setTimeout(()=>setNotice(''),3500);}
  async function signIn(e:React.FormEvent){
    e.preventDefault();setLoginError('');
    if(!supabase){setLoginError('Conecte o Supabase para ativar o login real.');return;}
    if(email.trim().toLowerCase()!==ADMIN_EMAIL){setLoginError('Este e-mail não está autorizado.');return;}
    const {data,error}=await supabase.auth.signInWithPassword({email:ADMIN_EMAIL,password});
    if(error){setLoginError('Não foi possível entrar. Confira o e-mail e a senha.');return;}
    const {data:admin}=await supabase.from('edshoop_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(!admin){await supabase.auth.signOut();setLoginError('Este utilizador não está autorizado como administrador.');return;}
    setSession(data.session);setPassword('');setAdminOpen(true);setTab('dashboard');
  }
  async function signOut(){await supabase?.auth.signOut();setSession(null);setAdminOpen(false);}
  async function resetPassword(){
    if(!supabase){setLoginError('Conecte o Supabase primeiro.');return;}
    const {error}=await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL,{redirectTo:window.location.origin});
    setLoginError(error?'Não foi possível enviar o e-mail de recuperação.':'Se o endereço estiver cadastrado, enviaremos as instruções de recuperação.');
  }
  async function changePassword(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    const current=String(fd.get('current')||'');const next=String(fd.get('next')||'');const confirm=String(fd.get('confirm')||'');
    if(next.length<8||next!==confirm){notify('A nova senha precisa ter pelo menos 8 caracteres e coincidir na confirmação.');return;}
    if(!supabase){notify('Conecte o Supabase para alterar a senha real.');return;}
    const {error:check}=await supabase.auth.signInWithPassword({email:ADMIN_EMAIL,password:current});
    if(check){notify('A senha atual não confere.');return;}
    const {error}=await supabase.auth.updateUser({password:next});
    notify(error?'Não foi possível alterar a senha.':'Senha atualizada com sucesso.');
    e.currentTarget.reset();
  }

  async function refreshProducts(){
    if(!supabase)return;
    const {data,error}=await supabase.from('products').select('*').order('sort_order',{ascending:true});
    if(error)notify('Erro ao atualizar produtos.');else if(data)setProducts(data as Product[]);
  }
  async function saveProduct(p:Product){
    if(!p.name.trim()){notify('Informe o nome do produto.');return;}
    if(p.published&&!p.affiliate_url.trim()){notify('O produto está sem link de afiliado. Cadastre o link ou deixe-o como rascunho.');return;}
    setLoading(true);
    if(!supabase){notify('O catálogo de demonstração não grava no banco. Conecte o Supabase.');setLoading(false);return;}
    const payload:any={...p};delete payload.id;delete payload.created_at;if(p.id.startsWith('demo-'))payload.sort_order=products.length+1;payload.updated_at=new Date().toISOString();
    const result=p.id.startsWith('demo-')
      ? await supabase.from('products').insert(payload)
      : await supabase.from('products').update(payload).eq('id',p.id);
    if(result.error){notify('Não foi possível guardar o produto: '+result.error.message);setLoading(false);return;}
    await refreshProducts();setEditing(null);notify('Produto guardado.');setLoading(false);
  }
  async function deleteProduct(p:Product){
    if(!window.confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`))return;
    if(!supabase){notify('Conecte o Supabase para excluir dados permanentes.');return;}
    const {error}=await supabase.from('products').delete().eq('id',p.id);
    if(error){notify('Erro ao excluir produto.');return;}
    setProducts(old=>old.filter(x=>x.id!==p.id));notify('Produto excluído.');
  }
  async function addCategory(){
    const name=newCategory.trim();if(!name)return;
    if(cats.includes(name)){notify('Essa categoria já existe.');return;}
    if(!supabase){notify('Conecte o Supabase para guardar categorias.');return;}
    const {error}=await supabase.from('categories').insert({name,sort_order:cats.length+1});
    if(error){notify('Não foi possível adicionar a categoria.');return;}
    setCats(old=>[...old,name]);setNewCategory('');notify('Categoria adicionada.');
  }
  async function removeCategory(name:string){
    if(!window.confirm(`Remover a categoria "${name}"? Produtos associados precisarão ser reclassificados.`))return;
    if(!supabase)return;
    const {error}=await supabase.from('categories').delete().eq('name',name);
    if(error){notify('Não foi possível remover. Verifique os produtos associados.');return;}
    setCats(old=>old.filter(x=>x!==name));notify('Categoria removida.');
  }
  async function addPlatform(){
    const name=newPlatform.trim();if(!name)return;
    if(platforms.some(x=>x.name.toLowerCase()===name.toLowerCase())){notify('Essa plataforma já está cadastrada.');return;}
    if(!supabase){notify('Conecte o Supabase para guardar plataformas.');return;}
    const {data,error}=await supabase.from('affiliate_platforms').insert({name,active:true,sort_order:platforms.length+1}).select().single();
    if(error){notify('Não foi possível adicionar a plataforma.');return;}
    setPlatforms(old=>[...old,data as Platform]);setNewPlatform('');notify('Plataforma adicionada.');
  }
  async function deletePlatform(p:Platform){
    if(!window.confirm(`Remover a plataforma "${p.name}"? Os produtos associados deverão ser atualizados.`))return;
    if(!supabase)return;
    const {error}=await supabase.from('affiliate_platforms').delete().eq('id',p.id);
    if(error){notify('Não foi possível remover a plataforma.');return;}
    setPlatforms(old=>old.filter(x=>x.id!==p.id));notify('Plataforma removida.');
  }
  async function togglePlatform(p:Platform){
    if(!supabase)return;
    const {error}=await supabase.from('affiliate_platforms').update({active:!p.active}).eq('id',p.id);
    if(error){notify('Não foi possível alterar o estado.');return;}
    setPlatforms(old=>old.map(x=>x.id===p.id?{...x,active:!x.active}:x));
  }
  async function saveSettings(e:React.FormEvent){
    e.preventDefault();if(!supabase){notify('Conecte o Supabase para guardar configurações.');return;}
    const {error}=await supabase.from('site_settings').upsert({...settings,id:1,updated_at:new Date().toISOString()});
    if(error)notify('Não foi possível guardar as configurações.');else notify('Configurações guardadas.');
  }
  async function uploadImage(file:File){
    if(!supabase){notify('Conecte o Supabase para enviar imagens.');return '';}
    const compressed=await compressImage(file);
    const path=`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'-')}.webp`;
    const {error}=await supabase.storage.from('product-images').upload(path,compressed,{upsert:true,contentType:'image/webp'});
    if(error){notify('Erro no envio da imagem.');return '';}
    return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }
  async function manualBackup(){
    if(!supabase){notify('Conecte o Supabase para criar backup.');return;}
    const [p,c,pl,st]=await Promise.all([
      supabase.from('products').select('*'),supabase.from('categories').select('*'),
      supabase.from('affiliate_platforms').select('*'),supabase.from('site_settings').select('*')
    ]);
    if(p.error||c.error||pl.error||st.error){notify('Não foi possível montar o backup.');return;}
    const snapshot={version:1,created_at:new Date().toISOString(),products:p.data,categories:c.data,platforms:pl.data,settings:st.data};
    const {error}=await supabase.from('admin_backups').insert({backup_json:snapshot});
    if(error){notify('Não foi possível guardar o backup no banco.');return;}
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`edshoop-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
    notify('Backup manual criado e descarregado. As imagens permanecem no armazenamento do Supabase.');
  }
  async function restoreBackup(file:File){
    if(!supabase)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.products)||!Array.isArray(data.categories)||!Array.isArray(data.platforms))throw new Error('invalid');
      if(!window.confirm('Restaurar este backup? Os produtos, categorias, plataformas e configurações atuais serão substituídos.'))return;
      const delProducts=await supabase.from('products').delete().not('id','is',null);
      if(delProducts.error)throw delProducts.error;
      const delCategories=await supabase.from('categories').delete().not('id','is',null);
      if(delCategories.error)throw delCategories.error;
      const delPlatforms=await supabase.from('affiliate_platforms').delete().not('id','is',null);
      if(delPlatforms.error)throw delPlatforms.error;
      if(data.categories.length){const r=await supabase.from('categories').insert(data.categories);if(r.error)throw r.error;}
      if(data.platforms.length){const r=await supabase.from('affiliate_platforms').insert(data.platforms);if(r.error)throw r.error;}
      if(data.products.length){const r=await supabase.from('products').insert(data.products);if(r.error)throw r.error;}
      if(Array.isArray(data.settings)&&data.settings[0]){const r=await supabase.from('site_settings').upsert(data.settings[0]);if(r.error)throw r.error;}
      await refreshProducts();
      notify('Backup restaurado. As imagens continuam no armazenamento do Supabase.');
    }catch(err){notify('Não foi possível restaurar. Verifique se o arquivo é um backup Edshoop válido.');}
  }
  async function trackClick(p:Product){
    if(!p.affiliate_url){notify('Esta oferta ainda não tem link cadastrado.');return;}
    if(supabase)supabase.from('click_events').insert({product_id:p.id,platform_name:p.platform||''}).then(()=>{});
    window.open(p.affiliate_url,'_blank','noopener,noreferrer');
  }
  async function moveProduct(p:Product,dir:number){
    if(!supabase){notify('Conecte o Supabase para reorganizar a vitrine.');return;}
    const ordered=[...products].sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0));
    const i=ordered.findIndex(x=>x.id===p.id),j=i+dir;if(j<0||j>=ordered.length)return;
    const a=ordered[i],b=ordered[j],ao=(a as any).sort_order||i,bo=(b as any).sort_order||j;
    const r=await Promise.all([
      supabase.from('products').update({sort_order:bo}).eq('id',a.id),
      supabase.from('products').update({sort_order:ao}).eq('id',b.id)
    ]);
    if(r.some(x=>x.error)){notify('Não foi possível alterar a ordem.');return;}
    await refreshProducts();
  }
  async function compressImage(file:File):Promise<Blob>{
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=()=>reject(new Error('read'));
      reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('image'));
        img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');
          canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          canvas.getContext('2d')?.drawImage(img,0,0,canvas.width,canvas.height);
          canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('compress')),'image/webp',0.82);};
        img.src=String(reader.result);};reader.readAsDataURL(file);
    });
  }

  return <div className="app" id="topo">
    <header className="header">
      <a className="brand" href="#topo"><img src={`${import.meta.env.BASE_URL}edshop-logo.png`} alt="Edshoop — Ofertas e Recomendações"/></a>
      {settings.show_search&&<div className="search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produtos, marcas e ofertas..."/><button aria-label="Pesquisar"><Search size={21}/></button></div>}
      <div className="header-links"><a href="#ofertas">Ofertas</a><a href="#categorias">Categorias</a><a href={`mailto:${settings.contact_email}`}>Contato</a></div>
    </header>
    <nav className="category-nav" id="categorias">{cats.map(c=><button key={c} className={category===c?'active':''} onClick={()=>{setCategory(c);setShowAll(false);}}>{c}</button>)}</nav>
    <main>
      <section className="hero"><div><h1>As Melhores <em>Ofertas e Recomendações</em></h1><p>{settings.banner_text}</p></div><div className="hero-art"><button onClick={()=>{setCategory('Todas');setShowAll(true);document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth'});}}>Ver todos os produtos <span>→</span></button></div></section>
      <section id="ofertas" className="products-section">
        <div className="section-heading"><h2>{category==='Todas'?'Produtos em Destaque':category}</h2><span className="result-count">{visible.length} produtos</span></div>
        <div className="product-grid">{shown.map(p=><article className="product-card" key={p.id}>
          <div className="product-image"><img src={p.image_url} alt={p.name} onError={e=>{e.currentTarget.src='`${import.meta.env.BASE_URL}products/default.svg`';}}/></div>
          <div className="product-info"><span className="product-category">{p.category}</span><h3>{p.name}</h3>
            {settings.show_prices_globally&&p.show_price&&p.price!==null&&<strong className="price">R$ {Number(p.price).toFixed(2).replace('.',',')}</strong>}{settings.show_prices_globally&&settings.show_previous_price&&p.show_price&&(p as any).previous_price&&<small className="previous-price">R$ {Number((p as any).previous_price).toFixed(2).replace('.',',')}</small>}
            <button className="offer-button" onClick={()=>trackClick(p)}>Ver Oferta <ExternalLink size={15}/></button>
          </div></article>)}</div>
        {visible.length===0&&<p className="empty">Nenhum produto encontrado.</p>}
        {visible.length>Number(settings.products_per_page)&&<button className="show-all" onClick={()=>setShowAll(!showAll)}>{showAll?'Mostrar menos':'Ver todos os produtos'} <ChevronDown size={17}/></button>}
      </section>
    </main>
    <footer className="footer"><div><a href={`mailto:${settings.contact_email}`}>Contato: {settings.contact_email}</a></div><p><b>As melhores ofertas e recomendações.</b><br/>Este site utiliza links de afiliados. Podemos receber comissões pelas compras realizadas.</p><button className="restricted" onClick={()=>setAdminOpen(true)}><LockKeyhole size={14}/> Área Restrita</button></footer>

    {adminOpen&&<div className="modal-backdrop" onClick={()=>!session&&setAdminOpen(false)}>
      <div className="admin-modal" onClick={e=>e.stopPropagation()}>
        {!session?<><button className="close" onClick={()=>setAdminOpen(false)}><X/></button><div className="modal-brand"><ShieldCheck/><h2>Área Restrita</h2><p>Acesso exclusivo do administrador</p></div>
          <form onSubmit={signIn}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary" type="submit">Entrar</button>{loginError&&<p className="error">{loginError}</p>}</form>
          <button className="text-button" onClick={resetPassword}>Esqueci minha senha</button>
        </>:<div className="admin">
          <div className="admin-top"><div><span className="eyebrow">PAINEL DE CONTROLE</span><h2>Edshoop — Administração</h2><small>{ADMIN_EMAIL}</small></div><button className="icon-button" onClick={signOut}><LogOut size={17}/> Sair</button></div>
          <div className="stats"><div><Package/><b>{products.length}</b><small>Produtos cadastrados</small></div><div><Tags/><b>{cats.length}</b><small>Categorias</small></div><div><ShieldCheck/><b>{products.filter(p=>p.published).length}</b><small>Produtos ativos</small></div><div><EyeOff/><b>{products.filter(p=>!p.show_price).length}</b><small>Preços ocultos</small></div><div><BarChart3/><b>{totalClicks}</b><small>Cliques</small></div></div>
          <div className="tabs">{(['dashboard','products','categories','platforms','settings','backup','password'] as Tab[]).map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>setTab(t)}>{({dashboard:'Painel',products:'Produtos',categories:'Categorias',platforms:'Plataformas',settings:'Configurações',backup:'Backup',password:'Senha'} as any)[t]}</button>)}</div>
          {tab==='dashboard'&&<div className="admin-section"><h3>Resumo da vitrine</h3><p>Catálogo sem limite fixo de produtos. As plataformas iniciais são Mercado Livre e Shopee; você poderá cadastrar outras.</p><p>Produtos sem link: <b>{products.filter(p=>p.published&&!p.affiliate_url).length}</b></p><p>Cliques registrados: <b>{totalClicks}</b></p></div>}
          {tab==='products'&&<div className="admin-section"><div className="admin-toolbar"><button className="primary" onClick={()=>setEditing({id:'demo-new',name:'',description:'',category:cats[0]||'',image_url:'/products/default.svg',price:null,show_price:false,platform:platforms[0]?.name||'',affiliate_url:'',published:false,featured:false} as Product)}><Plus size={16}/> Novo Produto</button><button className="icon-button" onClick={manualBackup}><Download size={16}/> Backup</button></div>
            <div className="admin-list">{products.slice().sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0)).map(p=><div className="admin-row" key={p.id}><img src={p.image_url} alt=""/><div><b>{p.name}</b><small>{p.category} • {p.platform||'Sem plataforma'} • {p.show_price?'Preço visível':'Preço oculto'} • {clickCounts[p.id]||0} cliques</small></div><button className="icon-button" onClick={()=>setEditing(p)} title="Editar"><Pencil size={16}/></button><button className="icon-button" onClick={()=>moveProduct(p,-1)} title="Subir"><ChevronUp size={16}/></button><button className="icon-button" onClick={()=>moveProduct(p,1)} title="Descer"><ChevronDown size={16}/></button><button className="icon-button danger" onClick={()=>deleteProduct(p)} title="Excluir"><Trash2 size={16}/></button></div>)}</div>
          </div>}
          {tab==='categories'&&<div className="admin-section"><div className="inline-form"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nome da nova categoria"/><button className="primary" onClick={addCategory}><Plus size={15}/> Adicionar</button></div>{cats.map(c=><div className="category-row" key={c}><span>{c}</span><button className="icon-button danger" onClick={()=>removeCategory(c)}><Trash2 size={16}/></button></div>)}</div>}
          {tab==='platforms'&&<div className="admin-section"><div className="inline-form"><input value={newPlatform} onChange={e=>setNewPlatform(e.target.value)} placeholder="Ex.: Amazon, Magalu, AliExpress"/><button className="primary" onClick={addPlatform}><Plus size={15}/> Nova Plataforma</button></div><p className="muted">Mercado Livre e Shopee são as plataformas iniciais. Adicione outras quando concluir seus cadastros.</p>{platforms.map(p=><div className="category-row" key={p.id}><span><b>{p.name}</b> — {p.active?'Ativa':'Inativa'}</span><div><button className="icon-button" onClick={()=>togglePlatform(p)}>{p.active?<Eye size={15}/>:<EyeOff size={15}/>}</button><button className="icon-button danger" onClick={()=>deletePlatform(p)}><Trash2 size={15}/></button></div></div>)}</div>}
          {tab==='settings'&&<form className="admin-section" onSubmit={saveSettings}><label>E-mail de contato<input value={settings.contact_email} onChange={e=>setSettings({...settings,contact_email:e.target.value})}/></label><label>Título do banner<input value={settings.banner_title} onChange={e=>setSettings({...settings,banner_title:e.target.value})}/></label><label>Texto do banner<input value={settings.banner_text} onChange={e=>setSettings({...settings,banner_text:e.target.value})}/></label><label className="check"><input type="checkbox" checked={settings.show_prices_globally} onChange={e=>setSettings({...settings,show_prices_globally:e.target.checked})}/> Exibir preços globalmente</label><label className="check"><input type="checkbox" checked={settings.show_previous_price} onChange={e=>setSettings({...settings,show_previous_price:e.target.checked})}/> Exibir preço anterior</label><label className="check"><input type="checkbox" checked={settings.show_search} onChange={e=>setSettings({...settings,show_search:e.target.checked})}/> Exibir pesquisa</label><label className="check"><input type="checkbox" checked={settings.show_featured} onChange={e=>setSettings({...settings,show_featured:e.target.checked})}/> Mostrar destaques</label><label>Quantidade inicial de produtos<input type="number" min="5" max="100" value={settings.products_per_page} onChange={e=>setSettings({...settings,products_per_page:Number(e.target.value)})}/></label><button className="primary"><Save size={16}/> Guardar alterações</button></form>}
          {tab==='backup'&&<div className="admin-section"><h3>Backup e restauração</h3><p>Crie uma cópia dos dados do catálogo e configurações. As imagens ficam no armazenamento do Supabase.</p><button className="primary" onClick={manualBackup}><Download size={16}/> Criar backup manual</button><label>Restaurar arquivo JSON<input type="file" accept="application/json" onChange={e=>{const f=e.target.files?.[0];if(f)restoreBackup(f);}}/></label><p className="muted">A rotina automática semanal deve ser ativada com o script `supabase/backup_schedule.sql`. As imagens ficam no bucket de armazenamento.</p></div>}
          {tab==='password'&&<form className="admin-section" onSubmit={changePassword}><label>Senha atual<input name="current" type="password" required/></label><label>Nova senha<input name="next" type="password" minLength={8} required/></label><label>Confirmar nova senha<input name="confirm" type="password" minLength={8} required/></label><button className="primary"><Save size={16}/> Atualizar senha</button></form>}
        </div>}
      </div>
    </div>}
    {editing&&<div className="edit-overlay"><form className="edit-form" onSubmit={e=>{e.preventDefault();saveProduct(editing);}}><div className="edit-head"><h3>{editing.id.startsWith('demo-')?'Novo produto':'Editar produto'}</h3><button type="button" className="icon-button" onClick={()=>setEditing(null)}><X/></button></div>
      <label>Nome do produto<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} required/></label>
      <label>Descrição<textarea value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
      <label>Categoria<select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{cats.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Plataforma de afiliado<select value={editing.platform||''} onChange={e=>setEditing({...editing,platform:e.target.value})}>{platforms.filter(p=>p.active).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></label>
      <label>Link individual de afiliado<input type="url" value={editing.affiliate_url} onChange={e=>setEditing({...editing,affiliate_url:e.target.value})} placeholder="https://..."/></label>
      <div className="two-fields"><label>Preço atual<input type="number" min="0" step=".01" value={editing.price??''} onChange={e=>setEditing({...editing,price:e.target.value===''?null:Number(e.target.value)})}/></label><label>Preço anterior<input type="number" min="0" step=".01" value={(editing as any).previous_price??''} onChange={e=>setEditing({...editing,previous_price:e.target.value===''?null:Number(e.target.value)} as any)}/></label></div>
      <label className="check"><input type="checkbox" checked={editing.show_price} onChange={e=>setEditing({...editing,show_price:e.target.checked})}/> Mostrar preço</label>
      <label className="check"><input type="checkbox" checked={editing.published} onChange={e=>setEditing({...editing,published:e.target.checked})}/> Produto ativo / publicado</label>
      <label className="check"><input type="checkbox" checked={editing.featured} onChange={e=>setEditing({...editing,featured:e.target.checked})}/> Destacar na vitrine</label>
      <label>Imagem do produto<input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(f){const url=await uploadImage(f);if(url)setEditing({...editing,image_url:url});}}}/></label>
      <label>Endereço da imagem<input value={editing.image_url} onChange={e=>setEditing({...editing,image_url:e.target.value})}/></label>
      {!editing.affiliate_url&&<p className="error">Sem link de afiliado: o produto não poderá ser publicado.</p>}
      <button className="primary" disabled={loading}><Save size={16}/> {loading?'Salvando...':'Salvar produto'}</button>
    </form></div>}
    {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice} <X size={14}/></div>}
  </div>;
}
