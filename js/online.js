// Online rooms: each player on their own phone or iPad, joined with a 5-letter code.
//
// How the phones stay in step: every phone runs the same game from the same starting state, and every
// random thing comes from a seeded generator inside that state. So the only things phones have to send
// each other are human choices (roll, buy, bid, build, trade...). Those go into a list per turn, and the
// room message on the relay always holds the state at the start of the current turn plus that list.
// A phone that reloads or rejoins starts from that state and replays the list without animation.
import { TOKENS, BOT_NAMES } from './data.js';
import { newState } from './engine.js';
import { tokenSVG, icon } from './art.js';
import { sfx } from './audio.js';
import { openRoom, makeCode, cleanCode, CODE_LENGTH } from './net.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const ROOM_KEY = 'pm-room', PROFILE_KEY = 'pm-online';
const MAX_SEATS = 6;
const never = () => new Promise(() => {});

// This device's id, so a phone gets its own seat back after a reload.
const me = (() => {
  let id = store.get('pm-dev');
  if (!id) { id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set('pm-dev', id); }
  return id;
})();

export const savedRoom = () => store.get(ROOM_KEY)?.code || null;

// ---------- keeping a game in step ----------
export class Sync {
  constructor(conn, doc) {
    this.conn = conn; this.code = conn.code;
    this.info = { host: doc.host, seats: doc.seats, settings: doc.settings };
    this.buf = new Map();   // turn number -> list of choices made in that turn
    this.waiters = [];
    this.k = 1; this.i = 0; this.snapTn = 0; this.snap = null;
    this.g = null; this.onResync = null; this.dead = false; this.latest = doc;
    this.buf.set(doc.game.tn + 1, doc.game.acts.slice());
  }

  mine(p) { return p.dev === me; }

  // Called by the engine at the start of every turn, before the turn counter goes up.
  turnStart() {
    const s = this.g.s;
    this.snapTn = s.tn || 0; this.k = this.snapTn + 1; this.i = 0;
    this.snap = JSON.parse(JSON.stringify(s));
    this.snap.log = this.snap.log.slice(0, 30);
    for (const key of [...this.buf.keys()]) if (key < this.k) this.buf.delete(key);
  }

  acts() { let a = this.buf.get(this.k); if (!a) this.buf.set(this.k, (a = [])); return a; }

  push(e) {
    if (this.dead) return; // a replaced copy of the game must never write to the room
    const a = this.acts();
    a.push(e); this.i = a.length;
    this.conn.state({ v: 1, ...this.info, phase: 'game', game: { tn: this.snapTn, snap: this.snap, acts: a } });
  }

  // Something this phone's player did mid-turn (build, trade...). The engine applies it right after.
  record(o) { this.push({ o }); }

  async decide(p, ask, label) {
    for (;;) {
      if (this.dead || this.g.stopped) return never();
      const a = this.acts();
      if (this.i < a.length) {
        const e = a[this.i++];
        if ('o' in e) { await this.g.applyAct(e.o); continue; }
        return e.v;
      }
      if (this.g.ui.ff) this.g.ui.ff = false; // caught up with the room
      if (this.mine(p)) {
        const v = await ask();
        if (this.dead || this.g.stopped) return never();
        this.push({ v });
        return v;
      }
      if (this.behind()) return never();
      this.g.ui.waiting(p, true, label);
      await new Promise((r) => this.waiters.push(r));
    }
  }

  // The room has moved past a turn this phone is still waiting on: it missed messages while offline.
  // Start over from the room's latest state.
  behind() {
    if (![...this.buf.keys()].some((k) => k > this.k) || this.i < this.acts().length) return false;
    this.dead = true;
    this.onResync?.(this.latest);
    return true;
  }

  receive(doc) {
    if (this.dead || doc.phase !== 'game' || !doc.game) return;
    this.latest = doc;
    const k = doc.game.tn + 1;
    if (k < this.k) return;
    const cur = this.buf.get(k);
    if (!cur || doc.game.acts.length > cur.length) this.buf.set(k, doc.game.acts);
    const w = this.waiters; this.waiters = [];
    w.forEach((r) => r());
  }

  stop() { this.dead = true; const w = this.waiters; this.waiters = []; w.forEach((r) => r()); }
  gameOver() { store.del(ROOM_KEY); }
}

// ---------- rooms and lobby ----------
let hooks = null;            // { show, home, startGame }
let conn = null, doc = null, sync = null;
let joined = false, joinTimer = null, findTimer = null;
let profile = store.get(PROFILE_KEY) || { name: '', token: 'jeepney' };

export function initOnline(h) { hooks = h; }

