import { useState, useEffect, useMemo, useRef } from "react";

// ---------- Servidor (Flask + MariaDB) ----------
const API="/api";
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
const porHora=(a,b)=>key(a).localeCompare(key(b));
const toMin=s=>{const p=s.split(":");return +p[0]*60+ +p[1]};
const digits=s=>String(s||"").replace(/\D/g,"");
const intl=n=>{const d=digits(n);return d&&d.length<=11?"55"+d:d};
const nacional=n=>digits(n).replace(/^55(?=\d{10,11}$)/,"");
// link do WhatsApp: acrescenta o 55 do Brasil quando o número vier só com DDD
const waLink=(n,txt)=>"https://wa.me/"+intl(n)+(txt?"?text="+encodeURIComponent(txt):"");
const foneFmt=n=>{const d=nacional(n);return d.length===11?`(${d.slice(0,2)})\u00a0${d.slice(2,7)}-${d.slice(7)}`:d.length===10?`(${d.slice(0,2)})\u00a0${d.slice(2,6)}-${d.slice(6)}`:n||""};
const agoraMin=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
// agendamento que já passou e ainda não recebeu baixa (concluído/cancelado)
const pendente=(a,hoje)=>a.date<hoje||(a.date===hoje&&a.start+a.d<=agoraMin());
const ini=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const extenso=d=>cap(new Date(d+"T00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"}));
const saudacao=()=>{const h=new Date().getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite"};

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
 const todos=r.agend.map(a=>({id:a.id,cid:a.cliente_id,status:a.status,serv:a.servico,price:a.preco,d:a.duracao_min,barber:a.barbeiro||"",date:a.data_hora.slice(0,10),start:toMin(a.data_hora.slice(11,16)),name:a.cliente,phone:digits(a.telefone)}));
 const hrs={};
 for(let d=0;d<7;d++){const x=r.horarios.find(h=>h.dia_semana===d);hrs[d]=x&&x.aberto&&x.abre&&x.fecha?[toMin(x.abre),toMin(x.fecha)]:null}
 return{
  shop:{nome:i.nome||"Barbearia",fone:i.telefone||"",wa:i.whatsapp||"",end:i.endereco||""},
  serv:r.servicos.filter(s=>s.ativo).map(s=>({id:s.id,n:s.nome,p:s.preco,d:s.duracao_min,combo:s.combo,de:s.preco_original})),
  planos:r.planos.filter(p=>p.ativo).map(p=>({n:p.nome,q:p.descricao,p:p.preco_mensal,de:p.preco_original})),
  barb:r.barbeiros.filter(b=>b.ativo).map(b=>({id:b.id,n:b.nome})),
  hrs,dias:resumoHorarios(r.horarios),
  campaign:i.campanha||"",
  clients:r.clientes.map(c=>({id:c.id,name:c.nome,phone:digits(c.telefone||c.whatsapp),since:(c.criado_em||"").slice(0,10)})),
  todos,
  appts:todos.filter(a=>a.status==="agendado"),
  raw:r
 }}

// ---------- Peças visuais ----------
const P={
 home:<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
 calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
 plus:<path d="M12 5v14M5 12h14"/>,
 users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
 tag:<><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/></>,
 store:<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>,
 settings:<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>,
 logout:<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>,
 clock:<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
 chat:<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>,
 check:<path d="M20 6 9 17l-5-5"/>,
 x:<path d="M18 6 6 18M6 6l12 12"/>,
 search:<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
 alert:<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
 money:<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></>,
 trend:<><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></>,
 scissors:<><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></>,
 phone:<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>,
 pin:<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
 chevL:<path d="m15 18-6-6 6-6"/>,
 chevR:<path d="m9 18 6-6-6-6"/>,
 megaphone:<><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></>,
};
const Ic=({n,s=20})=><svg className="ic" viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>;
const CORES=["var(--k1)","var(--k2)","var(--k3)","var(--k4)","var(--k5)"];
function Avatar({nome}){let h=0;for(const c of String(nome))h=(h*31+c.charCodeAt(0))>>>0;
 return <span className="av" style={{"--c":CORES[h%CORES.length]}} aria-hidden="true">{ini(nome)}</span>}
const Vazio=({ic,children})=><div className="vazio"><Ic n={ic} s={30}/><p>{children}</p></div>;
const Msg=({t})=>t?<span className={"msg"+(t.err?" err":"")} role="status"><Ic n={t.err?"alert":"check"} s={16}/>{t.t}</span>:null;
const Topo=({t,sub,children})=><div className="top"><div><h1>{t}</h1>{sub&&<p className="sub">{sub}</p>}</div>{children}</div>;
const H2=({ic,children,extra})=><div className="ch"><h2><Ic n={ic} s={18}/>{children}</h2>{extra}</div>;
// executa uma ação no servidor, recarrega os dados e mostra o resultado
function useAcao(reload){
 const [msg,setMsg]=useState(null);const [busy,setBusy]=useState(false);
 const run=async(fn,ok)=>{setMsg(null);setBusy(true);try{await fn();await reload();if(ok)setMsg({t:ok})}catch(e){setMsg({t:e.message,err:1})}setBusy(false)};
 return{msg,busy,run}}

