import { useState, useEffect, useMemo } from "react";

// ---------- Servidor (Flask + MariaDB) ----------
const API="http://localhost:5001/api";
async function api(path,opts={}){
 const r=await fetch(API+path,{credentials:"include",headers:{"Content-Type":"application/json"},...opts,body:opts.body?JSON.stringify(opts.body):undefined});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.erro||"Erro "+r.status);
 return j}

// ---------- Utilidades ----------
const NOMES=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WD=["dom","seg","ter","qua","qui","sex","sáb"];
const fmt=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const money=v=>"R$ "+Number(v).toFixed(2).replace(".",",");
const ymd=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const br=s=>s.split("-").reverse().join("/");
const key=a=>a.date+String(a.start).padStart(4,"0");
const toMin=s=>{const p=s.split(":");return +p[0]*60+ +p[1]};

// agrupa dias seguidos com o mesmo horário: [["Segunda a sexta","09:00 – 19:00"], ...]
function resumoHorarios(h){
 const linhas=[];
 [1,2,3,4,5,6,0].forEach(d=>{
  const x=h.find(r=>r.dia_semana===d);
  const txt=x&&x.aberto&&x.abre&&x.fecha?x.abre+" – "+x.fecha:"Fechado";
  const ult=linhas[linhas.length-1];
  if(ult&&ult.txt===txt)ult.fim=NOMES[d];else linhas.push({ini:NOMES[d],fim:NOMES[d],txt});
 });
 return linhas.map(l=>[l.ini===l.fim?l.ini:l.ini+" a "+l.fim,l.txt])}

// converte o que vem do servidor para o formato usado nas telas
function montar(r){
 const i=r.info||{};
 const hrs={};
 for(let d=0;d<7;d++){const x=r.horarios.find(h=>h.dia_semana===d);hrs[d]=x&&x.aberto&&x.abre&&x.fecha?[toMin(x.abre),toMin(x.fecha)]:null}
 return{
  shop:{nome:i.nome||"Barbearia",fone:i.telefone||"",wa:i.whatsapp||"",end:i.endereco||""},
  serv:r.servicos.filter(s=>s.ativo).map(s=>({id:s.id,n:s.nome,p:s.preco,d:s.duracao_min,combo:s.combo,de:s.preco_original})),
  planos:r.planos.filter(p=>p.ativo).map(p=>({n:p.nome,q:p.descricao,p:p.preco_mensal,de:p.preco_original})),
  barb:r.barbeiros.filter(b=>b.ativo).map(b=>({id:b.id,n:b.nome})),
  hrs,dias:resumoHorarios(r.horarios),
  campaign:i.campanha||"",
  clients:r.clientes.map(c=>({id:c.id,name:c.nome,phone:c.telefone||"",since:(c.criado_em||"").slice(0,10)})),
  appts:r.agend.filter(a=>a.status==="agendado").map(a=>({id:a.id,serv:a.servico,price:a.preco,d:a.duracao_min,barber:a.barbeiro||"",date:a.data_hora.slice(0,10),start:toMin(a.data_hora.slice(11,16)),name:a.cliente,phone:a.telefone||""}))
 }}

function Logo(){return(
 <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true"><defs><clipPath id="c"><rect x="13" y="4" width="14" height="32" rx="7"/></clipPath></defs>
 <g clipPath="url(#c)"><rect x="13" y="4" width="14" height="32" fill="#fff"/><path d="M10 10l20-8v6l-20 8zM10 22l20-8v6l-20 8zM10 34l20-8v6l-20 8z" fill="#c8102e"/></g>
 <rect x="13" y="4" width="14" height="32" rx="7" fill="none" stroke="#fff" strokeWidth="2"/></svg>)}

// ---------- Login ----------
function Login({onLogin}){
 const [email,setEmail]=useState("");const [senha,setSenha]=useState("");
 const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 async function entrar(e){
  e.preventDefault();setErr("");setBusy(true);
  try{onLogin(await api("/login",{method:"POST",body:{email,senha}}))}
  catch(x){setErr(x.message)}
  setBusy(false)}
 return(<div style={{display:"grid",placeItems:"center",minHeight:"100vh",padding:16}}>
  <form className="card" style={{width:"100%",maxWidth:360}} onSubmit={entrar}>
   <h2 style={{marginTop:0}}>Entrar</h2>
   <label htmlFor="em" style={{marginTop:0}}>E-mail</label>
   <input id="em" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/>
   <label htmlFor="sn">Senha</label>
   <input id="sn" type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)}/>
   {err&&<p role="alert" style={{color:"#c8102e"}}>{err}</p>}
   <div className="row"><button className="btn" type="submit" disabled={busy||!email||!senha}>Entrar</button></div>
  </form></div>)}

