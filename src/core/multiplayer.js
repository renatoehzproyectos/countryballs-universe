import Peer from 'peerjs';
import { h, modal, toast } from '../ui/dom.js';
import { store } from './store.js';

// Same public PeerJS signaling endpoint and WebRTC ICE relay setup used by
// RocketPrismas. The signaling server only matches room IDs; gameplay data
// travels peer-to-peer over the WebRTC data channel.
const PEER_CONFIG = {
  debug: 2,
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

const ROOM_PREFIX = 'cb';
const CONNECT_TIMEOUT = 20000;
const MAX_VISITORS = 8;

function peerIdFromCode(code) {
  return ROOM_PREFIX + String(code).replace(/\D/g, '').slice(0, 4);
}

function waitFor(emitter, event, timeout, message) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      emitter.off?.(event, onSuccess);
      emitter.off?.('error', onError);
    };
    const onSuccess = value => { cleanup(); resolve(value); };
    const onError = error => { cleanup(); reject(error instanceof Error ? error : new Error(error?.message || String(error))); };
    emitter.on(event, onSuccess);
    emitter.on('error', onError);
    timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, timeout);
  });
}

class Multiplayer {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.players = new Map();
    this.listeners = new Map();
    this.code = '';
    this.role = '';
    this.status = 'offline';
    this.lastState = null;
    this.hostReady = false;
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }

  emit(type, data) {
    for (const fn of this.listeners.get(type) ?? []) {
      try { fn(data); } catch (error) { console.error('[multiplayer]', error); }
    }
  }

  async host() {
    await this.disconnect();
    this.status = 'hosting';
    let lastError = null;

    // Like RocketPrismas: reserve a deterministic Peer ID derived from the
    // room code. Do not show the code until the signaling server confirms it.
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      const peer = new Peer(peerIdFromCode(code), PEER_CONFIG);
      this.peer = peer;

      // Register incoming connections immediately, before waiting for "open".
      peer.on('connection', conn => this.#accept(conn));
      peer.on('disconnected', () => {
        if (this.peer !== peer) return;
        this.status = 'error';
        this.emit('status', { status: 'error', message: 'Se perdió la conexión con el servidor de salas. Comprueba Internet.' });
      });

      try {
        await waitFor(
          peer,
          'open',
          CONNECT_TIMEOUT,
          'El servidor de salas no respondió. Comprueba tu conexión e inténtalo otra vez.'
        );
        this.code = code;
        this.role = 'host';
        this.status = 'waiting';
        this.hostReady = true;
        this.emit('status', { status: 'waiting', code, role: 'host' });
        return code;
      } catch (error) {
        lastError = error;
        try { peer.destroy(); } catch {}
        if (this.peer === peer) this.peer = null;
        // Retry only when the generated ID is already occupied.
        if (error?.type !== 'unavailable-id') break;
      }
    }

    this.status = 'error';
    throw lastError || new Error('No se pudo crear la sala.');
  }

  async join(rawCode) {
    const code = String(rawCode ?? '').trim();
    if (!/^\d{4}$/.test(code)) {
      throw new Error('El código debe tener exactamente 4 números.');
    }

    await this.disconnect();
    this.status = 'connecting';
    this.emit('status', { status: 'connecting', code });

    const peer = new Peer(PEER_CONFIG);
    this.peer = peer;

    try {
      await waitFor(
        peer,
        'open',
        CONNECT_TIMEOUT,
        'No se pudo conectar al servidor de salas. Comprueba tu conexión a Internet.'
      );

      const conn = peer.connect(peerIdFromCode(code), {
        reliable: true,
        serialization: 'json',
      });

      // Listen for the room handshake before waiting for the channel to open.
      // This avoids losing a fast host acknowledgement.
      const accepted = new Promise((resolve, reject) => {
        let timer;
        const cleanup = () => {
          clearTimeout(timer);
          conn.off('data', onData);
          conn.off('close', onClose);
          conn.off('error', onError);
        };
        const onData = message => {
          if (message?.type === 'room-accepted' && message.code === code) {
            cleanup();
            resolve(true);
          } else if (message?.type === 'room-rejected') {
            cleanup();
            reject(new Error(message.message || 'La sala rechazó la conexión.'));
          }
        };
        const onClose = () => { cleanup(); reject(new Error('El anfitrión cerró la sala.')); };
        const onError = error => { cleanup(); reject(new Error(error?.message || 'Error al conectar con el anfitrión.')); };
        conn.on('data', onData);
        conn.on('close', onClose);
        conn.on('error', onError);
        timer = setTimeout(() => {
          cleanup();
          reject(new Error('El anfitrión no respondió. Comprueba que siga dentro de la sala y vuelve a intentarlo.'));
        }, CONNECT_TIMEOUT + 10000);
      });

      await waitFor(
        conn,
        'open',
        CONNECT_TIMEOUT,
        'No se encontró la sala. Comprueba el código y que el anfitrión haya creado la sala correctamente.'
      );
      await accepted;

      this.code = code;
      this.role = 'guest';
      this.status = 'connected';
      this.#wire(conn);
      this.emit('status', { status: 'connected', code, role: 'guest' });
      return code;
    } catch (error) {
      try { peer.destroy(); } catch {}
      if (this.peer === peer) this.peer = null;
      this.code = '';
      this.role = '';
      this.status = 'error';
      throw error;
    }
  }

  #accept(conn) {
    if (!this.hostReady || this.connections.size >= MAX_VISITORS) {
      conn.on('open', () => {
        try {
          conn.send({
            type: 'room-rejected',
            message: this.hostReady ? `La sala está llena (máximo ${MAX_VISITORS} visitantes).` : 'El anfitrión todavía está preparando la sala.',
          });
        } finally {
          setTimeout(() => conn.close(), 100);
        }
      });
      return;
    }

    // Host acknowledges the room on data-channel open, as in RocketPrismas.
    conn.on('open', () => {
      try {
        conn.send({ type: 'room-accepted', code: this.code });
        this.#wire(conn);
      } catch (error) {
        console.error('[multiplayer] no se pudo aceptar visitante', error);
        conn.close();
      }
    });
  }

  #wire(conn) {
    if (this.connections.has(conn.peer)) return;
    this.connections.set(conn.peer, conn);

    conn.on('data', message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'player-state' && message.player) {
        const player = { ...message.player, id: conn.peer };
        this.players.set(conn.peer, player);
        this.emit('player-state', player);
        if (this.lastState && conn.open) {
          conn.send({ type: 'player-state', player: this.lastState });
        }
      }
      if (message.type === 'hello' && this.lastState && conn.open) {
        conn.send({ type: 'player-state', player: this.lastState });
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.players.delete(conn.peer);
      this.emit('player-left', { id: conn.peer });
      this.emit('status', {
        status: this.role === 'host' ? 'waiting' : (this.connections.size ? 'connected' : 'offline'),
        code: this.code,
        role: this.role,
      });
    });

    conn.on('error', error => {
      console.error('[multiplayer] data channel error', error);
      this.emit('status', { status: 'error', message: 'Se produjo un error en la conexión.' });
    });

    // Exchange initial presence after the host acceptance has been sent.
    if (conn.open) {
      conn.send({ type: 'hello' });
      if (this.lastState) conn.send({ type: 'player-state', player: this.lastState });
    }
    this.emit('peer-joined', { id: conn.peer });
  }

  sendState(scene, position, rotation = 0) {
    if (!this.peer || !this.code) return;
    const player = {
      name: store.state.name || 'Player',
      flag: store.state.selectedBall,
      scene,
      world: scene === 'evolution' ? store.state.evolution.world : 'hub',
      x: Number(position.x) || 0,
      y: Number(position.y) || 0,
      z: Number(position.z) || 0,
      rotation: Number(rotation) || 0,
    };
    this.lastState = player;
    const message = { type: 'player-state', player };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try { conn.send(message); } catch (error) { console.warn('[multiplayer] send failed', error); }
      }
    }
  }

  async disconnect() {
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch {}
    }
    this.connections.clear();
    this.players.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
    }
    this.peer = null;
    this.code = '';
    this.role = '';
    this.status = 'offline';
    this.lastState = null;
    this.hostReady = false;
    this.emit('player-left', { all: true });
    this.emit('status', { status: 'offline' });
  }

  openMenu() {
    const statusLine = h('p.mute.center',
      this.code ? `Sala ${this.code} · ${this.connections.size} conectado(s)` :
      'Crea una sala o únete con un código de 4 dígitos.'
    );
    const codeBox = h('input', {
      inputmode: 'numeric',
      maxlength: '4',
      pattern: '[0-9]{4}',
      placeholder: '0000',
      autocomplete: 'one-time-code',
      style: { width: '100%', textAlign: 'center', fontSize: '28px', letterSpacing: '8px', padding: '12px', borderRadius: '12px', border: '3px solid var(--stroke)' },
    });
    codeBox.addEventListener('input', () => {
      codeBox.value = codeBox.value.replace(/\D/g, '').slice(0, 4);
    });

    const m = modal('🌐 Multijugador', [
      h('div.center', h('div', { style: { fontSize: '42px' } }, '👥'), statusLine),
      h('button.btn.green', {
        style: { width: '100%', marginBottom: '10px' },
        onclick: async () => {
          const button = m.body.querySelector('button.btn.green');
          button.disabled = true;
          button.textContent = 'Reservando sala…';
          try {
            const code = await this.host();
            statusLine.textContent = `Sala lista. Comparte el código: ${code}`;
            codeBox.value = code;
          } catch (error) {
            toast(error.message || 'No se pudo crear la sala.', 'bad');
            statusLine.textContent = error.message || 'No se pudo crear la sala.';
          }
          button.disabled = false;
          button.textContent = '🔑 Crear sala (host)';
        },
      }, '🔑 Crear sala (host)'),
      h('p.mute', 'O introduce el código de la persona que creó la sala:'),
      codeBox,
      h('button.btn.blue', {
        style: { width: '100%', marginTop: '8px' },
        onclick: async () => {
          const button = m.body.querySelector('button.btn.blue');
          button.disabled = true;
          button.textContent = 'Conectando…';
          try {
            const code = await this.join(codeBox.value);
            statusLine.textContent = `¡Conectado a la sala ${code}!`;
          } catch (error) {
            toast(error.message || 'No se pudo conectar.', 'bad');
            statusLine.textContent = error.message || 'No se pudo conectar.';
          }
          button.disabled = false;
          button.textContent = '➡️ Unirse a sala';
        },
      }, '➡️ Unirse a sala'),
      h('p.mute.center', 'Hasta 8 visitantes · ambos jugadores necesitan Internet.'),
      h('button.btn.red', {
        style: { width: '100%' },
        onclick: async () => {
          await this.disconnect();
          statusLine.textContent = 'Desconectado.';
        },
      }, 'Desconectarse'),
    ]);

    const off = this.on('status', state => {
      if (state.status === 'waiting') statusLine.textContent = `Sala ${state.code} · esperando visitantes…`;
      else if (state.status === 'connected') statusLine.textContent = `Sala ${state.code} · ${this.connections.size} visitante(s) conectado(s)`;
      else if (state.status === 'connecting') statusLine.textContent = `Conectando a la sala ${state.code}…`;
      else if (state.status === 'error') statusLine.textContent = state.message || 'Error de conexión.';
      else if (state.status === 'offline') statusLine.textContent = 'Sin conexión.';
    });
    const close = m.close;
    m.close = () => { off(); close(); };
    return m;
  }
}

export const multiplayer = new Multiplayer();