function Logo({s=38}){return(
 <svg viewBox="0 0 40 40" width={s} height={s} aria-hidden="true"><defs><clipPath id="lg-c"><rect x="13" y="4" width="14" height="32" rx="7"/></clipPath></defs>
 <g clipPath="url(#lg-c)"><rect x="13" y="4" width="14" height="32" fill="#fff"/><path d="M10 10l20-8v6l-20 8zM10 22l20-8v6l-20 8zM10 34l20-8v6l-20 8z" fill="#c8102e"/></g>
 <rect x="13" y="4" width="14" height="32" rx="7" fill="none" stroke="#fff" strokeWidth="2"/></svg>)}

// linha de agendamento: horário em destaque, cliente e serviço
const ApRow=({a,extra,children})=>(<div className={"ap st-"+a.status}>
 <div className="hr"><b>{fmt(a.start)}</b><small>{a.d} min</small></div>
 <div className="ap-i"><strong>{a.name}</strong><span>{a.serv}{a.barber&&" · "+a.barber}{extra}</span></div>
 {children&&<div className="ap-a">{children}</div>}</div>);

// ---------- Login ----------
function Login({onLogin}){
 const [email,setEmail]=useState("");const [senha,setSenha]=useState("");
 const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const [loja,setLoja]=useState("");
 useEffect(()=>{api("/info").then(i=>setLoja(i.nome||"")).catch(()=>{})},[]);
 async function entrar(e){
  e.preventDefault();setErr("");setBusy(true);
  try{onLogin(await api("/login",{method:"POST",body:{email,senha}}))}
  catch(x){setErr(x.message)}
  setBusy(false)}
 return(<div className="login">
  <div className="login-art"><div className="pole-v" aria-hidden="true"/>
   <div className="login-txt"><Logo s={60}/><h1>{loja||"Barbearia"}</h1><p>Agenda, clientes e serviços da barbearia em um só lugar.</p></div></div>
  <div className="login-lado">
   <form className="login-form" onSubmit={entrar}>
    <div className="login-mob"><Logo s={40}/><b>{loja}</b></div>
    <h2>Entrar no painel</h2><p className="sub">Use o e-mail e a senha do administrador.</p>
    <label htmlFor="em">E-mail</label>
    <input id="em" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/>
    <label htmlFor="sn">Senha</label>
    <input id="sn" type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)}/>
    {err&&<p className="erro-box" role="alert"><Ic n="alert" s={18}/>{err}</p>}
    <button className="btn full" type="submit" disabled={busy||!email||!senha}>{busy?"Entrando…":"Entrar"}</button>
   </form></div></div>)}

// ---------- Telas ----------
function Dash({data,reload,go,user,abrirNovo}){
 const today=ymd(new Date());
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return ymd(d)});
 const counts=days.map(d=>data.appts.filter(a=>a.date===d).length);const max=Math.max(1,...counts);
 const hoje=data.appts.filter(a=>a.date===today);
 const futuros=data.appts.filter(a=>!pendente(a,today));
 const prox=[...futuros].sort(porHora).slice(0,5);
 const pend=data.appts.length-futuros.length;
 const mes=today.slice(0,7);
 const faturado=data.todos.filter(a=>a.status==="concluido"&&a.date.slice(0,7)===mes).reduce((t,a)=>t+Number(a.price),0);
 const [cp,setCp]=useState(data.campaign);const {msg,busy,run}=useAcao(reload);
 const K=[["Atendimentos hoje",hoje.length,"clock"],["Próximos 7 dias",counts.reduce((a,b)=>a+b,0),"calendar"],["Clientes",data.clients.length,"users"],
  ["Receita prevista",money(futuros.reduce((t,a)=>t+Number(a.price),0)),"trend"],["Faturado no mês",money(faturado),"money"]];
 return(<>
 <Topo t={saudacao()+", "+user.nome.split(" ")[0]} sub={extenso(today)}><button className="btn" onClick={()=>abrirNovo()}><Ic n="plus" s={18}/>Novo agendamento</button></Topo>
 {pend>0&&<div className="aviso"><Ic n="alert"/><span><b>{pend}</b> atendimento(s) já passaram e continuam como agendados.</span><button className="btn sm ghost" onClick={()=>go("agenda")}>Dar baixa</button></div>}
 <div className="kpis">{K.map(([l,v,i],n)=><div className="kpi" key={l} style={{"--c":CORES[n]}}><span className="kpi-i"><Ic n={i}/></span><div><span>{l}</span><b>{v}</b></div></div>)}</div>
 <div className="cols">
  <div className="card"><H2 ic="calendar">Agendamentos na semana</H2>
   <div className="chart" role="img" aria-label={"Agendamentos por dia nos próximos 7 dias: "+days.map((d,i)=>WD[new Date(d+"T00:00").getDay()]+" "+counts[i]).join(", ")}>
   {days.map((d,i)=><div key={d} className={i===0?"hoje":""}><b>{counts[i]}</b><div className="trk"><i style={{height:Math.max(3,counts[i]/max*100)+"%"}}/></div><span>{i===0?"hoje":WD[new Date(d+"T00:00").getDay()]}</span><small>{d.slice(8)}</small></div>)}</div></div>
  <div className="card"><H2 ic="clock" extra={<button className="lnk" onClick={()=>go("agenda")}>Ver agenda</button>}>Próximos atendimentos</H2>
   {prox.length?prox.map(a=><ApRow key={a.id} a={a}><span className={"tag"+(a.date===today?" t-hoje":"")}>{a.date===today?"Hoje":br(a.date).slice(0,5)}</span></ApRow>)
   :<Vazio ic="calendar">Nenhum atendimento marcado.</Vazio>}</div>
 </div>
 <div className="cols">
  <div className="card"><H2 ic="megaphone">Campanha ativa</H2><label htmlFor="cp" className="sr">Texto da campanha</label>
   <textarea id="cp" rows={3} maxLength={300} value={cp} onChange={e=>setCp(e.target.value)}/>
   <div className="row"><button className="btn" disabled={busy||cp===data.campaign} onClick={()=>run(()=>api("/info",{method:"PUT",body:{campanha:cp}}),"Campanha salva.")}>Salvar campanha</button><Msg t={msg}/></div></div>
  <div className="card"><H2 ic="store">Funcionamento</H2><table className="tab"><tbody>{data.dias.map(d=><tr key={d[0]}><td>{d[0]}</td><td className={d[1]==="Fechado"?"muted":""}>{d[1]}</td></tr>)}</tbody></table></div>
 </div></>)}