// ---------- Telas ----------
function Dash({data,reload,go}){
 const today=ymd(new Date());
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return ymd(d)});
 const counts=days.map(d=>data.appts.filter(a=>a.date===d).length);const max=Math.max(1,...counts);
 const hoje=data.appts.filter(a=>a.date===today);
 const futuros=data.appts.filter(a=>a.date>=today);
 const prox=[...futuros].sort((a,b)=>key(a).localeCompare(key(b))).slice(0,5);
 const [cp,setCp]=useState(data.campaign);const [msg,setMsg]=useState("");
 async function salvaCampanha(){
  try{await api("/info",{method:"PUT",body:{campanha:cp}});await reload();setMsg("Campanha salva.")}
  catch(e){setMsg(e.message)}}
 return(<>
 <div className="top"><div><h1>Painel</h1><span className="muted">Resumo da {data.shop.nome}</span></div><button className="btn" onClick={()=>go("novo")}>Novo agendamento</button></div>
 <div className="kpis">
  <div className="kpi"><span>Atendimentos hoje</span><b>{hoje.length}</b></div>
  <div className="kpi"><span>Próximos 7 dias</span><b>{counts.reduce((a,b)=>a+b,0)}</b></div>
  <div className="kpi"><span>Clientes</span><b>{data.clients.length}</b></div>
  <div className="kpi"><span>Receita prevista</span><b>{money(futuros.reduce((t,a)=>t+Number(a.price),0))}</b></div></div>
 <div className="cols">
  <div className="card"><h2>Agendamentos na semana</h2><div className="chart" role="img" aria-label="Agendamentos por dia nos próximos 7 dias">
   {days.map((d,i)=><div key={d}><b>{counts[i]}</b><i style={{height:(counts[i]/max*100)+"%"}}/>{WD[new Date(d+"T00:00").getDay()]}</div>)}</div></div>
  <div className="card"><h2>Próximos atendimentos</h2>{prox.length?prox.map(a=>
   <div className="li" key={a.id}><div><strong>{fmt(a.start)}</strong> {a.name}<div className="muted">{a.serv} · {a.barber}</div></div><span className="tag">{a.date===today?"hoje":br(a.date).slice(0,5)}</span></div>)
   :<p className="muted">Nenhum atendimento marcado. Crie o primeiro em Novo agendamento.</p>}</div>
 </div>
 <div className="cols">
  <div className="card"><h2>Campanha ativa</h2><label htmlFor="cp" style={{marginTop:0}}>Texto da campanha</label>
   <input id="cp" value={cp} onChange={e=>setCp(e.target.value)}/>
   <div className="row"><button className="btn" onClick={salvaCampanha}>Salvar campanha</button>{msg&&<span className="muted">{msg}</span>}</div></div>
  <div className="card"><h2>Funcionamento</h2><table><tbody>{data.dias.map(d=><tr key={d[0]}><td>{d[0]}</td><td>{d[1]}</td></tr>)}</tbody></table></div>
 </div></>)}

function Agenda({data,reload}){
 const ap=[...data.appts].sort((a,b)=>key(a).localeCompare(key(b)));
 const cancelar=id=>api("/agendamentos/"+id,{method:"PATCH",body:{status:"cancelado"}}).then(reload).catch(e=>alert(e.message));
 return(<><div className="top"><div><h1>Agenda</h1><span className="muted">{ap.length} agendamento(s)</span></div></div>
 <div className="card">{ap.length?ap.map(a=>
  <div className="li" key={a.id}><div><strong>{br(a.date)} {fmt(a.start)}</strong> · {a.serv} com {a.barber}<div className="muted">{a.name} · {a.phone}</div></div>
  <button className="btn ghost" onClick={()=>cancelar(a.id)}>Cancelar</button></div>)
  :<p className="muted">Agenda vazia.</p>}</div></>)}

function Clientes({data}){return(<>
 <div className="top"><div><h1>Clientes</h1><span className="muted">{data.clients.length} cadastrado(s)</span></div></div>
 <div className="card">{data.clients.length?data.clients.map(c=>
  <div className="li" key={c.id}><div><strong>{c.name}</strong><div className="muted">{c.phone}{c.since?" · desde "+br(c.since):""}</div></div>
  <div className="row" style={{margin:0}}><span className="tag">{data.appts.filter(a=>a.phone===c.phone).length} visita(s)</span>
  <a className="btn alt" target="_blank" rel="noopener" href={"https://wa.me/55"+c.phone}>WhatsApp</a></div></div>)
  :<p className="muted">Os clientes aparecem aqui após o primeiro agendamento.</p>}</div></>)}

