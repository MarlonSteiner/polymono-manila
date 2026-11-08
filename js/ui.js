// Everything the player sees and taps during a game.
import { BOARD, GROUPS, GROUP_TILES, STATIONS, UTILITIES, STATION_RENT, JAIL_FINE, peso } from './data.js';
import { tokenSVG, tileIcon, deckArt, icon, C } from './art.js';
import { BoardView } from './board.js';
import { sfx, isMuted, setMuted } from './audio.js';
import * as AI from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const first = (n) => esc(n.split(' ')[0]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const layer = () => $('#layer');

// ---------- generic bottom sheet ----------
export function sheet({ title = '', sub = '', body = '', actions = [], cls = '', dismiss = true, mount = null }) {
  return new Promise((resolve) => {
    const w = document.createElement('div');
    w.className = `sheet-wrap ${cls}`;
    w.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>${title ? `<header class="sh-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</header>` : ''}
      <div class="sb">${body}</div>${actions.length ? `<div class="acts">${actions.map(btnHTML).join('')}</div>` : ''}</div>`;
    layer().appendChild(w);
    requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
    window.dispatchEvent(new Event('sheetchange'));
    let done = false;
    const close = (v) => {
      if (done) return; done = true;
      w.classList.remove('in'); w.classList.add('out');
      setTimeout(() => { w.remove(); window.dispatchEvent(new Event('sheetchange')); }, 320);
      resolve(v);
    };
    w.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b && !b.disabled) { sfx.tap(); close(b.dataset.v); return; }
      if (dismiss && e.target.classList.contains('scrim')) close(null);
    });
    mount?.(w.querySelector('.sheet'), close);
  });
}
export function btnHTML(a) {
  return `<button class="btn ${a.kind || ''}" data-v="${a.v}" ${a.disabled ? 'disabled' : ''}>${a.icon ? icon(a.icon) : ''}<span>${a.label}</span>${a.note ? `<small>${a.note}</small>` : ''}</button>`;
}

export function toast(msg, type = 'calm') {
  const host = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.innerHTML = msg;
  host.prepend(t);
  while (host.children.length > 3) host.lastChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

export function confetti(n = 90) {
  const colors = ['#e2584f', '#f2c443', '#4a86d6', '#5fb46a', '#ee93b4', '#9b7ed8', '#f3a24f'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--d:${1.6 + Math.random() * 1.6}s;--x:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.4}s;${Math.random() > 0.5 ? 'border-radius:50%' : ''}`;
    box.appendChild(c);
  }
  layer().appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

// ---------- deed card ----------
export function deedHTML(g, i) {
  const t = BOARD[i], o = g.s.own[i];
  const owner = o && o.owner !== null ? g.s.players[o.owner] : null;
  const color = t.group ? GROUPS[t.group].color : t.type === 'station' ? '#9b7ed8' : t.type === 'utility' ? '#7fcbe0' : '#e9dcc3';
  let rows = '';
  const cell = (label, v, on) => `<div class="rc ${on ? 'on' : ''}"><small>${label}</small><b>${v}</b></div>`;
  if (t.type === 'prop') {
    const H = GROUPS[t.group].house, cur = o.houses, full = owner && g.hasGroup(owner.id, t.group);
    rows = `<div class="rgrid">${cell('Rent', peso(t.rent[0]), owner && !cur && !full)}${cell('Full set', peso(t.rent[0] * 2), owner && !cur && full)}
      ${[1, 2, 3, 4].map((n) => cell(`${n} condo${n > 1 ? 's' : ''}`, peso(t.rent[n]), cur === n)).join('')}
      ${cell('Tower', peso(t.rent[5]), cur === 5)}${cell('Mortgage', peso(t.price / 2), false)}</div>
      <div class="dd"><span>🏠 Condos ${peso(H)} each</span><span>🏙️ Tower after 4 condos</span></div>`;
  } else if (t.type === 'station') {
    const n = owner ? STATIONS.filter((j) => g.s.own[j].owner === owner.id).length : 0;
    rows = `<div class="rgrid">${STATION_RENT.map((v, k) => cell(`${k + 1} line${k ? 's' : ''}`, peso(v), n === k + 1)).join('')}</div>
      <div class="dd"><span>Rent depends on how many lines the owner has</span><span>Mortgage ${peso(t.price / 2)}</span></div>`;
  } else if (t.type === 'utility') {
    const n = owner ? UTILITIES.filter((j) => g.s.own[j].owner === owner.id).length : 0;
    rows = `<div class="rgrid two">${cell('Own 1', '40 × dice', n === 1)}${cell('Own both', '100 × dice', n === 2)}</div>
      <div class="dd"><span>Mortgage ${peso(t.price / 2)}</span></div>`;
  }
  const look = t.look || { swerte: 'swerte', bayanihan: 'bayanihan', tax: t.name === 'Skyway Toll' ? 'toll' : 'tax' }[t.type];
  const status = owner ? `<div class="owner-line" style="--pc:${owner.color}"><span class="mini">${tokenSVG(owner.token, { shadow: false })}</span>Owned by <b>${esc(owner.name)}</b>${o.mortgaged ? ' · <em>mortgaged</em>' : ''}</div>`
    : o ? `<div class="owner-line free">For sale · ${peso(t.price)}</div>` : '';
  return `<div class="deed" style="--gc:${color}">
    <div class="deed-top">${look ? `<div class="deed-art">${tileIcon(look, t.group)}</div>` : ''}<div><small>${t.group ? GROUPS[t.group].name : t.type === 'station' ? 'Transit line' : t.type === 'utility' ? 'Utility' : ''}</small><h3>${esc(t.name)}</h3></div></div>
    <p class="blurb">${esc(t.blurb || '')}</p>${rows}${status}</div>`;
}

const diceFace = (n) => {
  const on = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
  return `<div class="face f${n}">${Array.from({ length: 9 }, (_, k) => `<i class="${on.includes(k + 1) ? 'p' : ''}"></i>`).join('')}</div>`;
};
const DIE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };

export class UI {
  constructor(root) { this.root = root; this.speed = 1.4; try { this.speed = +localStorage.getItem('pm-speed') || 1.4; } catch {} }

  attach(game, hooks) {
    this.g = game; this.hooks = hooks;
    const r = this.root;
    r.innerHTML = `
      <header id="hud"><div class="chips"></div><button class="icon-btn" id="btn-menu" aria-label="Menu">${icon('menu')}</button></header>
      <main id="stage-wrap"><div id="stage"></div>
        <div class="turn-banner"></div>
        <button class="fab" id="btn-cam" aria-label="Toggle map">${icon('map')}</button>
        <div class="pot-pill" hidden></div>
        <div id="dice"><div class="die d1"><div class="cube">${[1, 2, 3, 4, 5, 6].map(diceFace).join('')}</div></div><div class="die d2"><div class="cube">${[1, 2, 3, 4, 5, 6].map(diceFace).join('')}</div></div><div class="dsum"></div></div>
      </main>
      <aside id="side-log"><h4>${icon('log')} Game log</h4><ol></ol></aside>
      <footer id="dock"></footer>`;
    this.board = new BoardView($('#stage', r), game, { onTile: (i) => this.openTile(i) });
    this.board.speed = this.speed;
    this.dieRot = [[0, 0, 0], [0, 0, 0]];
    $('#btn-menu', r).onclick = () => { sfx.tap(); this.openMenu(); };
    $('#btn-cam', r).onclick = () => {
      sfx.tap();
      const m = this.board.mode === 'follow' ? 'overview' : 'follow';
      this.board.setMode(m);
      $('#btn-cam', r).innerHTML = icon(m === 'follow' ? 'map' : 'follow');
      $('#btn-cam', r).classList.toggle('on', m === 'overview');
    };
    $('#hud .chips', r).onclick = (e) => { const c = e.target.closest('.chip'); if (c) { sfx.tap(); this.openPlayer(+c.dataset.pid); } };
    this.renderHud(true);
    this.renderLog();
  }

  // ---------- engine hooks ----------
  render() { this.board.render(); this.renderHud(); }
  pause(ms) { return sleep(ms / this.speed); }
  onLog() { this.renderLog(); }

  beginTurn(p) {
    this.board.focusPid = p.id; this.board.focusPos = null;
    this.render(); this.board.applyCamera();
    const b = $('.turn-banner', this.root);
    b.innerHTML = `<span class="mini" style="--pc:${p.color}">${tokenSVG(p.token, { shadow: false })}</span><span><b>${esc(p.name)}</b>${p.human ? '’s turn' : ' is playing'}</span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    if (!p.human) this.dock({ status: `<span class="dots"><i></i><i></i><i></i></span> ${esc(p.name)} is thinking` });
  }

  async preRoll(p, { jail = false, again = false } = {}) {
    if (jail) {
      const opts = [{ v: 'roll', label: 'Roll for doubles', kind: 'primary', icon: 'speed' }];
      opts.push({ v: 'pay', label: `Pay ${peso(JAIL_FINE)}`, disabled: this.g.liquidity(p.id) < JAIL_FINE });
      if (p.passes.length) opts.push({ v: 'card', label: 'Angkas Pass', kind: 'gold' });
      return this.dock({ status: `🚦 Stuck in EDSA Traffic · try ${p.jail} of 3`, main: opts, p });
    }
    return this.dock({ main: [{ v: 'roll', label: again ? 'Roll again' : 'Roll', kind: 'primary roll', icon: 'speed' }], p, tools: true });
  }

  async postRoll(p) {
    await this.dock({ main: [{ v: 'end', label: 'End turn', kind: 'primary', icon: 'check' }], p, tools: true });
  }

  // Bottom action dock. Resolves with the chosen main action.
  dock({ status = '', main = [], p = null, tools = false }) {
    const d = $('#dock', this.root);
    d.innerHTML = `${status ? `<div class="dock-status">${status}</div>` : ''}
      <div class="dock-row">${tools ? `<button class="tool" data-t="assets">${icon('building')}<span>Assets</span></button>` : ''}
      <div class="dock-main">${main.map(btnHTML).join('')}</div>
      ${tools ? `<button class="tool" data-t="trade">${icon('trade')}<span>Trade</span></button>` : ''}</div>`;
    d.classList.toggle('waiting', !main.length);
    if (!main.length) return Promise.resolve();
    return new Promise((res) => {
      d.onclick = (e) => {
        const t = e.target.closest('[data-t]');
        if (t && p) { sfx.tap(); return t.dataset.t === 'assets' ? this.openAssets(p) : this.openTrade(p); }
        const b = e.target.closest('[data-v]');
        if (!b || b.disabled) return;
        d.onclick = null; sfx.tap();
        d.innerHTML = ''; d.classList.add('waiting');
        res(b.dataset.v);
      };
    });
  }

  async roll(p, dice, label = '') {
    const box = $('#dice', this.root);
    box.classList.remove('settled'); box.classList.add('rolling');
    $('.dsum', box).textContent = label;
    sfx.dice();
    box.querySelectorAll('.die').forEach((el, k) => {
      const [ax, ay] = DIE_ROT[dice[k]], r = this.dieRot[k];
      r[0] = Math.ceil(r[0] / 360) * 360 + 720 + ax; r[1] = Math.ceil(r[1] / 360) * 360 + 360 * (k + 1) + ay; r[2] = (Math.random() - 0.5) * 24;
      el.querySelector('.cube').style.transform = `rotateZ(${r[2]}deg) rotateX(${r[0]}deg) rotateY(${r[1]}deg)`;
    });
    await sleep(p.human ? 1000 : 800);
    box.classList.remove('rolling'); box.classList.add('settled');
    $('.dsum', box).innerHTML = `${dice[0] + dice[1]}${dice[0] === dice[1] ? ' <em>doubles!</em>' : ''}`;
    sfx.land();
    await this.pause(350);
  }

  async animateMove(p, from, steps) {
    await this.board.hop(p, from, steps, (k) => sfx.hop(k));
    sfx.land();
  }

  async toJail(p) {
    sfx.horn();
    toast(`🚨 ${esc(p.name)} is stuck in EDSA Traffic!`, 'warn');
    await this.board.glide(p, 10, true);
  }

  toast(msg, type) { toast(msg, type); if (type === 'good') sfx.good(); }

  onMoney(pid, delta, why) {
    const chip = $(`.chip[data-pid="${pid}"]`, this.root);
    if (chip) {
      const f = document.createElement('span');
      f.className = `float ${delta >= 0 ? 'up' : 'down'}`;
      f.textContent = (delta >= 0 ? '+' : '−') + peso(Math.abs(delta)).slice(0);
      chip.appendChild(f);
      setTimeout(() => f.remove(), 1400);
    }
    if (delta > 0 && why !== 'bankrupt') sfx.coin(); else if (delta < 0) sfx.pay();
    this.renderHud();
    this.updatePot();
  }

  onBuild(i, pid) { sfx.build(); this.board.pulseTile(i); this.render(); }
  onTrade(t) { sfx.good(); this.render(); toast(`🤝 Deal between ${first(this.g.s.players[t.from].name)} and ${first(this.g.s.players[t.to].name)}!`, 'good'); }

  async rentNotice(p, owner, i, rent) {
    this.board.pulseTile(i, 'flash-rent');
    toast(`<span class="dotc" style="--pc:${p.color}"></span>${first(p.name)} pays <b>${peso(rent)}</b> rent to ${first(owner.name)}`, 'warn');
    await this.pause(650);
  }

  async notice(p, title, text, i) {
    if (i !== undefined) this.board.pulseTile(i);
    toast(`<b>${esc(title)}</b> · ${esc(text)}`, 'calm');
    await this.pause(700);
  }

  async offerBuy(p, i) {
    const t = BOARD[i], g = this.g;
    let note = '';
    if (t.group) {
      const others = GROUP_TILES[t.group].filter((j) => j !== i);
      if (others.every((j) => g.s.own[j].owner === p.id)) note = `<div class="hint good">✨ Completes your ${GROUPS[t.group].name} set. Rent doubles!</div>`;
      else if (others.some((j) => g.s.own[j].owner === p.id)) note = `<div class="hint">You already own part of ${GROUPS[t.group].name}.</div>`;
    }
    const v = await sheet({
      body: deedHTML(g, i) + note + `<div class="wallet">Your cash <b>${peso(p.cash)}</b> → <b>${peso(p.cash - t.price)}</b></div>`,
      actions: [{ v: 'no', label: g.s.settings.auctions ? 'Auction it' : 'Pass' }, { v: 'yes', label: `Buy for ${peso(t.price)}`, kind: 'primary' }],
      dismiss: false, cls: 'buy',
    });
    return v === 'yes';
  }

  async cantAfford(p, i) {
    toast(`Not enough cash for ${esc(BOARD[i].name)} (${peso(BOARD[i].price)}).`, 'warn');
    await this.pause(900);
  }

  async onBought(p, i) {
    sfx.buy();
    this.board.pulseTile(i, 'bought');
    this.render();
    toast(`<span class="dotc" style="--pc:${p.color}"></span>${first(p.name)} bought <b>${esc(BOARD[i].name)}</b>`, 'good');
    await this.pause(600);
  }

  async showCard(p, deck, card) {
    sfx.card();
    const w = document.createElement('div');
    w.className = 'card-pop';
    w.innerHTML = `<div class="card ${deck}"><div class="card-head">${deckArt(deck)}<b>${deck === 'swerte' ? 'Swerte' : 'Bayanihan'}</b></div>
      <p>${esc(card.text)}</p>${p.human ? '<button class="btn primary" data-ok>Okay!</button>' : `<small>${esc(p.name)}</small>`}</div>`;
    layer().appendChild(w);
    requestAnimationFrame(() => w.classList.add('in'));
    await new Promise((res) => {
      let t = p.human ? null : setTimeout(res, 2300 / this.speed);
      w.onclick = (e) => { if (!p.human || e.target.closest('[data-ok]')) { clearTimeout(t); sfx.tap(); res(); } };
    });
    w.classList.add('out');
    setTimeout(() => w.remove(), 350);
    await sleep(200);
  }

  async onBankrupt(p, to) {
    sfx.bad();
    this.render();
    await sheet({ title: `${esc(p.name)} is bankrupt`, sub: to ? `Everything goes to ${esc(to.name)}.` : 'Their lots go back to the bank.', body: `<div class="big-token sad">${tokenSVG(p.token)}</div>`, actions: [{ v: 'ok', label: 'Okay', kind: 'primary' }], dismiss: false });
  }

  async cannotPay(p, amount) {
    await sheet({ title: 'Out of pesos', sub: `You owe ${peso(amount)} and can’t raise enough, even selling and mortgaging everything.`, body: `<div class="big-token sad">${tokenSVG(p.token)}</div>`, actions: [{ v: 'ok', label: 'Declare bankruptcy', kind: 'danger' }], dismiss: false });
  }

  async raiseFunds(p, amount, toId) {
    const to = toId !== null ? this.g.s.players[toId].name : 'the bank';
    return this.openAssets(p, { owe: amount, to });
  }

  async tradeOffer(t) {
    const A = this.g.s.players[t.from], B = this.g.s.players[t.to];
    const v = await sheet({
      title: `${esc(A.name)} wants to trade`, sub: `Offer for ${esc(B.name)}`,
      body: this.tradeSummary(t), dismiss: false,
      actions: [{ v: 'no', label: 'No thanks' }, { v: 'yes', label: 'Accept', kind: 'primary' }],
    });
    return v === 'yes';
  }

  // ---------- auction ----------
  async auction(i) {
    const g = this.g, t = BOARD[i];
    const order = []; const n = g.s.players.length;
    for (let k = 0; k < n; k++) { const q = g.s.players[(g.s.turn + k) % n]; if (!q.bankrupt) order.push(q); }
    const out = new Set(); let high = 0, by = null;
    sfx.gavel();
    let host, closeFn;
    const done = sheet({
      title: `Auction · ${esc(t.name)}`, sub: `List price ${peso(t.price)}`, dismiss: false, cls: 'auction',
      body: `<div class="auc"><div class="auc-art">${tileIcon(t.look, t.group)}</div><div class="auc-bid"><small>Highest bid</small><b class="hb">—</b><span class="hby"></span></div></div><div class="auc-players"></div><div class="auc-ctrl"></div>`,
      mount: (el, close) => { host = el; closeFn = close; },
    });
    const paint = (turnId, msg = '') => {
      $('.hb', host).textContent = high ? peso(high) : '—';
      $('.hby', host).textContent = by ? `by ${g.s.players[by].name}` : 'No bids yet';
      $('.auc-players', host).innerHTML = order.map((q) => `<span class="ap ${out.has(q.id) ? 'out' : ''} ${q.id === turnId ? 'now' : ''} ${q.id === by ? 'lead' : ''}" style="--pc:${q.color}"><span class="mini">${tokenSVG(q.token, { shadow: false })}</span>${first(q.name)}</span>`).join('');
      if (msg) $('.auc-ctrl', host).innerHTML = `<div class="auc-msg">${msg}</div>`;
    };
    await sleep(60);
    let idx = 0, guard = 600;
    while (guard--) {
      const live = order.filter((q) => !out.has(q.id));
      if (!live.length || (by !== null && live.length === 1 && live[0].id === by)) break;
      const q = order[idx++ % order.length];
      if (out.has(q.id) || q.id === by) continue;
      const min = high + (high < 1000 ? 50 : 100);
      if (q.cash < min) { out.add(q.id); continue; }
      paint(q.id);
      if (!q.human) {
        $('.auc-ctrl', host).innerHTML = `<div class="auc-msg"><span class="dots"><i></i><i></i><i></i></span> ${esc(q.name)} is deciding</div>`;
        await this.pause(520);
        const max = AI.auctionMax(g, q, i);
        const jump = Math.max(min - high, Math.round((t.price * (0.06 + Math.random() * 0.08)) / 50) * 50);
        if (max >= min) { high = Math.max(min, Math.min(max, high + jump)); by = q.id; sfx.tap(); }
        else out.add(q.id);
        continue;
      }
      const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
      const steps = [...new Set([min, high + r50(t.price * 0.1), high + r50(t.price * 0.25)])];
      $('.auc-ctrl', host).innerHTML = `<div class="auc-you"><b>${esc(q.name)}</b>, your bid · cash ${peso(q.cash)}</div>
        <div class="auc-btns">${steps.map((v) => `<button class="btn" data-b="${v}" ${v > q.cash ? 'disabled' : ''}>${peso(v)}</button>`).join('')}</div>
        <div class="auc-btns"><button class="btn ghost" data-b="pass">${by === null ? 'Skip' : 'Fold'}</button></div>`;
      const choice = await new Promise((res) => { host.onclick = (e) => { const b = e.target.closest('[data-b]'); if (b && !b.disabled) { sfx.tap(); res(b.dataset.b); } }; });
      host.onclick = null;
      if (choice === 'pass') out.add(q.id); else { high = +choice; by = q.id; }
    }
    if (by !== null) { sfx.gavel(); paint(null, `🔨 Sold to <b>${esc(g.s.players[by].name)}</b> for ${peso(high)}!`); }
    else paint(null, 'No bids. It stays with the bank.');
    await this.pause(1200);
    closeFn(null); await done;
    return by !== null ? { winner: by, price: high } : null;
  }

  // ---------- assets ----------
  openAssets(p, debt = null) {
    const g = this.g;
    const owe = debt?.owe || 0;
    const body = () => {
      const mine = g.ownedBy(p.id);
      if (!mine.length) return `<div class="empty">${tokenSVG(p.token)}<p>No lots yet. Land on one and buy it!</p></div>`;
      const groups = [...Object.keys(GROUPS), 'station', 'utility'];
      return groups.map((k) => {
        const list = mine.filter((i) => (BOARD[i].group || BOARD[i].type) === k);
        if (!list.length) return '';
        const name = GROUPS[k]?.name || (k === 'station' ? 'Transit' : 'Utilities');
        const full = GROUPS[k] && g.hasGroup(p.id, k);
        return `<section class="as-group" style="--gc:${GROUPS[k]?.color || (k === 'station' ? '#9b7ed8' : '#7fcbe0')}">
          <h5>${name}${full ? ' <em>full set</em>' : GROUPS[k] ? ` <span>${list.length}/${GROUP_TILES[k].length}</span>` : ''}</h5>
          ${list.map((i) => {
            const o = g.s.own[i], t = BOARD[i];
            const houses = t.group ? (o.houses === 5 ? '🏙️ tower' : o.houses ? '🏠'.repeat(o.houses) : '') : '';
            const hc = t.group ? GROUPS[t.group].house : 0;
            return `<div class="as-row ${o.mortgaged ? 'mort' : ''}">
              <div class="as-name"><b>${esc(t.name)}</b><small>${o.mortgaged ? 'Mortgaged' : `Rent ${t.type === 'utility' ? (g.rent(i, 1) === 100 ? '100×' : '40×') + ' dice' : peso(g.rent(i, 7))}`} ${houses}</small></div>
              <div class="as-btns">
                ${t.group ? `<button class="mini-btn" data-a="sell" data-i="${i}" ${g.canSell(p.id, i) ? '' : 'disabled'} title="Sell for ${peso(hc / 2)}">${icon('minus')}</button>
                <button class="mini-btn build" data-a="build" data-i="${i}" ${g.canBuild(p.id, i) ? '' : 'disabled'}>${icon('plus')}<span>${peso(hc)}</span></button>` : ''}
                ${o.mortgaged ? `<button class="mini-btn" data-a="unmortgage" data-i="${i}" ${g.canUnmortgage(p.id, i) ? '' : 'disabled'}>Lift <span>${peso(g.unmortgageCost(i))}</span></button>`
                  : `<button class="mini-btn" data-a="mortgage" data-i="${i}" ${g.canMortgage(p.id, i) ? '' : 'disabled'}>Sangla <span>+${peso(g.mortgageValue(i))}</span></button>`}
              </div></div>`;
          }).join('')}</section>`;
      }).join('');
    };
    const head = () => debt
      ? `<div class="debt ${p.cash >= owe ? 'ok' : ''}"><div><small>You owe ${esc(debt.to)}</small><b>${peso(owe)}</b></div><div><small>Cash</small><b>${peso(p.cash)}</b></div></div>`
      : `<div class="as-sum"><span>Cash <b>${peso(p.cash)}</b></span><span>Net worth <b>${peso(g.netWorth(p.id))}</b></span>${p.passes.length ? `<span>🛵 ×${p.passes.length}</span>` : ''}</div>`;
    const acts = () => debt
      ? [{ v: 'bankrupt', label: 'Give up', kind: 'danger' }, { v: 'pay', label: p.cash >= owe ? `Pay ${peso(owe)}` : `Raise ${peso(owe - p.cash)} more`, kind: 'primary', disabled: p.cash < owe }]
      : [{ v: 'done', label: 'Done', kind: 'primary' }];
    return sheet({
      title: debt ? 'Raise some pesos' : `${esc(p.name)}’s assets`, sub: debt ? 'Sell condos or mortgage (sangla) lots to cover what you owe.' : 'Build condos evenly on full sets. A tower comes after 4 condos.',
      body: `<div class="as-head">${head()}</div><div class="as-list">${body()}</div>`, actions: acts(), dismiss: !debt, cls: 'assets',
      mount: (el, close) => {
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-a]');
          if (b && !b.disabled) {
            const i = +b.dataset.i;
            g[b.dataset.a](p.id, i);
            $('.as-list', el).innerHTML = body(); $('.as-head', el).innerHTML = head();
            const a = $('.acts', el); a.innerHTML = acts().map(btnHTML).join('');
            this.renderHud();
          }
        });
      },
    }).then(async (v) => {
      if (!debt) return;
      if (v === 'pay' && p.cash >= owe) return true;
      const sure = await sheet({ title: 'Declare bankruptcy?', sub: 'You’re out of the game. This can’t be undone.', actions: [{ v: 'no', label: 'Keep trying' }, { v: 'yes', label: 'Yes, I’m out', kind: 'danger' }], dismiss: false });
      return sure === 'yes' ? false : this.openAssets(p, debt);
    });
  }

  // ---------- trading ----------
  tradeSummary(t) {
    const g = this.g, A = g.s.players[t.from], B = g.s.players[t.to];
    const side = (who, x) => `<div class="ts-side"><h6 style="--pc:${who.color}"><span class="mini">${tokenSVG(who.token, { shadow: false })}</span>${first(who.name)} gives</h6>
      ${x.props.map((i) => `<div class="ts-item" style="--gc:${BOARD[i].group ? GROUPS[BOARD[i].group].color : '#bbb'}">${esc(BOARD[i].name)}${g.s.own[i].mortgaged ? ' <em>(mortgaged)</em>' : ''}</div>`).join('')}
      ${x.cash ? `<div class="ts-item cash">${peso(x.cash)}</div>` : ''}${x.passes ? `<div class="ts-item cash">🛵 Angkas Pass ×${x.passes}</div>` : ''}
      ${!x.props.length && !x.cash && !x.passes ? '<div class="ts-item none">Nothing</div>' : ''}</div>`;
    return `<div class="ts">${side(A, t.give)}<div class="ts-swap">⇄</div>${side(B, t.get)}</div>`;
  }

  async openTrade(p) {
    const g = this.g;
    const others = g.alive.filter((q) => q.id !== p.id);
    if (!others.length) return;
    const st = { to: others[0].id, give: { props: new Set(), cash: 0, passes: 0 }, get: { props: new Set(), cash: 0, passes: 0 } };
    const toT = () => ({ from: p.id, to: st.to, give: { props: [...st.give.props], cash: st.give.cash, passes: st.give.passes }, get: { props: [...st.get.props], cash: st.get.cash, passes: st.get.passes } });
    const col = (who, key) => {
      const x = st[key], props = g.tradeable(who.id);
      return `<div class="tr-col"><h6 style="--pc:${who.color}"><span class="mini">${tokenSVG(who.token, { shadow: false })}</span>${key === 'give' ? 'You give' : `${first(who.name)} gives`}</h6>
        <div class="tr-props">${props.length ? props.map((i) => `<button class="tp ${x.props.has(i) ? 'on' : ''}" data-k="${key}" data-i="${i}" style="--gc:${BOARD[i].group ? GROUPS[BOARD[i].group].color : '#a99'}">${esc(BOARD[i].name)}${g.s.own[i].mortgaged ? ' ·M' : ''}</button>`).join('') : '<span class="none">No tradeable lots</span>'}</div>
        <div class="tr-cash"><button class="mini-btn" data-c="${key}" data-d="-500">−500</button><button class="mini-btn" data-c="${key}" data-d="-100">−100</button><b>${peso(x.cash)}</b><button class="mini-btn" data-c="${key}" data-d="100">+100</button><button class="mini-btn" data-c="${key}" data-d="500">+500</button></div>
        ${who.passes.length ? `<button class="tp pass ${x.passes ? 'on' : ''}" data-pass="${key}">🛵 Angkas Pass</button>` : ''}</div>`;
    };
    const body = () => `<div class="tr-who">${others.map((q) => `<button class="who ${q.id === st.to ? 'on' : ''}" data-to="${q.id}" style="--pc:${q.color}"><span class="mini">${tokenSVG(q.token, { shadow: false })}</span>${first(q.name)}${q.human ? '' : '<small class="cpu">CPU</small>'}</button>`).join('')}</div>
      <div class="tr-cols">${col(p, 'give')}${col(g.s.players[st.to], 'get')}</div>`;
    const acts = () => [{ v: 'cancel', label: 'Cancel' }, { v: 'go', label: 'Propose deal', kind: 'primary', disabled: !g.validTrade(toT()) }];
    const v = await sheet({
      title: 'Make a deal', sub: 'Lots with condos on their set can’t be traded.', body: body(), actions: acts(), cls: 'trade',
      mount: (el) => {
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-to],[data-k],[data-c],[data-pass]');
          if (!b) return;
          sfx.tap();
          if (b.dataset.to) { st.to = +b.dataset.to; st.get = { props: new Set(), cash: 0, passes: 0 }; }
          else if (b.dataset.k) { const s = st[b.dataset.k].props, i = +b.dataset.i; s.has(i) ? s.delete(i) : s.add(i); }
          else if (b.dataset.c) {
            const who = b.dataset.c === 'give' ? p : g.s.players[st.to];
            st[b.dataset.c].cash = Math.max(0, Math.min(who.cash, st[b.dataset.c].cash + +b.dataset.d));
          } else if (b.dataset.pass) st[b.dataset.pass].passes = st[b.dataset.pass].passes ? 0 : 1;
          $('.sb', el).innerHTML = body();
          $('.acts', el).innerHTML = acts().map(btnHTML).join('');
        });
      },
    });
    if (v !== 'go') return;
    const t = toT(), q = g.s.players[t.to];
    let yes;
    if (q.human) {
      yes = await sheet({ title: `Pass the phone to ${esc(q.name)}`, sub: `${esc(p.name)} proposes a deal`, body: this.tradeSummary(t), dismiss: false, actions: [{ v: 'no', label: 'Decline' }, { v: 'yes', label: 'Accept', kind: 'primary' }] }) === 'yes';
    } else {
      toast(`<span class="dots"><i></i><i></i><i></i></span> ${esc(q.name)} is thinking about it…`, 'calm');
      await this.pause(1100);
      yes = AI.evaluateTrade(g, t);
    }
    if (yes && g.validTrade(t)) g.applyTrade(t);
    else { sfx.bad(); toast(`${esc(q.name)} said no thanks.`, 'warn'); }
  }

  // ---------- info sheets ----------
  openTile(i) {
    if (document.querySelector('.sheet-wrap')) return;
    sfx.tap();
    sheet({ body: deedHTML(this.g, i), actions: [{ v: 'ok', label: 'Close' }], cls: 'info' });
  }

  openPlayer(pid) {
    const g = this.g, p = g.s.players[pid];
    const cur = g.cur;
    if (p.human && p.id === cur.id && !p.bankrupt) return this.openAssets(p);
    const mine = g.ownedBy(pid);
    sheet({
      title: esc(p.name), sub: p.bankrupt ? 'Bankrupt' : `${p.human ? 'Player' : 'CPU'} · net worth ${peso(g.netWorth(pid))}`,
      body: `<div class="pl-head" style="--pc:${p.color}"><div class="big-token">${tokenSVG(p.token)}</div><div><small>Cash</small><b>${peso(p.cash)}</b>${p.passes.length ? `<small>🛵 Angkas Pass ×${p.passes.length}</small>` : ''}${p.jail ? '<small>🚦 In traffic</small>' : ''}</div></div>
        <div class="pl-props">${mine.length ? mine.map((i) => `<span class="pp" style="--gc:${BOARD[i].group ? GROUPS[BOARD[i].group].color : '#a99'}">${esc(BOARD[i].name)}${g.s.own[i].houses ? ` · ${g.s.own[i].houses === 5 ? '🏙️' : g.s.own[i].houses + '🏠'}` : ''}${g.s.own[i].mortgaged ? ' · M' : ''}</span>`).join('') : '<p class="none">No lots yet.</p>'}</div>`,
      actions: [{ v: 'ok', label: 'Close' }],
    });
  }

  openMenu() {
    const sp = this.speed;
    sheet({
      title: 'Paused', sub: `Round ${this.g.s.round}${this.g.s.settings.rounds ? ` of ${this.g.s.settings.rounds}` : ''} · your game saves every turn`,
      body: `<div class="menu-list">
        <button class="menu-item" data-m="sound">${icon(isMuted() ? 'mute' : 'sound')}<span>Sound</span><em>${isMuted() ? 'Off' : 'On'}</em></button>
        <button class="menu-item" data-m="speed">${icon('speed')}<span>CPU speed</span><em>${sp > 2 ? 'Fast' : 'Normal'}</em></button>
        <button class="menu-item" data-m="log">${icon('log')}<span>Game log</span><em></em></button>
        <button class="menu-item" data-m="rules">${icon('book')}<span>How to play</span><em></em></button>
        <button class="menu-item danger" data-m="quit">${icon('home')}<span>Save and quit</span><em></em></button></div>`,
      actions: [{ v: 'ok', label: 'Resume', kind: 'primary' }],
      mount: (el, close) => el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        sfx.tap();
        const m = b.dataset.m;
        if (m === 'sound') { setMuted(!isMuted()); b.querySelector('em').textContent = isMuted() ? 'Off' : 'On'; b.querySelector('.ic').outerHTML = icon(isMuted() ? 'mute' : 'sound'); }
        if (m === 'speed') { this.speed = this.speed > 2 ? 1.4 : 2.6; this.board.speed = this.speed; try { localStorage.setItem('pm-speed', this.speed); } catch {} b.querySelector('em').textContent = this.speed > 2 ? 'Fast' : 'Normal'; }
        if (m === 'log') { close(); this.openLog(); }
        if (m === 'rules') { close(); this.hooks.rules(); }
        if (m === 'quit') { close(); this.hooks.quit(); }
      }),
    });
  }

  openLog() {
    sheet({ title: 'Game log', body: `<ol class="log-list">${this.logItems(60)}</ol>`, actions: [{ v: 'ok', label: 'Close', kind: 'primary' }] });
  }

  logItems(n) {
    return this.g.s.log.slice(0, n).map((l) => {
      const p = l.pid !== null ? this.g.s.players[l.pid] : null;
      return `<li style="--pc:${p ? p.color : '#bba'}"><span class="r">R${l.r}</span>${esc(l.msg)}</li>`;
    }).join('');
  }
  renderLog() { const ol = $('#side-log ol', this.root); if (ol) ol.innerHTML = this.logItems(40); }

  updatePot() {
    const el = $('.pot-pill', this.root);
    if (!el) return;
    const pot = this.g.s.pot;
    el.hidden = !(this.g.s.settings.pot && pot > 0);
    el.innerHTML = `☕ Merienda pot <b>${peso(pot)}</b>`;
  }

  renderHud(force = false) {
    const g = this.g, host = $('#hud .chips', this.root);
    if (!host) return;
    if (force || host.children.length !== g.s.players.length) {
      host.innerHTML = g.s.players.map((p) => `<button class="chip" data-pid="${p.id}" style="--pc:${p.color}">
        <span class="av">${tokenSVG(p.token, { shadow: false })}</span><span class="ci"><b>${esc(p.name)}</b><em class="cash" data-v="${p.cash}">${peso(p.cash)}</em></span><i class="bdg"></i></button>`).join('');
    }
    for (const p of g.s.players) {
      const c = host.querySelector(`.chip[data-pid="${p.id}"]`);
      c.classList.toggle('active', p.id === g.cur.id && g.s.winner === null);
      c.classList.toggle('out', p.bankrupt);
      c.querySelector('.bdg').textContent = (p.jail ? '🚦' : '') + (p.passes.length ? '🛵' : '') + (p.human ? '' : '');
      const em = c.querySelector('.cash'), from = +em.dataset.v, to = p.cash;
      if (from !== to) {
        em.dataset.v = to;
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / 500); em.textContent = peso(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
    }
    const a = host.querySelector('.chip.active');
    if (a && host.scrollWidth > host.clientWidth) a.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    this.updatePot();
  }

  async gameOver(w) {
    const g = this.g;
    sfx.win(); confetti(140);
    const rank = [...g.s.players].sort((a, b) => (b.bankrupt ? -1 : 0) - (a.bankrupt ? -1 : 0) || g.netWorth(b.id) - g.netWorth(a.id));
    const v = await sheet({
      cls: 'gameover', dismiss: false,
      body: `<div class="go-hero" style="--pc:${w.color}"><div class="rays"></div><div class="big-token win">${tokenSVG(w.token)}</div></div>
        <h2 class="go-title">${esc(w.name)} wins!</h2><p class="go-sub">${g.s.humansOut ? 'Richest tycoon left when the last human went broke.' : g.s.timeUp ? 'Richest in Metro Manila when time ran out.' : 'Last tycoon standing in Metro Manila.'}</p>
        <ol class="standings">${rank.map((p, k) => `<li style="--pc:${p.color}"><span class="pos">${k + 1}</span><span class="mini">${tokenSVG(p.token, { shadow: false })}</span><b>${esc(p.name)}</b><em>${p.bankrupt ? 'bankrupt' : peso(g.netWorth(p.id))}</em></li>`).join('')}</ol>`,
      actions: [{ v: 'home', label: 'Home' }, { v: 'again', label: 'Play again', kind: 'primary' }],
    });
    this.hooks.over(v);
  }

  destroy() { this.board?.destroy(); }
}