// botões de baixa de um agendamento (ou etiqueta do status, se já teve baixa)
function AgAcoes({a,today,conf,setConf,busy,muda}){
 if(a.status!=="agendado")return <span className={"tag st-"+a.status}>{a.status==="concluido"?"Concluído":"Cancelado"}</span>;
 const comecou=a.date<today||(a.date===today&&a.start<=agoraMin());
 return conf===a.id
  ?<div className="confirma"><span>Cancelar este horário?</span><button className="btn sm danger" disabled={busy} onClick={()=>muda(a.id,"cancelado")}>Sim, cancelar</button><button className="btn sm ghost" onClick={()=>setConf(null)}>Não</button></div>
  :<>{comecou&&<button className="btn sm ok" disabled={busy} onClick={()=>muda(a.id,"concluido")}><Ic n="check" s={16}/>Concluído</button>}
    <button className="btn sm ghost" disabled={busy} onClick={()=>setConf(a.id)}><Ic n="x" s={16}/>Cancelar</button></>}

function Agenda({data,reload,abrirNovo}){
 const today=ymd(new Date());
 const F={prox:a=>!pendente(a,today),pend:a=>pendente(a,today)};
 const nProx=data.appts.filter(F.prox).length,nPend=data.appts.length-nProx;
 const [modo,setModo]=useState("cal");
 const [mes,setMes]=useState(today.slice(0,7));
 const [sel,setSel]=useState(today);
 const [conf,setConf]=useState(null);   // id do agendamento esperando confirmação de cancelamento
 const {msg,busy,run}=useAcao(reload);
 const muda=(id,status)=>run(async()=>{await api("/agendamentos/"+id,{method:"PATCH",body:{status}});setConf(null)},status==="concluido"?"Atendimento concluído.":"Agendamento cancelado.");
 const acoes=a=><AgAcoes a={a} today={today} conf={conf} setConf={setConf} busy={busy} muda={muda}/>;
 const extra=a=><>{a.phone&&" · "+foneFmt(a.phone)} · <b className="preco">{money(a.price)}</b></>;
 const aberto=d=>!!data.hrs[new Date(d+"T00:00").getDay()];

 // calendário do mês
 const porDia=useMemo(()=>{const m={};data.todos.forEach(a=>{(m[a.date]=m[a.date]||[]).push(a)});Object.values(m).forEach(l=>l.sort(porHora));return m},[data.todos]);
 const ativos=d=>(porDia[d]||[]).filter(a=>a.status!=="cancelado");
 const [y,mm]=mes.split("-").map(Number);
 const primeiro=new Date(y,mm-1,1);
 const semanas=Math.ceil((primeiro.getDay()+new Date(y,mm,0).getDate())/7);
 const cels=[...Array(semanas*7)].map((_,i)=>ymd(new Date(y,mm-1,1-primeiro.getDay()+i)));
 const navMes=n=>setMes(ymd(new Date(y,mm-1+n,1)).slice(0,7));
 const escolhe=d=>{setSel(d);setConf(null);setMes(d.slice(0,7))};
 const doDia=porDia[sel]||[];

 // listas
 const lista=modo==="cal"?[]:data.appts.filter(F[modo]).sort(porHora);
 const grupos=[];lista.forEach(a=>{const g=grupos[grupos.length-1];if(g&&g.date===a.date)g.itens.push(a);else grupos.push({date:a.date,itens:[a]})});

 return(<><Topo t="Agenda" sub="Acompanhe os horários e dê baixa nos atendimentos"><Msg t={msg}/><button className="btn" onClick={()=>abrirNovo()}><Ic n="plus" s={18}/>Novo agendamento</button></Topo>
 <div className="chips" role="group" aria-label="Modo de exibição">{[["cal","Calendário",null],["prox","Próximos",nProx],["pend","Para dar baixa",nPend]].map(([k,n,c])=>
  <button key={k} aria-pressed={modo===k} className={k==="pend"&&nPend?"c-warn":""} onClick={()=>{setModo(k);setConf(null)}}>{k==="cal"&&<Ic n="calendar" s={16}/>}{n}{c!==null&&<em>{c}</em>}</button>)}</div>
 {modo==="cal"?<div className="cal-wrap">
  <div className="card cal">
   <div className="cal-cab">
    <button className="ico-btn" onClick={()=>navMes(-1)} aria-label="Mês anterior"><Ic n="chevL" s={18}/></button>
    <h2 aria-live="polite">{cap(primeiro.toLocaleDateString("pt-BR",{month:"long",year:"numeric"}))}</h2>
    <button className="ico-btn" onClick={()=>navMes(1)} aria-label="Próximo mês"><Ic n="chevR" s={18}/></button>
    <button className="btn sm ghost" onClick={()=>escolhe(today)}>Hoje</button></div>
   <div className="cal-g">
    {WD.map(w=><div className="cal-w" key={w} aria-hidden="true">{w}</div>)}
    {cels.map(d=>{const l=ativos(d),pen=l.some(a=>a.status==="agendado"&&pendente(a,today));
     return(<button key={d} className={"cal-d"+(d.slice(0,7)!==mes?" fora":"")+(d===today?" hj":"")+(aberto(d)?"":" fech")} aria-pressed={sel===d}
      aria-label={extenso(d)+": "+(l.length?l.length+" agendamento(s)":"sem agendamentos")} onClick={()=>escolhe(d)}>
      <span className="n">{+d.slice(8)}</span>
      {l.slice(0,3).map(a=><span key={a.id} title={fmt(a.start)+" · "+a.name+" · "+a.serv} className={"ev"+(a.status==="concluido"?" ok":pendente(a,today)?" pen":"")}>{fmt(a.start)} {a.name.split(" ")[0]}</span>)}
      {l.length>3&&<span className="mais">+{l.length-3} mais</span>}
      {l.length>0&&<span className={"qt"+(pen?" pen":"")}>{l.length}</span>}
     </button>)})}
   </div>
   <div className="leg" aria-hidden="true"><span><i className="ev"/>Agendado</span><span><i className="ev pen"/>Para dar baixa</span><span><i className="ev ok"/>Concluído</span><span><i className="lg-f"/>Fechado</span></div>
  </div>
  <section className="card dia-p" aria-label="Agendamentos do dia selecionado">
   <h3 className="dia">{sel===today?"Hoje · ":""}{extenso(sel)}</h3>
   <p className="muted">{aberto(sel)?(ativos(sel).length?ativos(sel).length+" agendamento(s)":"Nenhum agendamento"):"Barbearia fechada neste dia"}</p>
   {sel>=today&&aberto(sel)&&<button className="btn sm full" onClick={()=>abrirNovo(sel)}><Ic n="plus" s={16}/>Agendar neste dia</button>}
   {doDia.map(a=><ApRow key={a.id} a={a} extra={extra(a)}>{acoes(a)}</ApRow>)}
  </section></div>
 :grupos.length?grupos.map(g=><section className="card dia-card" key={g.date}>
  <h3 className="dia">{g.date===today?"Hoje · ":""}{extenso(g.date)}<span>{g.itens.length} horário(s)</span></h3>
  {g.itens.map(a=><ApRow key={a.id} a={a} extra={extra(a)}>{acoes(a)}</ApRow>)}</section>)
 :<div className="card"><Vazio ic={modo==="pend"?"check":"calendar"}>{modo==="pend"?"Tudo em dia! Nenhum atendimento esperando baixa.":"Nenhum agendamento futuro."}</Vazio></div>}</>)}