function Promos({data}){return(<>
 <div className="top"><div><h1>Promoções</h1><span className="muted">Casadinhas e planos mensais</span></div></div>
 <h2 style={{margin:"0 0 10px"}}>Casadinhas</h2>
 <div className="grid">{data.serv.filter(s=>s.combo).map(s=>{const de=s.de||s.p;return(<div className="card" key={s.id}><h2>{s.n}</h2><span className="price">{money(s.p)}</span><span className="old">{money(de)}</span><div className="muted">Economia de {money(de-s.p)} · {s.d} min</div></div>)})}</div>
 <h2 style={{margin:"22px 0 10px"}}>Planos mensais</h2>
 <div className="grid">{data.planos.map(p=><div className="card" key={p.n}><h2>{p.n}</h2><span className="price">{money(p.p)}/mês</span><span className="old">{money(p.de||p.p)}</span><div className="muted">{p.q}</div></div>)}</div></>)}

function Barbearia({data}){const SHOP=data.shop;return(<>
 <div className="top"><div><h1>Barbearia</h1><span className="muted">Contatos e serviços</span></div></div>
 <div className="cols">
  <div className="card"><h2>Contato</h2><p style={{margin:"4px 0"}}>Telefone: <a href={"tel:+"+SHOP.wa}>{SHOP.fone}</a></p><p style={{margin:"4px 0"}}>WhatsApp: {SHOP.fone}</p><p className="muted" style={{margin:"4px 0"}}>{SHOP.end}</p>
  <div className="row"><a className="btn alt" target="_blank" rel="noopener" href={"https://wa.me/"+SHOP.wa}>Abrir WhatsApp</a></div></div>
  <div className="card"><h2>Serviços e preços</h2><table><tbody>{data.serv.map(s=><tr key={s.id}><td>{s.n}</td><td>{money(s.p)}</td></tr>)}</tbody></table></div>
 </div></>)}

function Novo({data,reload,go}){
 const today=ymd(new Date());
 const [sid,setSid]=useState(data.serv[0]?data.serv[0].id:0);
 const [barber,setBarber]=useState(data.barb[0]?data.barb[0].n:"");
 const [date,setDate]=useState("");const [time,setTime]=useState(null);
 const [name,setName]=useState("");const [phone,setPhone]=useState("");
 const [done,setDone]=useState(null);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const s=data.serv.find(x=>x.id==sid);
 const slots=useMemo(()=>{
  if(!date||!s)return null;const h=data.hrs[new Date(date+"T00:00").getDay()];if(!h)return[];
  const now=new Date(),nm=now.getHours()*60+now.getMinutes(),out=[];
  for(let t=h[0];t+s.d<=h[1];t+=30){
   const busyT=data.appts.some(a=>a.barber===barber&&a.date===date&&t<a.start+a.d&&a.start<t+s.d);
   if(!busyT&&!(date===today&&t<=nm))out.push(t)}
  return out},[date,sid,barber,data.appts]);
 const ph=phone.replace(/\D/g,"");
 async function confirm(){
  setErr("");setBusy(true);
  try{
   const b=data.barb.find(x=>x.n===barber);
   const ja=data.clients.find(c=>c.phone===ph);
   const cid=ja?ja.id:(await api("/clientes",{method:"POST",body:{nome:name.trim(),telefone:ph,whatsapp:ph}})).id;
   await api("/agendamentos",{method:"POST",body:{cliente_id:cid,servico_id:s.id,barbeiro_id:b?b.id:null,data_hora:date+"T"+fmt(time)}});
   await reload();
   setDone({serv:s.n,price:s.p,barber,date,start:time,name:name.trim(),phone:ph})
  }catch(e){setErr(e.message);reload().catch(()=>{})}
  setBusy(false)}
 if(!s)return(<div className="card"><p className="muted">Cadastre ao menos um serviço para criar agendamentos.</p></div>);
 if(done)return(<div className="card"><h2>Horário reservado</h2>
  <p>{done.serv} com {done.barber} em {br(done.date)} às {fmt(done.start)}. Total: {money(done.price)}.</p>
  <div className="row"><a className="btn alt" target="_blank" rel="noopener" href={"https://wa.me/55"+done.phone+"?text="+encodeURIComponent("Olá, "+done.name+"! Seu horário na "+data.shop.nome+" está confirmado: "+done.serv+" com "+done.barber+" em "+br(done.date)+" às "+fmt(done.start)+".")}>Avisar cliente no WhatsApp</a>
  <button className="btn ghost" onClick={()=>go("dash")}>Voltar ao painel</button></div></div>);
 return(<><div className="top"><div><h1>Novo agendamento</h1><span className="muted">Escolha serviço, barbeiro e horário</span></div></div>
 <div className="card" style={{maxWidth:620}}>
  <label htmlFor="sv" style={{marginTop:0}}>Serviço</label>
  <select id="sv" value={sid} onChange={e=>{setSid(e.target.value);setTime(null)}}>{data.serv.map(x=><option key={x.id} value={x.id}>{x.n} – {money(x.p)} ({x.d} min)</option>)}</select>
  <label htmlFor="bb">Barbeiro</label>
  <select id="bb" value={barber} onChange={e=>{setBarber(e.target.value);setTime(null)}}>{data.barb.map(b=><option key={b.id}>{b.n}</option>)}</select>
  <label htmlFor="dt">Data</label>
  <input id="dt" type="date" min={today} value={date} onChange={e=>{setDate(e.target.value);setTime(null)}}/>
  {slots&&<><label>Horários livres</label>
   {slots.length?<div className="slots">{slots.map(t=><button key={t} aria-pressed={time===t} onClick={()=>setTime(t)}>{fmt(t)}</button>)}</div>
   :<p className="muted">Sem horários nesta data. Escolha outro dia (domingo fechado).</p>}</>}
  <label htmlFor="nm">Nome do cliente</label><input id="nm" value={name} onChange={e=>setName(e.target.value)}/>
  <label htmlFor="ph">WhatsApp com DDD</label><input id="ph" inputMode="tel" placeholder="(81) 90000-0000" value={phone} onChange={e=>setPhone(e.target.value)}/>
  {err&&<p role="alert" style={{color:"#c8102e"}}>{err}</p>}
  <div className="row"><button className="btn" disabled={busy||!(time!==null&&name.trim().length>1&&ph.length>=10)} onClick={confirm}>Reservar horário</button></div>
 </div></>)}

