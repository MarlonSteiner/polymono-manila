// CPU players: simple, readable heuristics that still play a decent game.
import { BOARD, GROUPS, GROUP_TILES, STATIONS } from './data.js';

const GROUP_RANK = { orange: 8, red: 7, yellow: 6, pink: 5, sky: 4, green: 3, navy: 3, brown: 2 };
const reserve = (g) => (g.s.round < 4 ? 400 : g.s.round < 12 ? 900 : 1300);
const ownersAfter = (g, i, pid) => GROUP_TILES[BOARD[i].group].map((j) => (j === i ? pid : g.s.own[j].owner));

function completes(g, pid, i) {
  const t = BOARD[i];
  if (t.type === 'prop') return ownersAfter(g, i, pid).every((o) => o === pid);
  return false;
}
function blocks(g, pid, i) {
  const t = BOARD[i];
  if (t.type !== 'prop') return false;
  const others = GROUP_TILES[t.group].filter((j) => j !== i).map((j) => g.s.own[j].owner);
  return others[0] !== null && others[0] !== pid && others.every((o) => o === others[0]);
}

export function shouldBuy(g, p, i) {
  const price = BOARD[i].price;
  if (p.cash < price) return false;
  if (completes(g, p.id, i) || blocks(g, p.id, i)) return p.cash - price >= 100;
  if (BOARD[i].type === 'station') return p.cash - price >= reserve(g) * 0.6;
  return p.cash - price >= reserve(g);
}

export function auctionMax(g, p, i) {
  const t = BOARD[i];
  let f = 0.75 + Math.random() * 0.25;
  if (completes(g, p.id, i)) f = 1.7;
  else if (blocks(g, p.id, i)) f = 1.3;
  else if (t.type === 'station') f = 1.05;
  return Math.max(0, Math.min(Math.round((t.price * f) / 10) * 10, p.cash - 250));
}

export function jailChoice(g, p) {
  const unowned = g.s.own.filter((o) => o && o.owner === null).length;
  const early = unowned > 6 || g.s.round < 10;
  if (early && p.passes.length) return 'card';
  if (early && p.cash > 2500) return 'pay';
  return 'roll';
}

export function manage(g, p) {
  const keep = reserve(g);
  // lift mortgages on complete sets first
  for (const i of g.ownedBy(p.id)) {
    const t = BOARD[i];
    if (g.s.own[i].mortgaged && t.group && g.hasGroup(p.id, t.group) && p.cash - g.unmortgageCost(i) > keep + 1500) g.unmortgage(p.id, i);
  }
  const groups = Object.keys(GROUPS).filter((k) => g.hasGroup(p.id, k)).sort((a, b) => GROUP_RANK[b] - GROUP_RANK[a]);
  let built = true;
  while (built) {
    built = false;
    for (const k of groups) {
      const cost = GROUPS[k].house;
      if (p.cash - cost < keep) continue;
      const tiles = [...GROUP_TILES[k]].sort((a, b) => g.s.own[a].houses - g.s.own[b].houses || b - a);
      for (const i of tiles) if (g.canBuild(p.id, i)) { g.build(p.id, i); built = true; break; }
      if (built) break;
    }
  }
  if (p.cash > 6000) for (const i of g.ownedBy(p.id)) if (g.s.own[i].mortgaged && p.cash - g.unmortgageCost(i) > 5000) g.unmortgage(p.id, i);
}

export function raise(g, p, amount) {
  let guard = 200;
  while (p.cash < amount && guard--) {
    const mine = g.ownedBy(p.id);
    // 1. mortgage loose lots (not part of a full set)
    const loose = mine.filter((i) => g.canMortgage(p.id, i) && !(BOARD[i].group && g.hasGroup(p.id, BOARD[i].group)))
      .sort((a, b) => BOARD[a].price - BOARD[b].price);
    if (loose.length) { g.mortgage(p.id, loose[0]); continue; }
    // 2. sell buildings from the weakest set
    const sellable = mine.filter((i) => g.canSell(p.id, i)).sort((a, b) => GROUP_RANK[BOARD[a].group] - GROUP_RANK[BOARD[b].group]);
    if (sellable.length) { g.sell(p.id, sellable[0]); continue; }
    // 3. mortgage anything left
    const any = mine.filter((i) => g.canMortgage(p.id, i)).sort((a, b) => BOARD[a].price - BOARD[b].price);
    if (any.length) { g.mortgage(p.id, any[0]); continue; }
    break;
  }
}