function Clientes({data}){
 const today=ymd(new Date());
 const [q,setQ]=useState("");
 const t=q.trim().toLowerCase(),qd=digits(q);
 const lista=data.clients.filter(c=>!t||c.name.toLowerCase().includes(t)||(qd.length>=3&&c.phone.includes(qd)));
 const visitas=id=>data.todos.filter(a=>a.cid===id&&a.status==="concluido").length;
 const proximo=id=>data.appts.filter(a=>a.cid===id&&!pendente(a,today)).sort(porHora)[0];
 return(<>
 <Topo t="Clientes" sub={data.clients.length+" cliente(s) cadastrado(s)"}/>
 <div className="busca"><Ic n="search" s={18}/><input type="search" aria-label="Buscar cliente" placeholder="Buscar por nome ou telefone" value={q} onChange={e=>setQ(e.target.value)}/></div>
 <div className="card">{lista.length?lista.map(c=>{const p=proximo(c.id),v=visitas(c.id);return(
  <div className="cli" key={c.id}><Avatar nome={c.name}/>
   <div className="cli-i"><strong>{c.name}</strong><span>{foneFmt(c.phone)}{c.since?" · desde "+br(c.since):""}</span>
    {p&&<span className="prox"><Ic n="calendar" s={14}/>Próximo: {br(p.date).slice(0,5)} às {fmt(p.start)}</span>}</div>
   <span className="tag">{v} {v===1?"visita":"visitas"}</span>
   {c.phone&&<a className="btn sm wa" target="_blank" rel="noopener" href={waLink(c.phone)} aria-label={"WhatsApp de "+c.name}><Ic n="chat" s={16}/><span>WhatsApp</span></a>}</div>)})
  :<Vazio ic="users">{q?"Nenhum cliente encontrado.":"Os clientes aparecem aqui após o primeiro agendamento."}</Vazio>}</div></>)}