// ---------- Aplicação ----------
function App(){
 const [tab,setTab]=useState("dash");
 const [user,setUser]=useState(undefined);   // undefined = verificando, null = sem login
 const [data,setData]=useState(null);
 const [erro,setErro]=useState("");
 const reload=async()=>{
  const [info,horarios,servicos,planos,barbeiros,clientes,agend]=await Promise.all(
   ["/info","/horarios","/servicos","/planos","/barbeiros","/clientes","/agendamentos"].map(p=>api(p)));
  setData(montar({info,horarios,servicos,planos,barbeiros,clientes,agend}))};
 useEffect(()=>{api("/me").then(setUser).catch(()=>setUser(null))},[]);
 useEffect(()=>{if(user&&user.perfil==="admin")reload().catch(e=>setErro(e.message))},[user]);
 const sair=async()=>{try{await api("/logout",{method:"POST"})}catch(e){}setUser(null);setData(null);setErro("");setTab("dash")};
 const go=t=>{setTab(t);window.scrollTo(0,0)};
 const T=[["dash","Painel"],["agenda","Agenda"],["novo","Novo agendamento"],["clientes","Clientes"],["promos","Promoções"],["shop","Barbearia"]];

 if(user===undefined)return <p style={{padding:24}}>Carregando…</p>;
 if(user===null)return <Login onLogin={setUser}/>;
 if(user.perfil!=="admin")return(<div style={{display:"grid",placeItems:"center",minHeight:"100vh",padding:16}}><div className="card" style={{maxWidth:360}}>
  <h2 style={{marginTop:0}}>Acesso restrito</h2><p>Este painel é apenas para o administrador da barbearia.</p>
  <div className="row"><button className="btn" onClick={sair}>Sair</button></div></div></div>);
 if(erro)return(<div style={{display:"grid",placeItems:"center",minHeight:"100vh",padding:16}}><div className="card" style={{maxWidth:420}}>
  <h2 style={{marginTop:0}}>Não foi possível carregar os dados</h2><p>{erro}</p>
  <div className="row"><button className="btn" onClick={sair}>Sair</button></div></div></div>);
 if(!data)return <p style={{padding:24}}>Carregando dados…</p>;

 return(<div className="app">
 <aside><div className="pole"/><div className="brand"><Logo/>{data.shop.nome}</div>
  <nav aria-label="Principal">{T.map(t=><button key={t[0]} aria-current={tab===t[0]} onClick={()=>go(t[0])}>{t[1]}</button>)}
   <button onClick={sair}>Sair</button></nav>
  <div className="side-foot">{user.nome}<br/>{data.shop.fone}</div></aside>
 <main>
  {tab==="dash"&&<Dash data={data} reload={reload} go={go}/>}
  {tab==="agenda"&&<Agenda data={data} reload={reload}/>}
  {tab==="novo"&&<Novo key="n" data={data} reload={reload} go={go}/>}
  {tab==="clientes"&&<Clientes data={data}/>}
  {tab==="promos"&&<Promos data={data}/>}
  {tab==="shop"&&<Barbearia data={data}/>}
 </main></div>)}

export default App;
