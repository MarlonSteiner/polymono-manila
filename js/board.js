// The 3D board: tiles on a tilted plane, standing paper-cutout tokens and sprites,
// and a camera that follows the active token around the corners.
import { BOARD, GROUPS, JAIL_POS, CCW, peso } from './data.js';
import { tileIcon, cornerSVG, centerMapSVG, centerLifeSVG, centerSprites, tokenSVG, C } from './art.js';

export const BW = 1000, CW = 140, TW = 80;
const DIR = CCW ? 1 : -1; // which way the camera turns at each corner

// Clockwise layout: Simula bottom-right, play heads left. Counter-clockwise is its mirror image.
function cwRect(i) {
  if (i === 0) return { x: 860, y: 860, w: CW, h: CW, rot: 270, corner: true };
  if (i < 10) return { x: 860 - i * TW, y: 860, w: TW, h: CW, rot: 0 };
  if (i === 10) return { x: 0, y: 860, w: CW, h: CW, rot: 0, corner: true };
  if (i < 20) return { x: 0, y: 860 - (i - 10) * TW, w: CW, h: TW, rot: 90 };
  if (i === 20) return { x: 0, y: 0, w: CW, h: CW, rot: 90, corner: true };
  if (i < 30) return { x: 140 + (i - 21) * TW, y: 0, w: TW, h: CW, rot: 180 };
  if (i === 30) return { x: 860, y: 0, w: CW, h: CW, rot: 180, corner: true };
  return { x: 860, y: 140 + (i - 31) * TW, w: CW, h: TW, rot: 270 };
}
export function tileRect(i) {
  const r = cwRect(i);
  if (!CCW) return r;
  // Mirror left to right. Tiles keep facing the centre; corners turn so their inside corner still points inward.
  const rot = r.corner ? ((4 - i / 10) % 4) * 90 : [0, 270, 180, 90][Math.floor(i / 10)];
  return { ...r, x: BW - r.x - r.w, rot };
}
const OUTWARD = CCW ? [[0, 1], [1, 0], [0, -1], [-1, 0]] : [[0, 1], [-1, 0], [0, -1], [1, 0]];
const sideOf = (i) => (i % 10 === 0 ? (i / 10 + 3) % 4 : Math.floor(i / 10));
const center = (i) => { const r = tileRect(i); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
// point in a corner's canonical frame (inward = top-right) -> board coords
function cornerPoint(i, cx, cy) {
  const r = tileRect(i), a = (r.rot * Math.PI) / 180, dx = cx - 70, dy = cy - 70;
  return { x: r.x + 70 + dx * Math.cos(a) - dy * Math.sin(a), y: r.y + 70 + dx * Math.sin(a) + dy * Math.cos(a) };
}

const houseIcons = (n) => {
  if (n === 5) return `<svg viewBox="0 0 30 22" class="hs tower"><g stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"><path d="M9,21 L9,4 L15,1 L21,4 L21,21 Z" fill="#e2584f"/><path d="M12,8h6M12,12h6M12,16h6" stroke="#fff" stroke-width="1.6"/></g></svg>`;
  return Array.from({ length: n }, () => `<svg viewBox="0 0 16 18" class="hs"><g stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"><path d="M2,17 L2,7 L8,2 L14,7 L14,17 Z" fill="#fdf6e6"/><path d="M1,8 L8,2 L15,8" fill="none" stroke="#3f9a59" stroke-width="2.6"/><rect x="6" y="11" width="4" height="6" fill="#86c4d6" stroke-width="1"/></g></svg>`).join('');
};

export class BoardView {
  constructor(stage, game, opts = {}) {
    this.stage = stage; this.g = game; this.opts = opts;
    this.rz = 0; this.mode = 'follow'; this.focusPid = null; this.speed = 1;
    this.build();
    this.ro = new ResizeObserver(() => this.applyCamera(true));
    this.ro.observe(stage);
    this.onSheet = () => {
      const open = !!document.querySelector('.sheet-wrap:not(.out)') && innerWidth < 700;
      if (open !== this.sheetOpen) { this.sheetOpen = open; this.applyCamera(false, 450); }
    };
    window.addEventListener('sheetchange', this.onSheet);
  }

  build() {
    this.stage.innerHTML = `<div class="sky"><i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i></div><div class="cam"><div class="plane"></div></div>`;
    this.cam = this.stage.querySelector('.cam');
    this.plane = this.stage.querySelector('.plane');
    const html = [`<div class="slab"></div><div class="center-map" style="left:${CW}px;top:${CW}px">${centerMapSVG()}</div>`,
      `<div class="center-map life" style="left:${CW}px;top:${CW}px">${centerLifeSVG()}</div>`];
    for (let i = 0; i < 40; i++) html.push(this.tileHTML(i));
    this.plane.innerHTML = html.join('');
    this.sprites = centerSprites().map((s) => {
      const el = document.createElement('div');
      el.className = 'sprite' + (s.logo ? ' logo-sprite' : '') + (s.anim ? ` ${s.anim}` : '');
      if (s.anim) el.style.setProperty('--d', `${(-Math.random() * 5).toFixed(2)}s`);
      el.style.cssText = `width:${s.w * s.s}px;height:${s.h * s.s}px;transform:translate3d(${s.x - (s.w * s.s) / 2}px,${s.y - s.h * s.s}px,0)`;
      el.innerHTML = `<div class="bb">${s.svg}</div>`;
      this.plane.appendChild(el);
      return el;
    });
    this.tokens = new Map();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.plane.querySelector('.life svg')?.pauseAnimations?.();
    this.plane.addEventListener('click', (e) => {
      const t = e.target.closest('.tile');
      if (t && this.opts.onTile) this.opts.onTile(+t.dataset.i);
    });
  }

  tileHTML(i) {
    const t = BOARD[i], r = tileRect(i);
    const iw = r.corner ? CW : TW, ih = CW;
    const style = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    const inner = `left:${(r.w - iw) / 2}px;top:${(r.h - ih) / 2}px;width:${iw}px;height:${ih}px;transform:rotate(${r.rot}deg)`;
    let body;
    if (r.corner) body = cornerSVG(t.type);
    else if (t.type === 'prop') {
      body = `<div class="band" style="background:${GROUPS[t.group].color}"><div class="houses"></div></div>
        <div class="nm">${t.name}</div><div class="ti">${tileIcon(t.look, t.group)}</div><div class="pr">${peso(t.price)}</div>`;
    } else {
      const look = t.look || { swerte: 'swerte', bayanihan: 'bayanihan', tax: t.name === 'Skyway Toll' ? 'toll' : 'tax' }[t.type];
      const label = t.type === 'tax' ? peso(t.amount) : t.price ? peso(t.price) : '';
      body = `<div class="nm nm-top">${t.name}</div><div class="ti big">${tileIcon(look)}</div><div class="pr">${label}</div>`;
    }
    return `<div class="tile ${r.corner ? 'corner' : ''} t-${t.type}" data-i="${i}" style="${style}">
      <div class="tin" style="${inner}">${body}<div class="own"></div><div class="stamp">SANGLA</div></div></div>`;
  }

  // ---------- state -> DOM ----------
  render() {
    const s = this.g.s;
    this.plane.querySelectorAll('.tile').forEach((el) => {
      const i = +el.dataset.i, o = s.own[i];
      if (!o) return;
      const owner = o.owner !== null ? s.players[o.owner] : null;
      el.classList.toggle('owned', !!owner);
      el.classList.toggle('mortgaged', !!o.mortgaged);
      el.style.setProperty('--oc', owner ? owner.color : 'transparent');
      const own = el.querySelector('.own');
      const key = owner ? `${owner.id}` : '';
      if (own.dataset.k !== key) {
        own.dataset.k = key;
        own.innerHTML = owner ? `<span class="ot">${tokenSVG(owner.token, { shadow: false })}</span><b>${owner.name.split(' ')[0]}</b>` : '';
      }
      const hs = el.querySelector('.houses');
      if (hs && hs.dataset.n !== String(o.houses)) { hs.dataset.n = o.houses; hs.innerHTML = houseIcons(o.houses); if (o.houses) hs.classList.remove('pop'), void hs.offsetWidth, hs.classList.add('pop'); }
    });
    for (const p of s.players) {
      let el = this.tokens.get(p.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'token';
        el.innerHTML = `<div class="bb"><div class="hop">${tokenSVG(p.token)}<i class="ring" style="--pc:${p.color}"></i></div></div>`;
        this.plane.appendChild(el);
        this.tokens.set(p.id, el);
      }
      el.classList.toggle('gone', p.bankrupt);
      el.classList.toggle('active', p.id === s.players[s.turn].id && !s.winner);
      if (!el.dataset.moving) this.setTokenPos(p.id, this.slot(p));
    }
  }

  slot(p, pos = p.pos, jailed = !!p.jail) {
    const s = this.g.s;
    const here = s.players.filter((q) => !q.bankrupt && q.pos === pos && (pos !== JAIL_POS || !!q.jail === jailed));
    const k = Math.max(0, here.findIndex((q) => q.id === p.id)), n = Math.max(1, here.length);
    let c = center(pos);
    if (pos === JAIL_POS) c = jailed ? cornerPoint(pos, 88, 52) : cornerPoint(pos, 30, 112);
    else if (pos % 10) { const o = OUTWARD[Math.floor(pos / 10)]; c = { x: c.x + o[0] * 24, y: c.y + o[1] * 24 }; }
    if (n === 1) return c;
    const ang = (k / n) * Math.PI * 2 + 0.6, rad = pos % 10 === 0 ? 26 : 19;
    return { x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad * 0.85 };
  }

  setTokenPos(pid, pt) {
    const el = this.tokens.get(pid);
    el.style.transform = `translate3d(${pt.x - 32}px,${pt.y - 64}px,0)`;
    el.dataset.x = pt.x; el.dataset.y = pt.y;
  }
  tokenPoint(pid) { const el = this.tokens.get(pid); return { x: +el.dataset.x, y: +el.dataset.y }; }

  // ---------- camera ----------
  setMode(mode) { this.mode = mode; this.applyCamera(); }
  follow(pid, pos) { this.focusPid = pid; this.focusPos = pos; this.applyCamera(); }

  applyCamera(instant = false, dur = 650) {
    const vw = this.stage.clientWidth, vh = this.stage.clientHeight;
    if (!vw || !vh) return;
    let tilt, s, fx, fy, oy, side;
    const p = this.focusPid !== null ? this.g.s.players[this.focusPid] : null;
    const pos = this.focusPos ?? (p ? p.pos : 0);
    side = this.opts.spin ? this.spinSide || 0 : sideOf(pos);
    if (this.mode === 'overview' || !p) {
      tilt = this.opts.tilt ?? 32;
      const cos = Math.cos((tilt * Math.PI) / 180);
      s = Math.min((vw * 0.94) / BW, (vh * 0.9) / (BW * cos + 140)) * (this.opts.zoom || 1);
      fx = BW / 2; fy = BW / 2; oy = vh * 0.02;
    } else {
      tilt = 52;
      s = Math.max(0.78, Math.min(1.3, vw / 430));
      const pt = this.tokens.has(p.id) ? this.tokenPoint(p.id) : center(pos);
      fx = pt.x + (BW / 2 - pt.x) * 0.24; fy = pt.y + (BW / 2 - pt.y) * 0.24; oy = this.sheetOpen ? -vh * 0.3 : vh * (vh > vw ? 0.22 : 0.1);
    }
    // shortest way round to the target side
    const target = DIR * 90 * side;
    let d = ((target - this.rz) % 360 + 540) % 360 - 180;
    this.rz += d;
    const root = this.stage;
    root.style.setProperty('--camT', instant ? '0ms' : dur + 'ms');
    root.style.setProperty('--rz', this.rz);
    root.style.setProperty('--tilt', tilt);
    this.cam.style.transform = `translate3d(${vw / 2}px,${vh / 2 + oy}px,0) rotateX(${tilt}deg) rotateZ(${this.rz}deg) scale(${s}) translate3d(${-fx}px,${-fy}px,0)`;
    // slab thickness always shows on the side facing the camera
    const a = (-this.rz * Math.PI) / 180, dx = Math.sin(a) * -1, dy = Math.cos(a);
    this.plane.style.setProperty('--sx', (dx * 14).toFixed(1) + 'px');
    this.plane.style.setProperty('--sy', (dy * 14).toFixed(1) + 'px');
  }

  // ---------- animation ----------
  wait(ms) { return new Promise((r) => setTimeout(r, ms / this.speed)); }

  async hop(p, from, steps, sfx) {
    const el = this.tokens.get(p.id);
    el.dataset.moving = '1';
    el.classList.remove('landed');
    const dir = Math.sign(steps), n = Math.abs(steps);
    const base = n > 14 ? 130 : 230;
    for (let k = 1; k <= n; k++) {
      // the last couple of hops slow down a little, for suspense
      const left = n - k, per = (base * (left === 0 ? 1.5 : left === 1 ? 1.25 : 1)) / this.speed;
      el.style.setProperty('--hopT', per + 'ms');
      const pos = (from + dir * k + 40) % 40;
      const pt = this.slot(p, pos, false);
      el.classList.remove('hopping'); void el.offsetWidth; el.classList.add('hopping');
      this.setTokenPos(p.id, pt);
      if (this.mode === 'follow') { this.focusPid = p.id; this.focusPos = pos; this.applyCamera(false, per * 1.6); }
      sfx?.(k, n);
      await this.wait(per * this.speed * 0.82);
      this.puff(pt);
      await this.wait(per * this.speed * 0.18);
    }
    el.classList.remove('hopping'); void el.offsetWidth; el.classList.add('landed');
    this.ripple((from + steps + 40) % 40, p.color);
    delete el.dataset.moving;
    this.focusPos = null;
  }

  // ---------- little effects on the board ----------
  fx(pt, cls, html, ms) {
    const el = document.createElement('div');
    el.className = `fx ${cls}`;
    el.style.transform = `translate3d(${pt.x}px,${pt.y}px,0)`;
    el.innerHTML = `<div class="bb">${html}</div>`;
    this.plane.appendChild(el);
    setTimeout(() => el.remove(), ms);
    return el;
  }
  puff(pt) {
    this.fx(pt, 'puff', '<i></i><i></i><i></i>', 600);
  }
  ripple(i, color) {
    const c = center(i), el = document.createElement('div');
    el.className = 'ripple';
    el.style.cssText = `left:${c.x}px;top:${c.y}px;--pc:${color || '#fff'}`;
    this.plane.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  // A burst of coins, sparkles, stars or hearts popping up from a tile.
  burst(i, kind = 'sparkle', color = '#f2c443') {
    const c = center(i), n = kind === 'coins' ? 7 : 9;
    const glyph = { coins: '<b>₱</b>', sparkle: '✦', stars: '★', hearts: '♥' }[kind] || '✦';
    const parts = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5, r = 34 + Math.random() * 30;
      return `<i style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(-40 - Math.random() * 60).toFixed(0)}px;--d:${(Math.random() * 0.15).toFixed(2)}s;--c:${color}">${glyph}</i>`;
    }).join('');
    this.fx(c, `burst ${kind}`, parts, 1500);
  }

  async glide(p, toPos, jailed) {
    const el = this.tokens.get(p.id);
    el.dataset.moving = '1';
    el.classList.add('gliding');
    this.setTokenPos(p.id, this.slot(p, toPos, jailed));
    if (this.mode === 'follow') { this.focusPos = toPos; this.applyCamera(false, 900 / this.speed); }
    await this.wait(950);
    el.classList.remove('gliding');
    delete el.dataset.moving;
    this.focusPos = null;
  }

  pulseTile(i, cls = 'flash') {
    const el = this.plane.querySelector(`.tile[data-i="${i}"]`);
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  destroy() { window.removeEventListener('sheetchange', this.onSheet); this.ro.disconnect(); this.stage.innerHTML = ''; }
}