function Promos({data}){
 const combos=data.serv.filter(s=>s.combo);
 const off=(p,de)=>de>p?Math.round((1-p/de)*100):0;
 return(<>
 <Topo t="Promoções" sub="Casadinhas e planos mensais"/>
 <h2 className="sec-t"><Ic n="scissors" s={18}/>Casadinhas</h2>
 {combos.length?<div className="grid">{combos.map(s=>{const de=s.de||s.p,o=off(s.p,de);return(<div className="card promo" key={s.id}>
  {o>0&&<span className="off">-{o}%</span>}<h3>{s.n}</h3>
  <div><span className="price">{money(s.p)}</span>{o>0&&<span className="old">{money(de)}</span>}</div>
  <p className="muted">{o>0?"Economia de "+money(de-s.p)+" · ":""}{s.d} min</p></div>)})}</div>
  :<div className="card"><Vazio ic="scissors">Nenhuma casadinha. Marque um serviço como casadinha em Ajustes.</Vazio></div>}
 <h2 className="sec-t"><Ic n="tag" s={18}/>Planos mensais</h2>
 {data.planos.length?<div className="grid">{data.planos.map(p=>{const o=off(p.p,p.de);return(<div className="card promo" key={p.n}>
  {o>0&&<span className="off">-{o}%</span>}<h3>{p.n}</h3>
  <div><span className="price">{money(p.p)}</span><span className="mes">/mês</span>{o>0&&<span className="old">{money(p.de)}</span>}</div>
  <p className="muted">{p.q}</p></div>)})}</div>
  :<div className="card"><Vazio ic="tag">Nenhum plano mensal ativo.</Vazio></div>}</>)}

function Barbearia({data}){const SHOP=data.shop;return(<>
 <Topo t="Barbearia" sub="Contatos e serviços · para alterar, use Ajustes"/>
 <div className="cols">
  <div className="card"><H2 ic="store">Contato</H2>
   <div className="info-l"><Ic n="phone" s={18}/><div><small>Telefone</small>{SHOP.fone?<a href={"tel:+"+intl(SHOP.fone)}>{SHOP.fone}</a>:"—"}</div></div>
   <div className="info-l"><Ic n="chat" s={18}/><div><small>WhatsApp</small>{SHOP.wa?foneFmt(SHOP.wa):"—"}</div></div>
   <div className="info-l"><Ic n="pin" s={18}/><div><small>Endereço</small>{SHOP.end||"—"}</div></div>
   {SHOP.wa&&<div className="row"><a className="btn wa" target="_blank" rel="noopener" href={waLink(SHOP.wa)}><Ic n="chat" s={18}/>Abrir WhatsApp</a></div>}</div>
  <div className="card"><H2 ic="scissors">Serviços e preços</H2><table className="tab"><tbody>{data.serv.map(s=><tr key={s.id}><td>{s.n}<small className="muted"> · {s.d} min</small></td><td><b>{money(s.p)}</b></td></tr>)}</tbody></table></div>
 </div></>)}

// janela modal (usa o <dialog> do navegador: Esc fecha e o foco fica preso dentro)
function Modal({titulo,sub,fechar,pe,children}){
 const ref=useRef(null);
 useEffect(()=>{const d=ref.current;if(d&&!d.open)d.showModal()},[]);
 const sai=()=>ref.current&&ref.current.close();
 return(<dialog ref={ref} className="modal" aria-labelledby="m-t" onClose={fechar} onClick={e=>{if(e.target===ref.current)sai()}}>
  <div className="m-cab"><div><h2 id="m-t">{titulo}</h2>{sub&&<p className="sub">{sub}</p>}</div><button className="m-x" onClick={sai} aria-label="Fechar"><Ic n="x"/></button></div>
  <div className="m-corpo">{children}</div>
  {pe&&<div className="m-pe">{pe}</div>}
 </dialog>)}

