import Peer from 'peerjs';
import { h, modal, toast } from '../ui/dom.js';
import { store } from './store.js';

/** WebRTC rooms: live avatars in the hub and Evolution. */
class Multiplayer {
  constructor() { this.peer=null; this.connections=new Map(); this.players=new Map(); this.listeners=new Map(); this.code=''; this.role=''; this.status='offline'; this.lastState=null; }
  on(type,fn){ if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); return ()=>this.listeners.get(type)?.delete(fn); }
  emit(type,data){ for(const fn of this.listeners.get(type)??[]) fn(data); }
  async host(){
    await this.disconnect(); this.status='hosting';
    for(let attempt=0;attempt<12;attempt++){
      const code=String(1000+Math.floor(Math.random()*9000)), peer=new Peer(`cb-room-${code}`,{debug:1}); this.peer=peer;
      const opened=await new Promise(resolve=>{let done=false;const finish=v=>{if(!done){done=true;resolve(v);}};peer.once('open',()=>finish(true));peer.once('error',e=>finish(e));});
      if(opened===true){this.code=code;this.role='host';this.status='connected';peer.on('connection',c=>this.#accept(c));peer.on('error',e=>this.emit('status',{status:'error',message:e.message}));this.emit('status',{status:this.status,code,role:this.role});return code;}
      peer.destroy();this.peer=null;if(opened?.type!=='unavailable-id')throw opened;
    }
    throw new Error('No se pudo reservar un código. Intenta nuevamente.');
  }
  async join(code){
    if(!/^\d{4}$/.test(code)) throw new Error('El código debe tener exactamente 4 números.');
    await this.disconnect();const peer=new Peer(undefined,{debug:1});this.peer=peer;
    await new Promise((res,rej)=>{peer.once('open',res);peer.once('error',rej);});
    const conn=peer.connect(`cb-room-${code}`,{reliable:true,serialization:'json'});
    await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(new Error('No se encontró la sala. Revisa el código.')),12000);conn.once('open',()=>{clearTimeout(timer);res();});conn.once('error',e=>{clearTimeout(timer);rej(e);});});
    this.code=code;this.role='guest';this.status='connected';this.#wire(conn);this.emit('status',{status:this.status,code,role:this.role});return code;
  }
  #accept(conn){if(this.connections.size>=8){conn.close();return;}this.#wire(conn);}
  #wire(conn){
    this.connections.set(conn.peer,conn);
    conn.on('data',msg=>{if(!msg||typeof msg!=='object')return;if(msg.type==='player-state'){const player={...msg.player,id:conn.peer};this.players.set(conn.peer,player);this.emit('player-state',player);if(this.lastState)conn.send({type:'player-state',player:this.lastState});}if(msg.type==='hello'&&this.lastState)conn.send({type:'player-state',player:this.lastState});});
    conn.on('close',()=>{this.connections.delete(conn.peer);this.players.delete(conn.peer);this.emit('player-left',{id:conn.peer});this.emit('status',{status:this.connections.size?'connected':(this.peer?'waiting':'offline'),code:this.code,role:this.role});});
    const ready=()=>{conn.send({type:'hello'});if(this.lastState)conn.send({type:'player-state',player:this.lastState});this.emit('peer-joined',{id:conn.peer});};
    conn.on('open',ready); if(conn.open) ready();
  }
  sendState(scene,position,rotation=0){if(!this.peer||!this.code)return;const player={name:store.state.name||'Player',flag:store.state.selectedBall,scene,world:scene==='evolution'?store.state.evolution.world:'hub',x:+position.x||0,y:+position.y||0,z:+position.z||0,rotation:+rotation||0};this.lastState=player;const msg={type:'player-state',player};for(const c of this.connections.values())if(c.open)c.send(msg);}
  async disconnect(){for(const c of this.connections.values())try{c.close();}catch{}this.connections.clear();this.players.clear();if(this.peer)try{this.peer.destroy();}catch{}this.peer=null;this.code='';this.role='';this.status='offline';this.lastState=null;this.emit('player-left',{all:true});this.emit('status',{status:'offline'});}
  openMenu(){
    const statusLine=h('p.mute.center',this.code?`Sala ${this.code} · ${this.connections.size} conectado(s)`:'Crea una sala o únete con un código de 4 dígitos.');
    const codeBox=h('input',{inputmode:'numeric',maxlength:'4',placeholder:'0000',autocomplete:'one-time-code',style:{width:'100%',textAlign:'center',fontSize:'28px',letterSpacing:'8px',padding:'12px',borderRadius:'12px',border:'3px solid var(--stroke)'}});
    const m=modal('🌐 Multijugador',[
      h('div.center',h('div',{style:{fontSize:'42px'}},'👥'),statusLine),
      h('button.btn.green',{style:{width:'100%',marginBottom:'10px'},onclick:async()=>{const b=m.body.querySelector('button.btn.green');b.disabled=true;b.textContent='Creando sala…';try{const code=await this.host();statusLine.textContent=`Comparte este código: ${code}`;codeBox.value=code;}catch(e){toast(e.message||'No se pudo crear la sala.','bad');}b.disabled=false;b.textContent='🔑 Crear sala (host)';}},'🔑 Crear sala (host)'),
      h('p.mute','O introduce el código de la persona que creó la sala:'),codeBox,
      h('button.btn.blue',{style:{width:'100%',marginTop:'8px'},onclick:async()=>{const b=m.body.querySelector('button.btn.blue');b.disabled=true;b.textContent='Conectando…';try{const code=await this.join(codeBox.value.trim());statusLine.textContent=`¡Conectado a la sala ${code}!`;}catch(e){toast(e.message||'No se pudo conectar.','bad');}b.disabled=false;b.textContent='➡️ Unirse a sala';}},'➡️ Unirse a sala'),
      h('p.mute.center','Hasta 8 visitantes · requiere Internet.'),
      h('button.btn.red',{style:{width:'100%'},onclick:async()=>{await this.disconnect();statusLine.textContent='Desconectado.';}},'Desconectarse')
    ]);
    const off=this.on('status',s=>{statusLine.textContent=s.status==='connected'?`Sala ${s.code} · ${this.connections.size} conectado(s)`:s.status==='waiting'?`Sala ${s.code} · esperando jugadores…`:'Sin conexión';});const close=m.close;m.close=()=>{off();close();};return m;
  }
}
export const multiplayer=new Multiplayer();
