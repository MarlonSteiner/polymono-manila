import { TOKENS, BOT_NAMES, BOARD, isOwnable } from './data.js';
import { Game, newState, loadSave, clearSave } from './engine.js';
import { UI, sheet, getPace, setPace, SPEED_LABEL } from './ui.js';
import { BoardView } from './board.js';
import { tokenSVG, logoSVG, icon } from './art.js';
import { sfx, unlock } from './audio.js';
import { initOnline, openOnline, rejoin, savedRoom, leaveGame, endGame } from './online.js';
import { cleanCode } from './net.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ui = null, game = null, homeBoard = null, spinTimer = null;

['pointerdown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
}

// ---------- home ----------
function demoState() {
  const s = newState({
    settings: { startCash: 15000 },
    players: [0, 1, 2, 3].map((k) => ({ name: '', token: TOKENS[k].id, color: TOKENS[k].color, human: false })),
  });
  [[1, 0, 2], [3, 0, 2], [11, 1, 1], [13, 1, 1], [14, 1, 3], [24, 2, 5], [26, 3, 0], [27, 3, 0], [29, 3, 4], [37, 2, 0], [39, 2, 0], [5, 1, 0], [16, 0, 0], [21, 2, 0]]
    .forEach(([i, o, h]) => Object.assign(s.own[i], { owner: o, houses: h }));
  [6, 18, 27, 34].forEach((pos, k) => { s.players[k].pos = pos; });
  return s;
}

function startHome() {
  show('home');
  const stage = $('#home-stage');
  homeBoard?.destroy();
  homeBoard = new BoardView(stage, { s: demoState() }, { spin: true, tilt: 40, zoom: 1.12 });
  homeBoard.mode = 'overview';
  homeBoard.render();
  homeBoard.spinSide = 0;
  homeBoard.applyCamera(true);
  clearInterval(spinTimer);
  spinTimer = setInterval(() => { homeBoard.spinSide = (homeBoard.spinSide + 1) % 4; homeBoard.applyCamera(false, 3800); }, 5200);
  const save = loadSave(), room = savedRoom();
  $('#home-ui').innerHTML = `
    <div class="home-logo">${logoSVG()}</div>
    <div class="home-btns">
      ${save ? `<button class="btn primary big" id="h-cont">${icon('speed')}<span>Continue</span><small>Round ${save.round} · ${save.players.filter((p) => !p.bankrupt).length} players left</small></button>` : ''}
      ${room ? `<button class="btn gold big" id="h-rejoin">${icon('user')}<span>Rejoin room ${esc(room)}</span></button>` : ''}
      <div class="home-pair">
        <button class="btn ${save || room ? '' : 'primary'} big" id="h-new">${icon('plus')}<span>New game</span><small>on this device</small></button>
        <button class="btn big" id="h-online">${icon('user')}<span>Online</span><small>with friends</small></button>
      </div>
      <button class="btn ghost" id="h-rules">${icon('book')}<span>How to play</span></button>
    </div>
    <p class="fine">Pass one phone around, or play together on your own phones</p>`;
  $('#h-online').onclick = () => { sfx.tap(); stopHome(); openOnline(); };
  if (room) $('#h-rejoin').onclick = () => { sfx.tap(); stopHome(); rejoin(); };
  $('#h-new').onclick = () => { sfx.tap(); startSetup(); };
  $('#h-rules').onclick = () => { sfx.tap(); rules(); };
  if (save) $('#h-cont').onclick = () => { sfx.tap(); startGame(save); };
}

// ---------- setup ----------
let setup = null;
function defaultSetup() {
  return {
    players: [
      { name: 'Ikaw', token: 'jeepney', human: true },
      { name: BOT_NAMES[0], token: 'puspin', human: false },
      { name: BOT_NAMES[1], token: 'halohalo', human: false },
      { name: BOT_NAMES[2], token: 'mangga', human: false },
    ],
    settings: { startCash: 15000, rounds: 0, auctions: true, pot: false },
  };
}
try { setup = JSON.parse(localStorage.getItem('pm-setup')); } catch {}
if (!setup || !setup.players) setup = defaultSetup();

function startSetup() {
  show('setup');
  stopHome();
  renderSetup();
}