function NovoModal({data,reload,inicial,fechar}){
 const today=ymd(new Date());
 const [sid,setSid]=useState(data.serv[0]?data.serv[0].id:0);
 const [barber,setBarber]=useState(data.barb[0]?data.barb[0].n:"");
 const [date,setDate]=useState(inicial&&inicial>=today?inicial:"");const [time,setTime]=useState(null);
 const [name,setName]=useState("");const [phone,setPhone]=useState("");
 const [done,setDone]=useState(null);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const s=data.serv.find(x=>x.id==sid);
 const fechado=date&&!data.hrs[new Date(date+"T00:00").getDay()];
 const slots=useMemo(()=>{
  if(!date||!s)return null;const h=data.hrs[new Date(date+"T00:00").getDay()];if(!h)return[];
  const nm=agoraMin(),out=[];
  for(let t=h[0];t+s.d<=h[1];t+=30){
   const busyT=data.appts.some(a=>a.barber===barber&&a.date===date&&t<a.start+a.d&&a.start<t+s.d);
   if(!busyT&&!(date===today&&t<=nm))out.push(t)}
  return out},[date,sid,barber,data.appts]);
 const ph=nacional(phone);
 const ja=ph.length>=10?data.clients.find(c=>nacional(c.phone)===ph):null;
 const nome=ja?ja.name:name.trim();
 const pronto=s&&time!==null&&nome.length>1&&ph.length>=10;
 async function confirm(){
  setErr("");setBusy(true);
  try{
   const b=data.barb.find(x=>x.n===barber);
   const cid=ja?ja.id:(await api("/clientes",{method:"POST",body:{nome,telefone:ph,whatsapp:ph}})).id;
   await api("/agendamentos",{method:"POST",body:{cliente_id:cid,servico_id:s.id,barbeiro_id:b?b.id:null,data_hora:date+"T"+fmt(time)}});
   await reload();
   setDone({serv:s.n,price:s.p,barber,date,start:time,name:nome,phone:ph})
  }catch(e){setErr(e.message);reload().catch(()=>{})}
  setBusy(false)}
 if(!s)return(<Modal titulo="Novo agendamento" fechar={fechar}><Vazio ic="scissors">Cadastre ao menos um serviço em Ajustes para criar agendamentos.</Vazio></Modal>);
 if(done)return(<Modal titulo="Horário reservado" fechar={fechar} pe={<><span className="pe-r"/><button className="btn ghost" onClick={fechar}>Fechar</button>
  <a className="btn wa" target="_blank" rel="noopener" href={waLink(done.phone,"Olá, "+done.name+"! Seu horário na "+data.shop.nome+" está confirmado: "+done.serv+(done.barber?" com "+done.barber:"")+" em "+br(done.date)+" às "+fmt(done.start)+".")}><Ic n="chat" s={18}/>Avisar no WhatsApp</a></>}>
  <div className="sucesso"><span className="ok-ic"><Ic n="check" s={32}/></span>
  <p><b>{done.name}</b> · {done.serv}{done.barber&&" com "+done.barber}<br/>{extenso(done.date)} às {fmt(done.start)} · {money(done.price)}</p></div></Modal>);
 return(<Modal titulo="Novo agendamento" sub="Escolha serviço, barbeiro e horário" fechar={fechar} pe={<>
  <div className="pe-r" role="status">{err?<span className="erro-t"><Ic n="alert" s={16}/>{err}</span>
   :time!==null&&date?<><b>{money(s.p)}</b><span>{br(date).slice(0,5)} · {fmt(time)} – {fmt(time+s.d)}{nome&&" · "+nome}</span></>
   :<span>{time===null?"Escolha a data e um horário livre.":"Informe o WhatsApp e o nome do cliente."}</span>}</div>
  <button className="btn ghost m-cancela" onClick={fechar}>Cancelar</button>
  <button className="btn" disabled={busy||!pronto} onClick={confirm}>{busy?"Reservando…":"Reservar"}</button></>}>
 <div className="novo">
 <div>
  <div className="passo"><span>1</span>Serviço e barbeiro</div>
  <div className="form2">
   <div><label htmlFor="sv">Serviço</label>
   <select id="sv" value={sid} onChange={e=>{setSid(e.target.value);setTime(null)}}>{data.serv.map(x=><option key={x.id} value={x.id}>{x.n} – {money(x.p)} ({x.d} min)</option>)}</select></div>
   {data.barb.length>0&&<div><label htmlFor="bb">Barbeiro</label>
   <select id="bb" value={barber} onChange={e=>{setBarber(e.target.value);setTime(null)}}>{data.barb.map(b=><option key={b.id}>{b.n}</option>)}</select></div>}</div>
  <div className="passo"><span>2</span>Data e horário</div>
  <label htmlFor="dt">Data</label>
  <input id="dt" type="date" min={today} value={date} onChange={e=>{setDate(e.target.value);setTime(null)}}/>
  {slots&&<><label>Horários livres</label>
   {slots.length?<div className="slots">{slots.map(t=><button key={t} aria-pressed={time===t} onClick={()=>setTime(t)}>{fmt(t)}</button>)}</div>
   :<p className="muted">{fechado?"A barbearia não abre neste dia.":"Não há horários livres nesta data."} Escolha outro dia.</p>}</>}
  <div className="passo"><span>3</span>Cliente</div>
  <div className="form2">
   <div><label htmlFor="ph">WhatsApp com DDD</label><input id="ph" inputMode="tel" placeholder="(81) 90000-0000" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
   {!ja&&<div><label htmlFor="nm">Nome do cliente</label><input id="nm" value={name} onChange={e=>setName(e.target.value)}/></div>}</div>
  {ja&&<div className="ja"><Avatar nome={ja.name}/><span>Cliente já cadastrado: <b>{ja.name}</b></span></div>}
 </div>
 <aside className="resumo" aria-label="Resumo do agendamento"><H2 ic="calendar">Resumo</H2>
  <dl>
   <dt>Serviço</dt><dd>{s.n}<small>{s.d} min</small></dd>
   {barber&&<><dt>Barbeiro</dt><dd>{barber}</dd></>}
   <dt>Data</dt><dd>{date?extenso(date):<span className="muted">—</span>}</dd>
   <dt>Horário</dt><dd>{time!==null?fmt(time)+" – "+fmt(time+s.d):<span className="muted">—</span>}</dd>
   <dt>Cliente</dt><dd>{nome||<span className="muted">—</span>}</dd>
  </dl>
  <div className="total"><span>Total</span><b>{money(s.p)}</b></div>
 </aside></div></Modal>)}

// ---------- Ajustes ----------
function Ajustes({data,reload}){return(<>
 <Topo t="Ajustes" sub="Dados da barbearia, horários, serviços e barbeiros"/>
 <AjInfo data={data} reload={reload}/><AjHorarios data={data} reload={reload}/>
 <AjServicos data={data} reload={reload}/><AjBarbeiros data={data} reload={reload}/></>)}

function AjInfo({data,reload}){
 const i=data.raw.info||{};
 const [f,setF]=useState({nome:i.nome||"",telefone:i.telefone||"",whatsapp:foneFmt(i.whatsapp),endereco:i.endereco||""});
 const {msg,busy,run}=useAcao(reload);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 return(<div className="card sec"><H2 ic="store">Dados da barbearia</H2>
  <div className="form2">
   <div><label htmlFor="in">Nome</label><input id="in" value={f.nome} onChange={set("nome")}/></div>
   <div><label htmlFor="it">Telefone</label><input id="it" inputMode="tel" value={f.telefone} onChange={set("telefone")}/></div>
   <div><label htmlFor="iw">WhatsApp com DDD</label><input id="iw" inputMode="tel" value={f.whatsapp} onChange={set("whatsapp")}/></div>
   <div><label htmlFor="ie">Endereço</label><input id="ie" value={f.endereco} onChange={set("endereco")}/></div></div>
  <div className="row"><button className="btn" disabled={busy||!f.nome.trim()} onClick={()=>run(()=>api("/info",{method:"PUT",body:{...f,nome:f.nome.trim(),whatsapp:intl(f.whatsapp)}}),"Dados salvos.")}>Salvar dados</button><Msg t={msg}/></div></div>)}