function resetRoom() {
  clearInterval(joinTimer); clearTimeout(findTimer);
  sync?.stop(); sync = null;
  conn?.close(); conn = null; doc = null; joined = false;
}

const handlers = {
  onState: (msg) => onState(msg),
  onAsk: (msg) => onAsk(msg),
  onStatus: (up) => hooks.status?.(up),
};

async function connect(code) {
  resetRoom();
  try { conn = await openRoom(code, handlers); return true; }
  catch { openOnline(code, 'Couldn’t reach the game relay. Check your connection.'); return false; }
}

// ---------- the "Play online" screen ----------
export function openOnline(code = '', msg = '') {
  hooks.show('setup');
  const ui = $('#setup-ui');
  const t = TOKENS.find((x) => x.id === profile.token) || TOKENS[0];
  ui.innerHTML = `
    <header class="setup-head"><button class="icon-btn" id="o-back" aria-label="Back">${icon('close')}</button><h1>Play online</h1><span></span></header>
    <div class="setup-scroll">
      <p class="on-intro">Everyone plays on their own phone or iPad. One of you makes a room and shares the code.</p>
      <h3>You</h3>
      <div class="prow solo" style="--pc:${t.color}">
        <button class="ptok" id="o-tok" aria-label="Change token">${tokenSVG(t.id)}<small>${t.name}</small></button>
        <input class="pname" id="o-name" value="${esc(profile.name)}" placeholder="Your name" maxlength="14" autocomplete="off" autocapitalize="words" enterkeyhint="done">
      </div>
      <button class="btn primary big on-create" id="o-create">${icon('plus')}<span>Create a room</span></button>
      <h3>Join a friend</h3>
      <div class="on-join"><input id="o-code" class="code-in" value="${esc(cleanCode(code))}" placeholder="CODE" maxlength="${CODE_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go"><button class="btn" id="o-join"><span>Join</span></button></div>
      <p class="on-msg" id="o-msg">${esc(msg)}</p>
    </div>`;
  const saveName = () => { profile.name = $('#o-name').value.trim(); store.set(PROFILE_KEY, profile); };
  $('#o-back').onclick = () => { sfx.tap(); resetRoom(); hooks.home(); };
  $('#o-name').oninput = saveName;
  $('#o-tok').onclick = () => {
    sfx.tap();
    const i = TOKENS.findIndex((x) => x.id === profile.token);
    profile.token = TOKENS[(i + 1) % TOKENS.length].id; saveName();
    openOnline($('#o-code').value, $('#o-msg').textContent);
  };
  $('#o-code').oninput = (e) => { e.target.value = cleanCode(e.target.value); };
  $('#o-code').onkeydown = (e) => { if (e.key === 'Enter') $('#o-join').click(); };
  $('#o-create').onclick = () => { sfx.tap(); saveName(); createRoom(); };
  $('#o-join').onclick = () => { sfx.tap(); saveName(); joinRoom(cleanCode($('#o-code').value)); };
}