function seg(key, opts) {
  return `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button class="${setup.settings[key] === v ? 'on' : ''}" data-val='${JSON.stringify(v)}'>${l}</button>`).join('')}</div>`;
}

function renderSetup() {
  const used = new Set(setup.players.map((p) => p.token));
  $('#setup-ui').innerHTML = `
    <header class="setup-head"><button class="icon-btn" id="s-back" aria-label="Back">${icon('close')}</button><h1>New game</h1><span></span></header>
    <div class="setup-scroll">
      <h3>Players <small>${setup.players.length} of 6 · tap a token to swap</small></h3>
      <div class="plist">${setup.players.map((p, k) => {
        const t = TOKENS.find((x) => x.id === p.token);
        return `<div class="prow" style="--pc:${t.color}">
          <button class="ptok" data-k="${k}" aria-label="Change token">${tokenSVG(p.token)}<small>${t.name}</small></button>
          <input class="pname" data-k="${k}" value="${esc(p.name)}" maxlength="14" autocomplete="off" autocapitalize="words" enterkeyhint="done">
          <div class="pkind" data-k="${k}"><button class="${p.human ? 'on' : ''}" data-h="1">${icon('user')}<span>Human</span></button><button class="${p.human ? '' : 'on'}" data-h="0">${icon('bot')}<span>CPU</span></button></div>
          ${setup.players.length > 2 ? `<button class="prem" data-k="${k}" aria-label="Remove">${icon('close')}</button>` : '<span class="prem-ph"></span>'}
        </div>`;
      }).join('')}</div>
      ${setup.players.length < 6 ? `<button class="btn ghost add" id="s-add">${icon('plus')}<span>Add a player</span></button>` : ''}
      <h3>Starting cash</h3>${seg('startCash', [[10000, '₱10,000'], [15000, '₱15,000'], [20000, '₱20,000']])}
      <h3>Game length</h3>${seg('rounds', [[0, 'Classic'], [30, '30 rounds'], [15, '15 rounds']])}
      <p class="opt-note">${setup.settings.rounds ? `After ${setup.settings.rounds} rounds the richest player wins.` : 'Play until one tycoon is left standing.'}</p>
      <h3>Game speed</h3><div class="seg" id="s-pace">${['slow', 'normal', 'fast'].map((v) => `<button class="${getPace() === v ? 'on' : ''}" data-pace="${v}">${SPEED_LABEL[v]}</button>`).join('')}</div>
      <p class="opt-note">How long dice tumble and tokens hop. You can change it any time from the menu.</p>
      <h3>House rules</h3>
      <label class="tog"><input type="checkbox" id="o-auc" ${setup.settings.auctions ? 'checked' : ''}><span class="sw"></span><span><b>Auctions</b><small>Lots nobody buys go to the highest bidder</small></span></label>
      <label class="tog"><input type="checkbox" id="o-pot" ${setup.settings.pot ? 'checked' : ''}><span class="sw"></span><span><b>Merienda pot</b><small>Taxes and fines pile up. Land on Merienda to grab them.</small></span></label>
    </div>
    <footer class="setup-foot"><button class="btn primary big" id="s-go">${icon('speed')}<span>Start game</span></button></footer>`;
  const ui2 = $('#setup-ui');
  $('#s-back').onclick = () => { sfx.tap(); startHome(); };
  $('#s-go').onclick = () => {
    sfx.tap();
    try { localStorage.setItem('pm-setup', JSON.stringify(setup)); } catch {}
    if (loadSave()) clearSave();
    const st = newState({
      settings: { ...setup.settings },
      players: setup.players.map((p, k) => ({ name: p.name.trim() || (p.human ? `Player ${k + 1}` : BOT_NAMES[k]), token: p.token, color: TOKENS.find((t) => t.id === p.token).color, human: p.human })),
    });
    startGame(st);
  };
  const add = $('#s-add');
  if (add) add.onclick = () => {
    sfx.tap();
    const tok = TOKENS.find((t) => !used.has(t.id));
    const name = BOT_NAMES.find((n) => !setup.players.some((p) => p.name === n)) || 'CPU';
    setup.players.push({ name, token: tok.id, human: false });
    renderSetup();
  };
  ui2.querySelectorAll('.ptok').forEach((b) => b.onclick = () => {
    sfx.tap();
    const p = setup.players[+b.dataset.k];
    let i = TOKENS.findIndex((t) => t.id === p.token);
    for (let n = 0; n < 6; n++) { i = (i + 1) % TOKENS.length; if (!used.has(TOKENS[i].id)) break; }
    p.token = TOKENS[i].id;
    renderSetup();
  });
  ui2.querySelectorAll('.pname').forEach((inp) => inp.oninput = () => { setup.players[+inp.dataset.k].name = inp.value; });
  ui2.querySelectorAll('.pkind button').forEach((b) => b.onclick = () => {
    sfx.tap();
    const p = setup.players[+b.parentElement.dataset.k];
    const human = b.dataset.h === '1';
    if (p.human !== human) {
      p.human = human;
      if (human && BOT_NAMES.includes(p.name)) p.name = `Player ${+b.parentElement.dataset.k + 1}`;
      if (!human && !BOT_NAMES.includes(p.name)) p.name = BOT_NAMES.find((n) => !setup.players.some((q) => q.name === n)) || 'CPU';
    }
    renderSetup();
  });
  ui2.querySelectorAll('.prem').forEach((b) => b.onclick = () => { sfx.tap(); setup.players.splice(+b.dataset.k, 1); renderSetup(); });
  ui2.querySelectorAll('.seg[data-key]').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.onclick = () => {
    sfx.tap(); setup.settings[sg.dataset.key] = JSON.parse(b.dataset.val); renderSetup();
  }));
  ui2.querySelectorAll('[data-pace]').forEach((b) => b.onclick = () => { sfx.tap(); setPace(b.dataset.pace); renderSetup(); });
  $('#o-auc').onchange = (e) => { setup.settings.auctions = e.target.checked; };
  $('#o-pot').onchange = (e) => { setup.settings.pot = e.target.checked; };
}

// ---------- game ----------
function stopHome() { clearInterval(spinTimer); homeBoard?.destroy(); homeBoard = null; }

async function startGame(state, sync = null, { ff = false } = {}) {
  stopHome();
  show('game');
  if (game) game.stopped = true;
  document.querySelectorAll('#layer .sheet-wrap, #layer .card-pop').forEach((el) => el.remove());
  ui?.destroy();
  ui = new UI($('#game'));
  game = new Game(state, ui);
  if (sync) { game.sync = sync; sync.g = game; }
  ui.attach(game, {
    rules,
    quit: () => { game.stopped = true; if (sync) leaveGame(); location.reload(); },
    over: (v) => { if (sync) endGame(); ui.destroy(); ui = null; game = null; v === 'again' ? startSetup() : startHome(); },
  });
  const me = game;
  if (ff) ui.ff = true;
  else await new Promise((r) => setTimeout(r, 450));
  if (game === me) game.run();
}

initOnline({
  show: (id) => { stopHome(); show(id); },
  home: startHome,
  startGame,
  status: (up) => ui?.setOnline(up),
});

function rules() {
  const R = (t, b) => `<section class="rule"><h4>${t}</h4><p>${b}</p></section>`;
  sheet({
    title: 'How to play', sub: 'Become the last tycoon standing in Metro Manila.',
    body: `<div class="rules">
      ${R('🎲 Roll and move', 'Roll two dice and hop around the board. Pass <b>Simula</b> to collect ₱2,000 sweldo. Doubles let you roll again, but three doubles in a row sends you to traffic.')}
      ${R('🏠 Buy lots', 'Land on an unowned lot, line or utility to buy it. Pass, and it goes to auction for everyone (if auctions are on).')}
      ${R('💸 Collect rent', 'Anyone landing on your lot pays you rent. Own a whole color set to double the rent and start building.')}
      ${R('🏙️ Build up', 'On a full set, build condos evenly across the lots. After 4 condos a lot gets a tower, where rent goes sky-high.')}
      ${R('🚆 Lines and utilities', 'LRT-1, MRT-3, LRT-2 and the Pasig Ferry pay more the more of them you own. Kuryente and Tubig charge by the dice roll.')}
      ${R('🍀 Swerte and Bayanihan', 'Draw a card: a lucky break, a bill, a free Grab ride, or an <b>Angkas Pass</b> that gets you out of traffic.')}
      ${R('🚦 EDSA Traffic', 'Stuck in traffic? Pay ₱500, use an Angkas Pass, or try to roll doubles. After three tries you pay and go.')}
      ${R('🤝 Deals and sangla', 'Trade lots and cash with anyone during your turn. Short on cash? Sell condos or mortgage (<i>sangla</i>) lots for half their price.')}
      ${R('🏆 Winning', 'If you can’t pay what you owe, you’re bankrupt. Last player standing wins, or the richest when the round limit hits.')}
      <p class="tip">Tip: tap any tile on the board to see its rent card. Tap a player at the top to see what they own. The map button zooms out to the whole city.</p></div>`,
    actions: [{ v: 'ok', label: 'Got it', kind: 'primary' }],
  });
}

// iOS: block pinch zoom and the double-tap zoom on the board
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 320 && !e.target.closest('input')) e.preventDefault(); lastTouch = now; }, { passive: false });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // A new version took over: reload to run it, but only from the home screen so no game gets cut off.
  const updating = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating && document.querySelector('#home.on')) location.reload();
  });
  navigator.serviceWorker.register('sw.js');
}

const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(() => {
  document.body.classList.add('ready');
  try { sessionStorage.removeItem('pm-retry'); } catch {}
  // Invite links look like ?room=ABCDE
  const invite = cleanCode(new URLSearchParams(location.search).get('room') || '');
  if (invite) {
    history.replaceState(null, '', location.pathname);
    openOnline(invite);
  } else startHome();
});

export { BOARD, isOwnable };