function AjHorarios({data,reload}){
 const [h,setH]=useState(()=>[1,2,3,4,5,6,0].map(d=>{const x=data.raw.horarios.find(r=>r.dia_semana===d)||{};return{dia_semana:d,aberto:x.aberto?1:0,abre:x.abre||"09:00",fecha:x.fecha||"19:00"}}));
 const {msg,busy,run}=useAcao(reload);
 const muda=(d,k,v)=>setH(h.map(x=>x.dia_semana===d?{...x,[k]:v}:x));
 return(<div className="card sec"><H2 ic="clock">Horário de funcionamento</H2>
  {h.map(x=><div className="hora" key={x.dia_semana}>
   <label className="chk"><input type="checkbox" checked={!!x.aberto} onChange={e=>muda(x.dia_semana,"aberto",e.target.checked?1:0)}/>{NOMES[x.dia_semana]}</label>
   {x.aberto?<span className="hora-in"><input type="time" aria-label={"Abre "+NOMES[x.dia_semana]} value={x.abre} onChange={e=>muda(x.dia_semana,"abre",e.target.value)}/>às<input type="time" aria-label={"Fecha "+NOMES[x.dia_semana]} value={x.fecha} onChange={e=>muda(x.dia_semana,"fecha",e.target.value)}/></span>:<span className="tag">Fechado</span>}
  </div>)}
  <div className="row"><button className="btn" disabled={busy} onClick={()=>run(()=>api("/horarios",{method:"PUT",body:h.map(x=>x.aberto?x:{...x,abre:null,fecha:null})}),"Horários salvos.")}>Salvar horários</button><Msg t={msg}/></div></div>)}

function AjServicos({data,reload}){const lista=data.raw.servicos;return(
 <div className="card sec"><H2 ic="scissors">Serviços e casadinhas</H2>
  <p className="muted nota">Serviços desativados somem do agendamento, mas continuam no histórico. Marque "Casadinha" nos combos e informe o preço sem desconto.</p>
  {lista.map(s=><ServLinha key={s.id} s={s} reload={reload}/>)}
  <ServLinha key={"novo"+lista.length} s={null} reload={reload}/></div>)}

function ServLinha({s,reload}){
 const novo=!s,id=s?"s"+s.id:"snovo";
 const [f,setF]=useState(s?{nome:s.nome,preco:s.preco,duracao_min:s.duracao_min,combo:s.combo?1:0,preco_original:s.preco_original??"",ativo:s.ativo?1:0}
  :{nome:"",preco:"",duracao_min:30,combo:0,preco_original:"",ativo:1});
 const {msg,busy,run}=useAcao(reload);
 const set=(k,v)=>setF({...f,[k]:v});
 const ok=f.nome.trim()&&Number(f.preco)>0&&Number(f.duracao_min)>=5;
 const body={...f,nome:f.nome.trim(),preco:Number(f.preco),duracao_min:Number(f.duracao_min),preco_original:f.combo&&f.preco_original!==""?Number(f.preco_original):null};
 return(<div className={"ed"+(f.ativo?"":" off")+(novo?" novo":"")}>
  <div className="ed-n"><label htmlFor={id+"n"}>{novo?"Novo serviço":"Nome"}</label><input id={id+"n"} placeholder={novo?"Ex.: Pigmentação":""} value={f.nome} onChange={e=>set("nome",e.target.value)}/></div>
  <div><label htmlFor={id+"p"}>Preço (R$)</label><input id={id+"p"} type="number" min="0" step="0.01" value={f.preco} onChange={e=>set("preco",e.target.value)}/></div>
  <div><label htmlFor={id+"d"}>Duração (min)</label><input id={id+"d"} type="number" min="5" step="5" value={f.duracao_min} onChange={e=>set("duracao_min",e.target.value)}/></div>
  {f.combo?<div><label htmlFor={id+"o"}>Preço sem desconto</label><input id={id+"o"} type="number" min="0" step="0.01" value={f.preco_original} onChange={e=>set("preco_original",e.target.value)}/></div>:null}
  <div className="ed-chk"><label className="chk"><input type="checkbox" checked={!!f.combo} onChange={e=>set("combo",e.target.checked?1:0)}/>Casadinha</label>
   {!novo&&<label className="chk"><input type="checkbox" checked={!!f.ativo} onChange={e=>set("ativo",e.target.checked?1:0)}/>Ativo</label>}</div>
  <div className="ed-ac"><button className={"btn"+(novo?"":" ghost")} disabled={busy||!ok} onClick={()=>run(()=>novo?api("/servicos",{method:"POST",body}):api("/servicos/"+s.id,{method:"PUT",body}),novo?"":"Salvo.")}>{novo?<><Ic n="plus" s={16}/>Adicionar</>:"Salvar"}</button><Msg t={msg}/></div>
 </div>)}