function busy(text) {
  const m = $('#o-msg'); if (m) m.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ${esc(text)}`;
  document.querySelectorAll('#o-create,#o-join').forEach((b) => { b.disabled = true; });
}

const myName = () => profile.name || 'Player';

async function createRoom() {
  busy('Making a room…');
  const code = makeCode();
  if (!(await connect(code))) return;
  const last = store.get('pm-setup')?.settings;
  doc = {
    v: 1, host: me, phase: 'lobby',
    seats: [{ dev: me, name: myName(), token: profile.token }],
    settings: { startCash: 15000, rounds: 30, auctions: true, pot: false, ...(last || {}) },
  };
  joined = true;
  store.set(ROOM_KEY, { code });
  publishLobby();
  renderLobby();
}

export async function joinRoom(code) {
  if (code.length !== CODE_LENGTH) { openOnline(code, `Room codes have ${CODE_LENGTH} letters.`); return; }
  if (!$('#o-msg')) openOnline(code);
  busy('Looking for the room…');
  if (!(await connect(code))) return;
  const ask = () => conn?.ask({ t: 'join', dev: me, name: myName(), token: profile.token });
  ask();
  // The host may be away for a moment sharing the code, and asks aren't stored, so keep asking.
  joinTimer = setInterval(ask, 1500);
  findTimer = setTimeout(() => { if (!doc) { resetRoom(); openOnline(code, 'Couldn’t find that room. Check the code.'); } }, 9000);
}

function fail(text) {
  const code = conn?.code || '';
  resetRoom();
  store.del(ROOM_KEY);
  openOnline(code, text);
}

function onState(msg) {
  if (sync) { sync.receive(msg); return; }
  doc = msg;
  clearTimeout(findTimer);
  const seat = msg.seats?.find((s) => s.dev === me);
  if (msg.phase === 'closed') return fail('The host closed the room.');
  if (msg.phase === 'game') {
    if (!seat) return fail('That game already started without you.');
    clearInterval(joinTimer);
    store.set(ROOM_KEY, { code: conn.code });
    return startFromDoc(msg, msg.game.tn > 0 || msg.game.acts.length > 0);
  }
  if (seat) {
    if (!joined) { joined = true; clearInterval(joinTimer); store.set(ROOM_KEY, { code: conn.code }); sfx.good(); }
    renderLobby();
  } else if (joined) fail('You were removed from the room.');
  else if (msg.seats.length >= MAX_SEATS) fail('That room is full.');
}

// Only the host changes the lobby; everyone else asks.
function onAsk(msg) {
  if (!doc || doc.host !== me || doc.phase !== 'lobby') return;
  if (msg.t === 'join') {
    const seat = doc.seats.find((s) => s.dev === msg.dev);
    if (seat) { seat.name = msg.name; publishLobby(); renderLobby(); return; } // their ask arrived again
    if (doc.seats.length >= MAX_SEATS) return;
    const used = new Set(doc.seats.map((s) => s.token));
    const token = used.has(msg.token) ? TOKENS.find((t) => !used.has(t.id)).id : msg.token;
    doc.seats.push({ dev: msg.dev, name: String(msg.name || 'Player').slice(0, 14), token });
    sfx.coin();
  } else if (msg.t === 'leave') {
    doc.seats = doc.seats.filter((s) => s.dev !== msg.dev);
  } else return;
  publishLobby();
  renderLobby();
}

function publishLobby() { conn.state(doc); }

let lobbySig = '';
function renderLobby() {
  hooks.show('setup');
  const ui = $('#setup-ui');
  // The relay echoes every change back; only redraw when something changed, so taps don't get lost.
  const sig = JSON.stringify([conn.code, doc]);
  if (sig === lobbySig && $('#l-leave', ui)) return;
  lobbySig = sig;
  const isHost = doc.host === me;
  const humans = doc.seats.filter((s) => !s.cpu).length;
  const st = doc.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-val='${JSON.stringify(v)}'>${l}</button>`).join('')}</div>`;
  const summary = [`₱${st.startCash.toLocaleString('en-US')} each`, st.rounds ? `${st.rounds} rounds` : 'Classic length', st.auctions ? 'auctions' : 'no auctions', st.pot ? 'Merienda pot' : ''].filter(Boolean).join(' · ');
  const scroll = $('.setup-scroll', ui)?.scrollTop || 0;
  ui.innerHTML = `
    <header class="setup-head"><button class="icon-btn" id="l-leave" aria-label="Leave room">${icon('close')}</button><h1>Room</h1><span></span></header>
    <div class="setup-scroll">
      <div class="room-card">
        <small>Room code</small>
        <div class="room-code">${[...conn.code].map((c) => `<span>${c}</span>`).join('')}</div>
        <button class="btn" id="l-share">${icon('trade')}<span>Share invite</span></button>
      </div>
      <h3>Players <small>${doc.seats.length} of ${MAX_SEATS}</small></h3>
      <div class="plist">${doc.seats.map((s) => {
        const t = TOKENS.find((x) => x.id === s.token);
        const tag = s.cpu ? 'CPU' : s.dev === doc.host ? 'Host' : '';
        const canKick = isHost && s.dev !== me;
        return `<div class="prow lob ${s.dev === me ? 'me' : ''}" style="--pc:${t.color}">
          <span class="ptok">${tokenSVG(s.token)}<small>${t.name}</small></span>
          <div class="lname"><b>${esc(s.name)}${s.dev === me ? ' <em>(you)</em>' : ''}</b>${tag ? `<small>${tag}</small>` : ''}</div>
          ${canKick ? `<button class="prem" data-kick="${esc(s.dev)}" aria-label="Remove">${icon('close')}</button>` : '<span class="prem-ph"></span>'}
        </div>`;
      }).join('')}</div>
      ${isHost && doc.seats.length < MAX_SEATS ? `<button class="btn ghost add" id="l-cpu">${icon('bot')}<span>Add a CPU player</span></button>` : ''}
      ${humans < 2 ? `<p class="on-msg wait"><span class="dots"><i></i><i></i><i></i></span> Waiting for a friend to join with code <b>${conn.code}</b></p>` : ''}
      ${isHost ? `
        <h3>Starting cash</h3>${seg('startCash', [[10000, '₱10,000'], [15000, '₱15,000'], [20000, '₱20,000']])}
        <h3>Game length</h3>${seg('rounds', [[0, 'Classic'], [30, '30 rounds'], [15, '15 rounds']])}
        <h3>House rules</h3>
        <label class="tog"><input type="checkbox" id="l-auc" ${st.auctions ? 'checked' : ''}><span class="sw"></span><span><b>Auctions</b><small>Lots nobody buys go to the highest bidder</small></span></label>
        <label class="tog"><input type="checkbox" id="l-pot" ${st.pot ? 'checked' : ''}><span class="sw"></span><span><b>Merienda pot</b><small>Taxes and fines pile up. Land on Merienda to grab them.</small></span></label>`
      : `<h3>Rules</h3><p class="on-rules">${summary}</p>`}
    </div>
    <footer class="setup-foot">${isHost
      ? `<button class="btn primary big" id="l-start" ${humans < 2 ? 'disabled' : ''}>${icon('speed')}<span>${humans < 2 ? 'Waiting for a friend…' : 'Start game'}</span></button>`
      : `<div class="lobby-wait"><span class="dots"><i></i><i></i><i></i></span> Waiting for ${esc(doc.seats.find((s) => s.dev === doc.host)?.name || 'the host')} to start</div>`}</footer>`;
  $('.setup-scroll', ui).scrollTop = scroll;

  $('#l-leave').onclick = () => { sfx.tap(); leaveLobby(); };
  $('#l-share').onclick = () => { sfx.tap(); share(); };
  if (!isHost) return;
  ui.querySelectorAll('[data-kick]').forEach((b) => b.onclick = () => {
    sfx.tap(); doc.seats = doc.seats.filter((s) => s.dev !== b.dataset.kick); publishLobby(); renderLobby();
  });
  $('#l-cpu')?.addEventListener('click', () => {
    sfx.tap();
    const used = new Set(doc.seats.map((s) => s.token));
    const name = BOT_NAMES.find((n) => !doc.seats.some((s) => s.name === n)) || 'CPU';
    doc.seats.push({ dev: `cpu-${Date.now().toString(36)}`, cpu: true, name, token: TOKENS.find((t) => !used.has(t.id)).id });
    publishLobby(); renderLobby();
  });
  ui.querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.onclick = () => {
    sfx.tap(); doc.settings[sg.dataset.key] = JSON.parse(b.dataset.val); publishLobby(); renderLobby();
  }));
  $('#l-auc').onchange = (e) => { doc.settings.auctions = e.target.checked; publishLobby(); };
  $('#l-pot').onchange = (e) => { doc.settings.pot = e.target.checked; publishLobby(); };
  $('#l-start').onclick = () => { sfx.tap(); startRoomGame(); };
}

async function share() {
  const url = `${location.origin}${location.pathname}?room=${conn.code}`;
  const text = `Play Polymono Manila with me! Room code: ${conn.code}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Polymono Manila', text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      const b = $('#l-share span'); b.textContent = 'Link copied!';
      setTimeout(() => { if (b.isConnected) b.textContent = 'Share invite'; }, 1800);
    }
  } catch {} // closing the share sheet counts as an error; nothing to do
}

