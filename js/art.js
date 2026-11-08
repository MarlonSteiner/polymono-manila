// All artwork is drawn here as SVG, in a soft hand-inked isometric style.
import { GROUPS } from './data.js';

export const C = {
  ink: '#4a3428', cream: '#fdf6e6', wall: '#f5e4c8', wallSh: '#dfc6a0', roof: '#c4684b',
  glass: '#acdcea', glassSh: '#86c4d6', leaf: '#8dc26c', leafD: '#629e50', blossom: '#f7a9a4',
  water: '#93d7e2', waterD: '#69bccd', grass: '#c8de92', grassD: '#a9c873', stone: '#e0d8c7', stoneD: '#c9bea8',
  wood: '#b07650', woodD: '#8a5638', sun: '#ffcf6b',
};
const S = 0.5, K = 0.866;

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, '0')).join('');
}

const pts = (a) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;

// ---------- isometric buildings ----------
// Returns { svg, w, h } where the sprite's anchor (ground contact) is at bottom-centre.
export function building(o) {
  const { w = 40, d = 40, h = 50, wall = C.wall, roof = C.roof, type = 'gable', rh = 16, win = 'house', accent = null, ink = C.ink } = o;
  const P = (x, y, z) => [(x - y) * K, (x + y) * S - z];
  const sh = o.wallSh || shade(wall, -0.16);
  const out = [];
  const L = (u0, v0, u1, v1, f, ex = '') => out.push(poly([P(u0, d, v0), P(u1, d, v0), P(u1, d, v1), P(u0, d, v1)], f, ex));
  const R = (u0, v0, u1, v1, f, ex = '') => out.push(poly([P(w, u0, v0), P(w, u1, v0), P(w, u1, v1), P(w, u0, v1)], f, ex));
  // shadow
  out.push(`<ellipse cx="${((w - d) * K) / 2}" cy="${((w + d) * S) / 2 + 4}" rx="${(w + d) * 0.62}" ry="${(w + d) * 0.3}" fill="${ink}" opacity=".13"/>`);
  // walls
  out.push(poly([P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h)], wall));
  out.push(poly([P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h)], sh));
  // windows
  const glassL = C.glass, glassR = C.glassSh, frame = C.cream;
  if (win === 'tower') {
    const fl = Math.max(2, Math.floor((h - 6) / 9));
    for (let r = 0; r < fl; r++) {
      const v0 = 5 + r * ((h - 8) / fl), v1 = v0 + ((h - 8) / fl) * 0.62;
      for (let u = 4; u + 5 <= w - 2; u += 8) L(u, v0, u + 5, v1, glassL);
      for (let u = 4; u + 5 <= d - 2; u += 8) R(u, v0, u + 5, v1, glassR);
    }
  } else if (win === 'mall') {
    L(3, 3, w - 3, h * 0.42, glassL); R(3, 3, d - 3, h * 0.42, glassR);
    L(4, h * 0.56, w - 4, h - 3, accent || C.roof);
  } else if (win === 'house') {
    const dw = Math.min(8, w * 0.22);
    L(w * 0.14, 0, w * 0.14 + dw, Math.min(15, h * 0.6), C.wood);
    if (w > 22) L(w * 0.52, h * 0.38, w * 0.52 + Math.min(11, w * 0.3), h * 0.38 + Math.min(10, h * 0.42), glassL, `stroke="${frame}" stroke-width="1.6"`);
    if (d > 16) R(d * 0.3, h * 0.38, d * 0.3 + Math.min(11, d * 0.36), h * 0.38 + Math.min(10, h * 0.42), glassR, `stroke="${frame}" stroke-width="1.6"`);
  } else if (win === 'stone') {
    for (let u = 3; u < w - 3; u += 9) L(u, h * 0.3, u + 4, h * 0.3 + 4, shade(wall, -0.12));
    L(w / 2 - 5, 0, w / 2 + 5, h * 0.7, C.ink, 'opacity=".7"');
  }
  // roofs
  if (type === 'gable') {
    const o2 = 3;
    out.push(poly([P(0, 0, h), P(w, 0, h), P(w, d / 2, h + rh), P(0, d / 2, h + rh)], shade(roof, -0.22)));
    out.push(poly([P(w, 0, h), P(w, d, h), P(w, d / 2, h + rh)], sh));
    out.push(poly([P(-o2, d + o2, h - 2), P(w + o2, d + o2, h - 2), P(w + o2, d / 2, h + rh), P(-o2, d / 2, h + rh)], roof));
    for (let k = 1; k < 3; k++) {
      const t = k / 3, yy = d + o2 - (d / 2 + o2) * t, zz = h - 2 + (rh + 2) * t;
      out.push(`<polyline points="${pts([P(-o2, yy, zz), P(w + o2, yy, zz)])}" fill="none" stroke="${shade(roof, -0.25)}" stroke-width="1.2"/>`);
    }
  } else if (type === 'flat' || type === 'antenna' || type === 'helipad') {
    out.push(poly([P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)], roof));
    out.push(poly([P(2.5, 2.5, h), P(w - 2.5, 2.5, h), P(w - 2.5, d - 2.5, h), P(2.5, d - 2.5, h)], shade(roof, -0.12), 'stroke="none"'));
    if (type === 'antenna') {
      const a = P(w / 2, d / 2, h), b = P(w / 2, d / 2, h + 16);
      out.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ink}" stroke-width="2"/><circle cx="${b[0]}" cy="${b[1]}" r="2.6" fill="${accent || '#e2584f'}"/>`);
    }
    if (type === 'helipad') {
      const c = P(w / 2, d / 2, h);
      out.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${w * 0.3}" ry="${w * 0.17}" fill="none" stroke="${C.cream}" stroke-width="1.5"/>`);
    }
  } else if (type === 'cren') {
    out.push(poly([P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)], shade(wall, 0.15)));
    for (let u = 0; u < w; u += 8) {
      const b = [[u, d - 5], [u + 4, d - 5], [u + 4, d], [u, d]];
      out.push(poly([P(b[0][0], b[0][1], h + 5), P(b[1][0], b[1][1], h + 5), P(b[2][0], b[2][1], h + 5), P(b[3][0], b[3][1], h + 5)], shade(wall, 0.15)));
      out.push(poly([P(u, d, h), P(u + 4, d, h), P(u + 4, d, h + 5), P(u, d, h + 5)], wall));
    }
  } else if (type === 'dome') {
    out.push(poly([P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)], shade(wall, 0.1)));
    const c = P(w / 2, d / 2, h), r = Math.min(w, d) * 0.42;
    out.push(`<path d="M${c[0] - r},${c[1]} a${r},${r * 1.05} 0 0 1 ${2 * r},0 z" fill="${roof}"/>`);
    out.push(`<line x1="${c[0]}" y1="${c[1] - r * 1.05}" x2="${c[0]}" y2="${c[1] - r * 1.05 - 9}" stroke="${ink}" stroke-width="1.6"/><line x1="${c[0] - 3.5}" y1="${c[1] - r * 1.05 - 6}" x2="${c[0] + 3.5}" y2="${c[1] - r * 1.05 - 6}" stroke="${ink}" stroke-width="1.6"/>`);
  } else if (type === 'pagoda') {
    const o2 = 6;
    out.push(poly([P(-o2, -2, h), P(w + o2, -2, h), P(w + o2, d + 2, h), P(-o2, d + 2, h)], shade(roof, -0.15)));
    const a = P(-o2, d + 2, h), b = P(w + o2, d + 2, h), t1 = P(w * 0.15, d / 2, h + rh), t2 = P(w * 0.85, d / 2, h + rh);
    out.push(`<path d="M${a[0]},${a[1] - 5} Q${t1[0] - 4},${t1[1] + 6} ${t1[0]},${t1[1]} L${t2[0]},${t2[1]} Q${t2[0] + 4},${t2[1] + 6} ${b[0]},${b[1] - 5} L${b[0]},${b[1]} L${a[0]},${a[1]} z" fill="${roof}"/>`);
  }
  if (o.sign) {
    const c = P(w * 0.5, d, h * 0.78);
    out.push(`<rect x="${c[0] - o.sign.length * 3.4 - 4}" y="${c[1] - 6}" width="${o.sign.length * 6.8 + 8}" height="11" rx="3" fill="${C.cream}" transform="skewY(30) translate(0 ${-c[0] * 0.577})"/><text x="${c[0]}" y="${c[1] + 2.8}" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="8.5" fill="${ink}" stroke="none" transform="skewY(30) translate(0 ${-c[0] * 0.577})">${o.sign}</text>`);
  }
  const minX = -d * K - 8, maxX = w * K + 8, minY = -h - rh - 22, maxY = (w + d) * S + 10;
  return {
    w: maxX - minX, h: maxY - minY,
    svg: `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" xmlns="http://www.w3.org/2000/svg"><g stroke="${ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${out.join('')}</g></svg>`,
  };
}