// How strong a player's portfolio is if the ownership map `owner(i)` were true.
function strength(g, pid, owner) {
  let v = 0;
  const mine = g.s.own.map((o, i) => (o && owner(i) === pid ? i : -1)).filter((i) => i >= 0);
  const stations = mine.filter((i) => BOARD[i].type === 'station').length;
  for (const i of mine) {
    const t = BOARD[i];
    let x = t.price;
    if (t.group) {
      const full = GROUP_TILES[t.group].every((j) => owner(j) === pid);
      const have = GROUP_TILES[t.group].filter((j) => owner(j) === pid).length;
      x *= full ? 2.6 : have >= 2 ? 1.25 : 1;
    }
    if (t.type === 'station') x *= 1 + 0.2 * (stations - 1);
    if (g.s.own[i].mortgaged) x *= 0.55;
    v += x;
  }
  return v;
}

// Would `botId` accept trade t? (t.from proposes, t.to = bot)
export function evaluateTrade(g, t) {
  const me = t.to, them = t.from;
  const moved = new Map();
  t.give.props.forEach((i) => moved.set(i, me));
  t.get.props.forEach((i) => moved.set(i, them));
  const now = (i) => g.s.own[i].owner;
  const after = (i) => (moved.has(i) ? moved.get(i) : g.s.own[i].owner);
  const myGain = strength(g, me, after) - strength(g, me, now) + t.give.cash - t.get.cash + 300 * (t.give.passes - t.get.passes);
  const theirGain = strength(g, them, after) - strength(g, them, now) + t.get.cash - t.give.cash;
  return myGain - 0.4 * Math.max(0, theirGain) > 120;
}

// A bot looks for the one lot it is missing from a set: first it tries a swap that
// completes a set for both sides, otherwise it offers cash.
export async function maybeTrade(g, p) {
  if (Math.random() > 0.6) return;
  g.s.memo ||= {};
  const missingFor = (pid) => Object.keys(GROUPS).map((k) => {
    const tiles = GROUP_TILES[k];
    const mine = tiles.filter((i) => g.s.own[i].owner === pid);
    if (mine.length !== tiles.length - 1 || g.groupHouses(k) > 0) return null;
    const i = tiles.find((j) => g.s.own[j].owner !== pid);
    return g.s.own[i].owner === null ? null : { k, i, holder: g.s.own[i].owner };
  }).filter(Boolean);
  for (const want of missingFor(p.id)) {
    const key = `${p.id}-${want.i}`;
    if (g.s.memo[key] && g.s.round - g.s.memo[key] < 3) continue;
    g.s.memo[key] = g.s.round;
    const q = g.s.players[want.holder];
    const swap = missingFor(q.id).find((w) => w.holder === p.id);
    let t;
    if (swap) {
      const diff = Math.round((BOARD[want.i].price - BOARD[swap.i].price) / 100) * 100;
      t = { from: p.id, to: q.id, give: { props: [swap.i], cash: Math.max(0, diff), passes: 0 }, get: { props: [want.i], cash: Math.max(0, -diff), passes: 0 } };
    } else {
      const price = Math.round((BOARD[want.i].price * (2 + Math.random() * 0.8)) / 100) * 100;
      if (p.cash - price < 600) continue;
      t = { from: p.id, to: q.id, give: { props: [], cash: price, passes: 0 }, get: { props: [want.i], cash: 0, passes: 0 } };
    }
    if (!g.validTrade(t)) continue;
    const yes = q.human ? await g.ui.tradeOffer(t) : evaluateTrade(g, t);
    if (yes && g.validTrade(t)) g.applyTrade(t);
    else if (q.human) g.ui.toast(`${q.name} said no to ${p.name}.`, 'calm');
    return;
  }
}

export { STATIONS };