function AjBarbeiros({data,reload}){
 const [nome,setNome]=useState("");const {msg,busy,run}=useAcao(reload);
 return(<div className="card sec"><H2 ic="users">Barbeiros</H2>
  <p className="muted nota">Barbeiros desativados somem do agendamento, mas o histórico continua.</p>
  {data.raw.barbeiros.map(b=><div className={"cli"+(b.ativo?"":" off")} key={b.id}><Avatar nome={b.nome}/><div className="cli-i"><strong>{b.nome}</strong>{!b.ativo&&<span>Desativado</span>}</div>
   <button className="btn sm ghost" disabled={busy} onClick={()=>run(()=>api("/barbeiros/"+b.id,{method:"PUT",body:{ativo:b.ativo?0:1}}))}>{b.ativo?"Desativar":"Reativar"}</button></div>)}
  <div className="row fim"><div className="cresce"><label htmlFor="nb">Novo barbeiro</label><input id="nb" value={nome} onChange={e=>setNome(e.target.value)}/></div>
   <button className="btn" disabled={busy||!nome.trim()} onClick={()=>run(async()=>{await api("/barbeiros",{method:"POST",body:{nome:nome.trim()}});setNome("")},"Barbeiro adicionado.")}><Ic n="plus" s={16}/>Adicionar</button></div>
  <Msg t={msg}/></div>)}

// ---------- Aplicação ----------
const Centro=({children})=><div className="centro-tela">{children}</div>;
const Carregando=({t})=><Centro><div className="carregando"><span className="spin" aria-hidden="true"/>{t}</div></Centro>;

function App(){
 const [tab,setTab]=useState("dash");
 const [user,setUser]=useState(undefined);   // undefined = verificando, null = sem login
 const [data,setData]=useState(null);
 const [erro,setErro]=useState("");
 const [novo,setNovo]=useState(null);   // null = modal fechado; {date} = aberto
 const abrirNovo=(date="")=>setNovo({date});
 const reload=async()=>{
  const [info,horarios,servicos,planos,barbeiros,clientes,agend]=await Promise.all(
   ["/info","/horarios","/servicos","/planos","/barbeiros","/clientes","/agendamentos"].map(p=>api(p)));
  setData(montar({info,horarios,servicos,planos,barbeiros,clientes,agend}))};
 useEffect(()=>{api("/me").then(setUser).catch(()=>setUser(null))},[]);
 useEffect(()=>{if(user&&user.perfil==="admin")reload().catch(e=>setErro(e.message))},[user]);
 const sair=async()=>{try{await api("/logout",{method:"POST"})}catch(e){}setUser(null);setData(null);setErro("");setTab("dash")};
 const go=t=>{setTab(t);window.scrollTo(0,0)};
 const T=[["dash","Painel","home","Painel"],["agenda","Agenda","calendar","Agenda"],["novo","Novo agendamento","plus","Novo"],["clientes","Clientes","users","Clientes"],
  ["promos","Promoções","tag","Promos"],["shop","Barbearia","store","Loja"],["ajustes","Ajustes","settings","Ajustes"]];

 if(user===undefined)return <Carregando t="Carregando…"/>;
 if(user===null)return <Login onLogin={setUser}/>;
 if(user.perfil!=="admin")return(<Centro><div className="card caixa">
  <h2>Acesso restrito</h2><p>Este painel é apenas para o administrador da barbearia.</p>
  <button className="btn" onClick={sair}>Sair</button></div></Centro>);
 if(erro)return(<Centro><div className="card caixa">
  <h2>Não foi possível carregar os dados</h2><p className="erro-box"><Ic n="alert" s={18}/>{erro}</p>
  <div className="row"><button className="btn" onClick={()=>{setErro("");reload().catch(e=>setErro(e.message))}}>Tentar de novo</button><button className="btn ghost" onClick={sair}>Sair</button></div></div></Centro>);
 if(!data)return <Carregando t="Carregando dados…"/>;
 const pend=data.appts.filter(a=>pendente(a,ymd(new Date()))).length;

 return(<div className="app">
 <aside className="side"><div className="pole"/>
  <div className="brand"><Logo/><span>{data.shop.nome}</span></div>
  <nav aria-label="Principal">{T.map(([k,n,i,c])=><button key={k} className={k==="novo"?"nv-novo":""} aria-current={tab===k?"page":undefined} onClick={()=>k==="novo"?abrirNovo():go(k)}>
   <Ic n={i}/><span className="l">{n}</span><span className="s">{c}</span>{k==="agenda"&&pend>0&&<em className="badge" aria-label={pend+" pendentes"}>{pend}</em>}</button>)}</nav>
  <div className="side-user"><Avatar nome={user.nome}/><div className="su-t"><b>{user.nome}</b><small>Administrador</small></div>
   <button className="ico-btn" onClick={sair} title="Sair" aria-label="Sair"><Ic n="logout" s={18}/></button></div>
 </aside>
 <main>
  {tab==="dash"&&<Dash data={data} reload={reload} go={go} user={user} abrirNovo={abrirNovo}/>}
  {tab==="agenda"&&<Agenda data={data} reload={reload} abrirNovo={abrirNovo}/>}
  {tab==="clientes"&&<Clientes data={data}/>}
  {tab==="promos"&&<Promos data={data}/>}
  {tab==="shop"&&<Barbearia data={data}/>}
  {tab==="ajustes"&&<Ajustes data={data} reload={reload}/>}
 </main>
 {novo&&<NovoModal data={data} reload={reload} inicial={novo.date} fechar={()=>setNovo(null)}/>}
 </div>)}

export default App;