export function tree(blossom = true, s = 1) {
  const dots = blossom ? [[-9, -40], [8, -46], [12, -30], [-4, -27], [-14, -31], [2, -52]]
    .map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="2.3" fill="${C.blossom}"/><circle r="1" fill="#fff6" stroke="none"/></g>`).join('') : '';
  const svg = `<svg viewBox="-30 -66 60 72" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round">
    <ellipse cx="0" cy="2" rx="16" ry="5" fill="${C.ink}" opacity=".13" stroke="none"/>
    <path d="M-4,2 L-3,-18 L3,-18 L4,2 Z" fill="${C.wood}"/>
    <path d="M-20,-24 C-30,-30 -24,-46 -14,-46 C-14,-60 6,-64 12,-54 C24,-56 28,-40 20,-32 C26,-22 12,-14 4,-18 C-2,-12 -18,-14 -20,-24 Z" fill="${C.leaf}"/>
    <path d="M-12,-22 C-6,-18 4,-18 10,-22" fill="none" stroke="${C.leafD}" stroke-width="1.4"/>
    ${dots}</g></svg>`;
  return { svg, w: 60 * s, h: 72 * s };
}

export function palm(s = 1) {
  const svg = `<svg viewBox="-34 -84 68 90" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
    <ellipse cx="2" cy="2" rx="14" ry="4.5" fill="${C.ink}" opacity=".13" stroke="none"/>
    <path d="M-3,2 C-2,-24 2,-46 8,-62 L13,-60 C8,-44 4,-22 4,2 Z" fill="${C.wood}"/>
    <path d="M-1,-14 L5,-15 M0,-28 L6,-28 M2,-42 L8,-41" stroke="${C.woodD}" stroke-width="1.3"/>
    <path d="M10,-62 C0,-74 -18,-72 -28,-60 C-16,-66 -4,-64 10,-62 Z" fill="${C.leaf}"/>
    <path d="M10,-62 C20,-76 34,-72 34,-56 C26,-66 18,-64 10,-62 Z" fill="${C.leaf}"/>
    <path d="M10,-62 C2,-56 -8,-44 -10,-34 C-2,-46 4,-54 10,-62 Z" fill="${C.leafD}"/>
    <path d="M10,-62 C20,-56 26,-46 26,-36 C20,-46 16,-54 10,-62 Z" fill="${C.leafD}"/>
    <path d="M10,-62 C6,-76 12,-84 20,-82 C14,-76 12,-70 10,-62 Z" fill="${C.leaf}"/>
    <circle cx="8" cy="-60" r="3" fill="#a5683f"/><circle cx="13" cy="-59" r="3" fill="#a5683f"/></g></svg>`;
  return { svg, w: 68 * s, h: 90 * s };
}

// ---------- tokens ----------
const face = (x, y, s = 1, blush = '#f59b9b') => `
  <g transform="translate(${x} ${y}) scale(${s})" stroke="none">
    <ellipse cx="-7" cy="0" rx="2.3" ry="2.9" fill="${C.ink}"/><ellipse cx="7" cy="0" rx="2.3" ry="2.9" fill="${C.ink}"/>
    <circle cx="-6.3" cy="-1" r=".8" fill="#fff"/><circle cx="7.7" cy="-1" r=".8" fill="#fff"/>
    <ellipse cx="-12" cy="5" rx="3.6" ry="2.2" fill="${blush}" opacity=".85"/><ellipse cx="12" cy="5" rx="3.6" ry="2.2" fill="${blush}" opacity=".85"/>
    <path d="M-3,4 Q0,7 3,4" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linecap="round"/></g>`;

const TOKEN_ART = {
  jeepney: `
    <path d="M10,34 Q10,26 18,26 L66,26 Q72,26 72,32 L72,36 L10,36 Z" fill="#eef0f2"/>
    <rect x="22" y="19" width="34" height="8" rx="3" fill="#f2c443"/><text x="39" y="25.6" text-anchor="middle" font-size="6.5" font-weight="800" font-family="Fredoka,sans-serif" fill="${C.ink}" stroke="none">MANILA</text>
    <path d="M12,36 L72,36 L72,46 L88,52 Q92,54 92,60 L92,74 L12,74 Q8,74 8,70 L8,40 Q8,36 12,36 Z" fill="#e2584f"/>
    <path d="M8,58 L92,58 L92,63 L8,63 Z" fill="#f2c443"/><path d="M8,63 L92,63 L92,67 L8,67 Z" fill="#4a86d6"/>
    <rect x="13" y="40" width="11" height="12" rx="3" fill="${C.glass}"/><rect x="27" y="40" width="11" height="12" rx="3" fill="${C.glass}"/>
    <rect x="41" y="40" width="11" height="12" rx="3" fill="${C.glass}"/><rect x="55" y="40" width="13" height="12" rx="3" fill="${C.glass}"/>
    <path d="M74,40 L84,47 L74,47 Z" fill="${C.glass}"/>
    <path d="M86,46 l3,-8 l2,3 l2,-2 l-1,7 z" fill="#d9dde2"/>
    <circle cx="89" cy="56" r="3" fill="#fff7c2"/>
    <circle cx="27" cy="75" r="9" fill="#4b4444"/><circle cx="27" cy="75" r="3.5" fill="#d9dde2"/>
    <circle cx="74" cy="75" r="9" fill="#4b4444"/><circle cx="74" cy="75" r="3.5" fill="#d9dde2"/>`,
  puspin: `
    <path d="M70,70 C88,66 90,46 80,40" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
    <path d="M70,70 C88,66 90,46 80,40" fill="none" stroke="#f3a24f" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M28,82 C20,82 20,58 30,48 L70,48 C80,58 80,82 72,82 Z" fill="#f3a24f"/>
    <path d="M36,82 C36,70 64,70 64,82 Z" fill="#fde7c8"/>
    <path d="M22,32 L24,8 L40,20 Z" fill="#f3a24f"/><path d="M78,32 L76,8 L60,20 Z" fill="#f3a24f"/>
    <path d="M27,24 L28,14 L35,20 Z" fill="#f7b9b0" stroke="none"/><path d="M73,24 L72,14 L65,20 Z" fill="#f7b9b0" stroke="none"/>
    <ellipse cx="50" cy="38" rx="30" ry="24" fill="#f3a24f"/>
    <path d="M43,15 L45,23 M50,14 L50,22 M57,15 L55,23" stroke="#c97a2e" stroke-width="2.4"/>
    ${face(50, 38, 1.05)}
    <path d="M44,44 l-14,-2 M44,46 l-13,3 M56,44 l14,-2 M56,46 l13,3" stroke="${C.ink}" stroke-width="1" opacity=".6"/>`,
  halohalo: `
    <path d="M24,40 L76,40 L68,82 Q67,86 62,86 L38,86 Q33,86 32,82 Z" fill="#eaf6fb" opacity=".95"/>
    <path d="M28,62 L72,62 L68,82 Q67,86 62,86 L38,86 Q33,86 32,82 Z" fill="#9b7ed8"/>
    <path d="M26,52 L74,52 L72,62 L28,62 Z" fill="#e2584f"/>
    <circle cx="34" cy="57" r="2" fill="#f2c443" stroke="none"/><circle cx="46" cy="58" r="2" fill="#7cc06a" stroke="none"/><circle cx="60" cy="56" r="2" fill="#f2c443" stroke="none"/>
    <path d="M22,42 C22,24 78,24 78,42 Z" fill="#fff"/>
    <rect x="34" y="20" width="16" height="11" rx="2.5" fill="#f8cf55"/><path d="M34,22 L50,22" stroke="#c98f2a" stroke-width="2"/>
    <circle cx="61" cy="24" r="10" fill="#8d6cc9"/>
    <path d="M70,8 L64,40" stroke="${C.ink}" stroke-width="3"/><path d="M70,8 L64,40" stroke="#f2c443" stroke-width="1.4"/>
    ${face(50, 72, 0.9, '#f7b0cc')}`,
  mangga: `
    <path d="M72,22 C70,14 78,8 86,10 C82,16 80,20 72,22 Z" fill="#7cc06a"/>
    <path d="M60,22 L64,14" stroke="${C.ink}" stroke-width="3"/>
    <path d="M30,30 C46,12 82,20 82,50 C82,74 64,88 44,86 C22,84 14,62 22,46 C26,38 26,36 30,30 Z" fill="#f6c443"/>
    <path d="M30,34 C40,24 56,22 62,26" fill="none" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>
    <path d="M66,74 C74,66 78,58 78,50" fill="none" stroke="#e79a2e" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    ${face(50, 56, 1.05)}`,
  pandesal: `
    <path d="M14,64 C10,40 30,26 50,26 C70,26 90,40 86,64 C84,78 70,84 50,84 C30,84 16,78 14,64 Z" fill="#d8955a"/>
    <path d="M22,48 C28,34 44,30 50,30 C62,30 76,36 80,48 C68,42 32,42 22,48 Z" fill="#f0d3a0"/>
    <g fill="#fff3d6" stroke="none"><circle cx="34" cy="38" r="1.5"/><circle cx="44" cy="35" r="1.3"/><circle cx="58" cy="35" r="1.5"/><circle cx="68" cy="39" r="1.3"/><circle cx="51" cy="39" r="1.2"/></g>
    <path d="M20,70 C36,78 64,78 80,70 L82,76 C64,86 36,86 18,76 Z" fill="#33a99b"/>
    <path d="M70,74 L78,88 L84,84 L76,72" fill="#33a99b"/>
    ${face(50, 58, 1.05)}`,
  trike: `
    <path d="M8,40 Q8,30 18,30 L46,30 Q52,30 52,36 L52,40 Z" fill="#f2c443"/>
    <path d="M10,40 L52,40 L52,72 L10,72 Q6,72 6,68 L6,44 Q6,40 10,40 Z" fill="#4a86d6"/>
    <rect x="14" y="44" width="14" height="12" rx="3" fill="${C.glass}"/><rect x="31" y="44" width="15" height="12" rx="3" fill="${C.glass}"/>
    <path d="M6,62 L52,62 L52,66 L6,66 Z" fill="#fff"/>
    <path d="M52,58 L72,58 L84,48" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
    <path d="M60,52 Q66,44 76,46 L74,58 L58,58 Z" fill="#e2584f"/>
    <path d="M82,44 l8,-4" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="86" cy="54" r="2.8" fill="#fff7c2"/>
    <circle cx="20" cy="76" r="8.5" fill="#4b4444"/><circle cx="20" cy="76" r="3" fill="#d9dde2"/>
    <circle cx="80" cy="74" r="10" fill="#4b4444"/><circle cx="80" cy="74" r="3.6" fill="#d9dde2"/>`,
};

export function tokenSVG(id, opts = {}) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="tok-svg">
    ${opts.shadow === false ? '' : `<ellipse cx="50" cy="90" rx="34" ry="7" fill="${C.ink}" opacity=".18"/>`}
    <g stroke="${C.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${TOKEN_ART[id]}</g></svg>`;
}