function leaveLobby() {
  if (doc?.host === me) conn.state({ ...doc, phase: 'closed' });
  else conn?.ask({ t: 'leave', dev: me });
  const old = conn; conn = null;
  setTimeout(() => old?.close(), 400);
  resetRoom();
  store.del(ROOM_KEY);
  openOnline();
}

function startRoomGame() {
  const humans = doc.seats.filter((s) => !s.cpu).length;
  if (doc.host !== me || humans < 2) return;
  const state = newState({
    settings: { ...doc.settings },
    players: doc.seats.map((s) => ({ name: s.name, token: s.token, color: TOKENS.find((t) => t.id === s.token).color, human: !s.cpu, dev: s.cpu ? undefined : s.dev })),
  });
  const g = { ...doc, phase: 'game', game: { tn: 0, snap: state, acts: [] } };
  conn.state(g);
  onState(g);
}

function startFromDoc(d, ff) {
  sync?.stop();
  sync = new Sync(conn, d);
  sync.onResync = (latest) => setTimeout(() => startFromDoc(latest, true), 0);
  hooks.startGame(JSON.parse(JSON.stringify(d.game.snap)), sync, { ff });
}

// Rejoin the room this phone was last in (after a reload, or from the home screen).
export function rejoin() {
  const code = savedRoom();
  if (!code) return;
  openOnline(code);
  joinRoom(code);
}

// Leaving a running game: the seat stays, so the player can rejoin from home.
export function leaveGame() { resetRoom(); }
export function endGame() { resetRoom(); store.del(ROOM_KEY); }