// ---------- tile icons ----------
const flatIcon = (body, vb = '0 0 60 50') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

export function tileIcon(look, group) {
  const g = group ? GROUPS[group].color : C.roof;
  switch (look) {
    case 'stall': return building({ w: 30, d: 22, h: 14, roof: g, rh: 10, win: 'house' }).svg;
    case 'church': return building({ w: 30, d: 26, h: 26, roof: g, type: 'dome', win: 'stone', wall: '#efe0c4' }).svg;
    case 'fort': return building({ w: 44, d: 18, h: 16, type: 'cren', win: 'stone', wall: '#d8c7a6' }).svg;
    case 'arch': return building({ w: 36, d: 10, h: 22, roof: g, type: 'pagoda', rh: 10, win: 'stone', wall: '#e9c9a3' }).svg;
    case 'shop': return building({ w: 28, d: 26, h: 28, roof: g, rh: 14, win: 'house' }).svg;
    case 'cafe': return building({ w: 30, d: 26, h: 22, roof: g, type: 'flat', win: 'house' }).svg;
    case 'mall': return building({ w: 50, d: 34, h: 22, roof: shade(g, 0.35), type: 'flat', win: 'mall', accent: g }).svg;
    case 'store': return building({ w: 52, d: 32, h: 20, roof: '#e9e1d2', type: 'flat', win: 'mall', accent: g }).svg;
    case 'tower': return building({ w: 22, d: 22, h: 62, wall: '#e6eef0', wallSh: '#c9d8dd', roof: g, type: 'antenna', win: 'tower', accent: g }).svg;
    case 'villa': return building({ w: 34, d: 30, h: 18, roof: g, rh: 12, win: 'house', wall: '#fbf1de' }).svg;
    case 'park': return flatIcon(`
      <ellipse cx="30" cy="40" rx="27" ry="8" fill="${C.grass}"/>
      <path d="M14,38 L14,30" /><circle cx="14" cy="24" r="9" fill="${C.leaf}"/><circle cx="11" cy="21" r="1.8" fill="${C.blossom}" stroke="none"/><circle cx="17" cy="26" r="1.8" fill="${C.blossom}" stroke="none"/>
      <path d="M46,38 L46,28" /><circle cx="46" cy="21" r="10" fill="${C.leaf}"/><circle cx="43" cy="18" r="1.8" fill="${C.blossom}" stroke="none"/><circle cx="50" cy="23" r="1.8" fill="${C.blossom}" stroke="none"/>
      <ellipse cx="30" cy="40" rx="7" ry="3" fill="${C.water}"/><path d="M30,38 C28,32 32,32 30,28" fill="none" stroke="${C.waterD}"/>
      <rect x="25" y="16" width="10" height="4" rx="2" fill="${g}"/>`);
    case 'train': return flatIcon(`
      <path d="M10,44 L50,44" stroke-width="3"/><path d="M14,48 L18,44 M24,48 L28,44 M34,48 L38,44 M44,48 L48,44" stroke-width="1.6"/>
      <rect x="12" y="8" width="36" height="32" rx="8" fill="#eef0f2"/>
      <rect x="16" y="13" width="28" height="12" rx="3" fill="${C.glass}"/>
      <path d="M12,30 L48,30" stroke="#9b7ed8" stroke-width="4"/>
      <circle cx="19" cy="35" r="2.4" fill="#fff7c2"/><circle cx="41" cy="35" r="2.4" fill="#fff7c2"/>
      <rect x="24" y="4" width="12" height="5" rx="2" fill="#f2c443"/>`);
    case 'boat': return flatIcon(`
      <path d="M4,40 Q12,36 20,40 T36,40 T52,40" fill="none" stroke="${C.waterD}" stroke-width="2.4"/>
      <path d="M8,30 L52,30 L46,40 L14,40 Z" fill="#fdf6e6"/>
      <path d="M8,30 L52,30 L50,33 L10,33 Z" fill="#4a86d6"/>
      <rect x="16" y="16" width="28" height="14" rx="4" fill="#e2584f"/>
      <rect x="20" y="19" width="8" height="6" rx="1.5" fill="${C.glass}"/><rect x="32" y="19" width="8" height="6" rx="1.5" fill="${C.glass}"/>
      <path d="M30,16 L30,8 L38,11 L30,13" fill="#f2c443"/>`);
    case 'bolt': return flatIcon(`
      <circle cx="30" cy="24" r="19" fill="#fff4c2"/>
      <path d="M33,6 L18,28 L28,28 L24,44 L42,20 L31,20 Z" fill="#f2c443"/>`);
    case 'drop': return flatIcon(`
      <circle cx="30" cy="25" r="19" fill="#dff3f7"/>
      <path d="M30,6 C22,18 16,26 16,32 C16,40 22,45 30,45 C38,45 44,40 44,32 C44,26 38,18 30,6 Z" fill="${C.water}"/>
      <path d="M23,32 C23,37 26,40 30,40" fill="none" stroke="#fff" stroke-width="2.4"/>`);
    case 'swerte': return flatIcon(`
      <rect x="14" y="6" width="32" height="40" rx="6" fill="#f6b84b" transform="rotate(-8 30 26)"/>
      <rect x="14" y="6" width="32" height="40" rx="6" fill="#ffd36e"/>
      <path d="M30,14 L33,22 L41,22 L35,27 L37,35 L30,30 L23,35 L25,27 L19,22 L27,22 Z" fill="#fff"/>`);
    case 'bayanihan': return flatIcon(`
      <rect x="10" y="8" width="40" height="36" rx="6" fill="#7fcfc4"/>
      <path d="M18,26 L30,14 L42,26 Z" fill="#c9a065"/><rect x="21" y="26" width="18" height="10" fill="#f0d7a8"/>
      <rect x="27" y="29" width="6" height="7" fill="${C.wood}"/>
      <path d="M20,36 L18,42 M26,36 L25,42 M34,36 L35,42 M40,36 L42,42" stroke-width="2.2"/>
      <path d="M44,12 c-2,-3 -6,-1 -4,2 l4,4 l4,-4 c2,-3 -2,-5 -4,-2z" fill="#f28c8c" stroke-width="1.4"/>`);
    case 'tax': return flatIcon(`
      <path d="M16,6 L44,6 L44,44 L40,41 L36,44 L32,41 L28,44 L24,41 L20,44 L16,41 Z" fill="#fdf6e6"/>
      <path d="M22,16 L38,16 M22,23 L38,23 M22,30 L32,30" stroke-width="2"/>
      <circle cx="40" cy="36" r="9" fill="#f2c443"/><text x="40" y="40" text-anchor="middle" font-size="11" font-weight="800" font-family="Fredoka,sans-serif" fill="${C.ink}" stroke="none">₱</text>`);
    case 'toll': return flatIcon(`
      <rect x="8" y="16" width="16" height="26" rx="2" fill="#fdf6e6"/><rect x="5" y="10" width="22" height="7" rx="2" fill="#e2584f"/>
      <rect x="11" y="21" width="10" height="7" rx="1.5" fill="${C.glass}"/>
      <path d="M24,30 L56,30" stroke-width="5" stroke="${C.ink}"/><path d="M26,30 L54,30" stroke-width="2.6" stroke="#fff"/>
      <path d="M30,30 L34,30 M40,30 L44,30 M50,30 L54,30" stroke="#e2584f" stroke-width="2.6"/>`);
  }
  return '';
}

// ---------- corners ----------
export function cornerSVG(type) {
  const wrap = (b) => `<svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${b}</g></svg>`;
  const T = (x, y, s, txt, fill = C.ink, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="${s}" fill="${fill}" stroke="none" ${extra}>${txt}</text>`;
  if (type === 'start') return wrap(`
    <rect x="0" y="0" width="140" height="140" fill="#ffe7a8" stroke="none"/>
    <g opacity=".5" stroke="none" fill="#ffd36e">${Array.from({ length: 12 }, (_, k) => `<path d="M70,70 L${70 + 110 * Math.cos((k * 30 - 4) * Math.PI / 180)},${70 + 110 * Math.sin((k * 30 - 4) * Math.PI / 180)} L${70 + 110 * Math.cos((k * 30 + 8) * Math.PI / 180)},${70 + 110 * Math.sin((k * 30 + 8) * Math.PI / 180)} Z"/>`).join('')}</g>
    <circle cx="70" cy="56" r="24" fill="#ffcf6b"/>${face(70, 56, 1.15)}
    ${T(70, 102, 25, 'SIMULA', C.ink)}
    ${T(70, 120, 11.5, 'collect ₱2,000 sweldo', C.ink, 'font-weight="600"')}
    <path d="M14,132 L14,84" stroke="#e2584f" stroke-width="7"/><path d="M5,94 L14,80 L23,94" fill="none" stroke="#e2584f" stroke-width="7"/>`);
  if (type === 'jail') return wrap(`
    <rect x="0" y="0" width="140" height="140" fill="#f7efe0" stroke="none"/>
    <rect x="34" y="0" width="106" height="106" fill="#f6b2a0" stroke="none"/>
    <rect x="40" y="6" width="94" height="94" rx="10" fill="#d9d2c4"/>
    <path d="M40,40 L134,40 M40,72 L134,72" stroke="#fff" stroke-dasharray="7 7" stroke-width="2.4"/>
    <g transform="translate(46 12) scale(.36)">${TOKEN_ART.jeepney}</g>
    <g transform="translate(88 30) scale(.36)">${TOKEN_ART.trike}</g>
    <g transform="translate(60 44) scale(.4)">${TOKEN_ART.jeepney}</g>
    <circle cx="124" cy="88" r="8" fill="#e2584f"/><circle cx="124" cy="88" r="3" fill="#fff" stroke="none"/>
    ${T(87, 96, 13, 'EDSA', '#fff', 'stroke="#4a3428" stroke-width="3" paint-order="stroke"')}
    ${T(17, 70, 11, 'JUST PASSING', C.ink, 'transform="rotate(90 17 70)"')}
    ${T(87, 126, 11, 'JUST PASSING')}`);
  if (type === 'parking') return wrap(`
    <rect x="0" y="0" width="140" height="140" fill="#d9efd0" stroke="none"/>
    <ellipse cx="70" cy="72" rx="50" ry="17" fill="#fdf6e6"/>
    <path d="M44,40 L46,70 Q47,78 58,78 L66,78 Q76,78 77,70 L79,40 Z" fill="#fdf6e6"/>
    <path d="M47,48 L76,48 L75,66 L48,66 Z" fill="#9b5e3c" stroke="none"/>
    <path d="M79,48 C92,48 92,64 78,64" fill="none" stroke-width="4"/>
    <path d="M54,32 C50,26 58,22 54,16 M64,32 C60,26 68,22 64,16" fill="none" stroke="#b9a693"/>
    <ellipse cx="97" cy="74" rx="15" ry="11" fill="#d8955a"/><path d="M86,70 C92,64 102,64 108,70" fill="none" stroke="#f0d3a0" stroke-width="3"/>
    ${T(70, 112, 22, 'MERIENDA')}
    ${T(70, 128, 11, 'free rest stop', C.ink, 'font-weight="600"')}`);
  return wrap(`
    <rect x="0" y="0" width="140" height="140" fill="#ffd9cf" stroke="none"/>
    <circle cx="70" cy="48" r="25" fill="#fdf6e6"/>
    <rect x="47" y="21" width="46" height="13" rx="5" fill="#4a6db0"/><rect x="62" y="16" width="16" height="7" rx="3" fill="#f2c443"/>
    ${face(70, 52, 1)}
    <path d="M86,62 L104,70 L101,76 L84,68 Z" fill="#c9cdd2"/><circle cx="106" cy="73" r="5" fill="#c9cdd2"/>
    <path d="M110,58 l6,-4 M112,66 l8,0" stroke="#e2584f"/>
    ${T(70, 100, 26, 'HULI!', '#e2584f', 'stroke="#4a3428" stroke-width="3.5" paint-order="stroke"')}
    ${T(70, 120, 11.5, 'go straight to traffic', C.ink, 'font-weight="600"')}`);
}

// ---------- logo ----------
export function logoSVG() {
  return `<svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" class="logo-svg">
    <defs><linearGradient id="lg-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd36e"/><stop offset="1" stop-color="#f6915a"/></linearGradient></defs>
    <circle cx="300" cy="44" r="26" fill="url(#lg-sun)" stroke="${C.ink}" stroke-width="3"/>
    <g font-family="Fredoka, Nunito, sans-serif" font-weight="700" text-anchor="middle">
      <text x="180" y="86" font-size="76" fill="${C.ink}" stroke="${C.ink}" stroke-width="14" stroke-linejoin="round">Polymono</text>
      <text x="180" y="80" font-size="76" fill="#fff8e8" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">Polymono</text>
    </g>
    <g transform="translate(180 112)">
      <path d="M-104,-14 L104,-14 L94,4 L104,22 L-104,22 L-94,4 Z" fill="#e2584f" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M-86,-14 L86,-14 L86,22 L-86,22 Z" fill="#e2584f" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M-86,10 L86,10" stroke="#f2c443" stroke-width="4"/><path d="M-86,16 L86,16" stroke="#4a86d6" stroke-width="4"/>
      <text x="0" y="5" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="21" letter-spacing="9" fill="#fff">MANILA</text>
    </g></svg>`;
}

// ---------- card faces ----------
export function deckArt(deck) {
  return deck === 'swerte'
    ? `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round">
        <circle cx="60" cy="40" r="30" fill="#ffe08a"/>
        <path d="M60,16 L66,32 L83,32 L69,42 L74,58 L60,48 L46,58 L51,42 L37,32 L54,32 Z" fill="#fff"/>
        <circle cx="22" cy="18" r="4" fill="#f7a9a4"/><circle cx="100" cy="62" r="5" fill="#93d7e2"/><circle cx="100" cy="16" r="3" fill="#8dc26c"/></g></svg>`
    : `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><g stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
        <path d="M34,40 L60,16 L86,40 Z" fill="#d1a76b"/><path d="M40,34 L80,34" stroke="#b08850"/>
        <rect x="40" y="40" width="40" height="18" fill="#f3dcb0"/><rect x="55" y="44" width="10" height="14" fill="${C.wood}"/>
        <path d="M44,58 L40,70 M54,58 L52,70 M66,58 L68,70 M76,58 L80,70" stroke-width="3"/>
        <circle cx="40" cy="72" r="3" fill="${C.ink}"/><circle cx="52" cy="72" r="3" fill="${C.ink}"/><circle cx="68" cy="72" r="3" fill="${C.ink}"/><circle cx="80" cy="72" r="3" fill="${C.ink}"/>
        <path d="M98,22 c-3,-5 -10,-2 -7,3 l7,7 l7,-7 c3,-5 -4,-8 -7,-3z" fill="#f28c8c" stroke-width="2"/></g></svg>`;
}

// ---------- the board centre: a hand-drawn map of the bay and the city ----------
export function centerMapSVG() {
  const W = 720;
  const blossomTree = (x, y, r) => `<g transform="translate(${x} ${y})"><ellipse cx="4" cy="${r * 0.7}" rx="${r}" ry="${r * 0.45}" fill="${C.ink}" opacity=".12" stroke="none"/>
    <circle r="${r}" fill="${C.leaf}"/><path d="M${-r * 0.5},${r * 0.35} Q0,${r * 0.6} ${r * 0.5},${r * 0.35}" fill="none" stroke="${C.leafD}" stroke-width="1.5"/>
    ${[[-0.45, -0.3], [0.3, -0.45], [0.4, 0.15], [-0.15, 0.2], [0, -0.1]].map(([a, b]) => `<circle cx="${a * r}" cy="${b * r}" r="${r * 0.13}" fill="${C.blossom}" stroke="none"/>`).join('')}</g>`;
  const trees = [[150, 120, 18], [190, 100, 14], [600, 110, 20], [640, 150, 15], [560, 640, 18], [610, 600, 14], [300, 640, 16], [345, 664, 12],
    [460, 96, 13], [520, 300, 14], [668, 400, 17], [626, 470, 13], [210, 560, 15], [420, 560, 12], [680, 680, 14], [96, 690, 12]]
    .map(([x, y, r]) => blossomTree(x, y, r)).join('');
  const waves = Array.from({ length: 14 }, (_, k) => {
    const x = 18 + (k % 3) * 34, y = 60 + k * 46;
    return `<path d="M${x},${y} q6,-5 12,0 t12,0" fill="none" stroke="#fff" stroke-width="2.4" opacity=".75"/>`;
  }).join('');
  const lily = [[96, 200], [70, 520], [120, 610]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0,0 m-9,0 a9,6 0 1 0 18,0 a9,6 0 1 0 -18,0 M0,0 L8,-3" fill="#8dc26c"/><circle cx="-3" cy="-2" r="2.6" fill="#f7a9a4" stroke="none"/></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" class="center-map">
  <defs>
    <pattern id="grassdots" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M6,8 l2,-4 l2,4 M18,20 l2,-4 l2,4" fill="none" stroke="${C.grassD}" stroke-width="1.3" stroke-linecap="round"/></pattern>
    <linearGradient id="bay" x1="0" x2="1"><stop offset="0" stop-color="#7fcfdc"/><stop offset="1" stop-color="#a4dfe7"/></linearGradient>
    <linearGradient id="glow" x1="0" x2="1"><stop offset="0" stop-color="#ffb37a" stop-opacity=".75"/><stop offset="1" stop-color="#ffb37a" stop-opacity="0"/></linearGradient>
  </defs>
  <g stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <rect x="0" y="0" width="${W}" height="${W}" fill="${C.grass}" stroke="none"/>
    <rect x="0" y="0" width="${W}" height="${W}" fill="url(#grassdots)" stroke="none"/>
    <!-- Manila Bay on the west -->
    <path d="M0,0 L118,0 C150,90 112,170 132,250 C150,330 104,410 126,500 C146,590 100,650 130,720 L0,720 Z" fill="url(#bay)"/>
    <path d="M0,330 L120,330 L100,400 L0,400 Z" fill="url(#glow)" stroke="none" opacity=".8"/>
    ${waves}${lily}
    <!-- boardwalk -->
    <path d="M118,0 C150,90 112,170 132,250 C150,330 104,410 126,500 C146,590 100,650 130,720" fill="none" stroke="${C.stone}" stroke-width="16"/>
    <path d="M118,0 C150,90 112,170 132,250 C150,330 104,410 126,500 C146,590 100,650 130,720" fill="none" stroke="${C.stoneD}" stroke-width="1.6" stroke-dasharray="3 9"/>
    <!-- Pasig River from the east into the bay -->
    <path d="M128,300 C220,280 260,240 340,250 C420,262 470,226 540,232 C610,238 660,200 720,206 L720,252 C660,248 620,282 545,276 C470,270 430,306 340,296 C262,288 228,330 132,346 Z" fill="${C.water}"/>
    <path d="M250,276 q8,-5 16,0 M430,262 q8,-5 16,0 M600,240 q8,-5 16,0" fill="none" stroke="#fff" stroke-width="2.2"/>
    <!-- roads -->
    <path d="M150,470 C300,430 420,470 560,420 C620,398 670,360 720,350" fill="none" stroke="${C.stone}" stroke-width="30"/>
    <path d="M150,470 C300,430 420,470 560,420 C620,398 670,360 720,350" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12"/>
    <path d="M470,0 C455,90 500,150 480,236" fill="none" stroke="${C.stone}" stroke-width="26"/>
    <path d="M470,0 C455,90 500,150 480,236" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12"/>
    <path d="M440,720 C450,640 410,560 430,452" fill="none" stroke="${C.stone}" stroke-width="26"/>
    <path d="M440,720 C450,640 410,560 430,452" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12"/>
    <!-- bridge -->
    <path d="M462,226 L500,224 L502,282 L464,284 Z" fill="${C.wood}"/><path d="M466,240 L498,238 M466,268 L499,266" stroke="${C.woodD}"/>
    <!-- plaza -->
    <ellipse cx="330" cy="390" rx="104" ry="58" fill="${C.stone}"/>
    <ellipse cx="330" cy="390" rx="84" ry="44" fill="#ebe4d3" stroke="${C.stoneD}" stroke-dasharray="4 6"/>
    ${trees}
  </g></svg>`;
}

// Standing paper-cutout sprites placed on the board centre (board coordinates).
export function centerSprites() {
  const B = (o, x, y, s = 1) => ({ ...building(o), x, y, s });
  const T = (spr, x, y) => ({ ...spr, x, y, s: 1 });
  return [
    // Makati / BGC skyline on the east bank
    B({ w: 30, d: 30, h: 120, wall: '#e8f0f2', wallSh: '#c7d7dc', roof: '#4a6db0', type: 'helipad', win: 'tower' }, 700, 470),
    B({ w: 26, d: 26, h: 92, wall: '#f5e4c8', roof: '#5fb46a', type: 'antenna', win: 'tower', accent: '#e2584f' }, 760, 520),
    B({ w: 34, d: 28, h: 74, wall: '#e6eef0', wallSh: '#c9d8dd', roof: '#f2c443', type: 'flat', win: 'tower' }, 645, 540),
    B({ w: 24, d: 24, h: 140, wall: '#eaf2f4', wallSh: '#c3d5db', roof: '#e2584f', type: 'antenna', win: 'tower', accent: '#f2c443' }, 750, 410),
    // Ortigas north of the river
    B({ w: 28, d: 28, h: 100, wall: '#f1e7da', roof: '#e2584f', type: 'flat', win: 'tower' }, 760, 260),
    B({ w: 40, d: 30, h: 44, roof: '#9b7ed8', type: 'flat', win: 'mall', accent: '#f3a24f' }, 690, 300),
    // MOA by the bay
    B({ w: 64, d: 40, h: 30, roof: '#eaf6fb', type: 'flat', win: 'mall', accent: '#4a86d6' }, 380, 760),
    // Old Manila: Quiapo church + Intramuros
    B({ w: 34, d: 30, h: 34, roof: '#c4684b', type: 'dome', win: 'stone', wall: '#efe0c4' }, 360, 270),
    B({ w: 52, d: 22, h: 20, type: 'cren', win: 'stone', wall: '#d8c7a6' }, 330, 360),
    B({ w: 30, d: 28, h: 26, roof: '#ee93b4', rh: 14, win: 'house' }, 560, 210),
    B({ w: 28, d: 24, h: 22, roof: '#f3a24f', rh: 12, win: 'house' }, 600, 180),
    T(palm(), 300, 520), T(palm(), 300, 640), T(palm(), 290, 780),
    T(tree(), 820, 690), T(tree(), 520, 820),
    { svg: logoSVG(), w: 300, h: 125, x: 470, y: 555, s: 1, logo: true },
  ];
}

export function icon(name) {
  const I = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    follow: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    trade: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M6 10v10h12V10"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6M22 9l-5 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    speed: '<path d="M4 6l7 6-7 6V6ZM13 6l7 6-7 6V6Z"/>',
    bot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    log: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    building: '<path d="M4 21V8l6-4v17M10 21V10h10v11M14 14h2M14 17h2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ic">${I[name] || ''}</svg>`;
}
