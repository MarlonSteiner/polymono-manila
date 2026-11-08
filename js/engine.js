// Rules and turn flow. The engine owns the state; the UI is passed in as `ui`
// and is awaited for animation and for every human decision.
import { BOARD, GROUPS, GROUP_TILES, STATIONS, UTILITIES, SALARY, JAIL_POS, JAIL_FINE, STATION_RENT,
  SWERTE, BAYANIHAN, isOwnable, peso } from './data.js';
import * as AI from './ai.js';

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SAVE_KEY = 'polymono-manila-save-v1';

export function newState(setup) {
  return {
    v: 1,
    settings: setup.settings,
    players: setup.players.map((p, i) => ({
      id: i, name: p.name, token: p.token, color: p.color, human: p.human,
      cash: setup.settings.startCash, pos: 0, jail: 0, passes: [], bankrupt: false,
    })),
    own: BOARD.map((t, i) => (isOwnable(i) ? { owner: null, houses: 0, mortgaged: false } : null)),
    decks: { swerte: shuffle([...SWERTE.keys()]), bayanihan: shuffle([...BAYANIHAN.keys()]) },
    pot: 0, turn: 0, round: 1, log: [], winner: null, dice: [3, 4],
  };
}

export const loadSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } };
export const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} };

export class Game {
  constructor(state, ui) { this.s = state; this.ui = ui; this.stopped = false; }

  get players() { return this.s.players; }
  get alive() { return this.s.players.filter((p) => !p.bankrupt); }
  get cur() { return this.s.players[this.s.turn]; }
  own(i) { return this.s.own[i]; }
  save() { try { if (!this.s.winner) localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch {} }
  log(msg, pid = null) { this.s.log.unshift({ msg, pid, r: this.s.round }); this.s.log.length = Math.min(this.s.log.length, 80); this.ui.onLog?.(); }

  // ---------- queries ----------
  ownedBy(pid) { return this.s.own.map((o, i) => (o && o.owner === pid ? i : -1)).filter((i) => i >= 0); }
  hasGroup(pid, g) { return GROUP_TILES[g].every((i) => this.s.own[i].owner === pid); }
  groupHouses(g) { return GROUP_TILES[g].reduce((n, i) => n + this.s.own[i].houses, 0); }
  houseCount(pid) {
    let houses = 0, towers = 0;
    for (const i of this.ownedBy(pid)) { const h = this.s.own[i].houses; if (h === 5) towers++; else houses += h; }
    return { houses, towers };
  }
  rent(i, diceTotal, mod = null) {
    const t = BOARD[i], o = this.s.own[i];
    if (!o || o.owner === null || o.mortgaged) return 0;
    if (t.type === 'prop') {
      if (o.houses) return t.rent[o.houses];
      return this.hasGroup(o.owner, t.group) ? t.rent[0] * 2 : t.rent[0];
    }
    if (t.type === 'station') {
      const n = STATIONS.filter((j) => this.s.own[j].owner === o.owner).length;
      return STATION_RENT[n - 1] * (mod === 'double' ? 2 : 1);
    }
    const n = UTILITIES.filter((j) => this.s.own[j].owner === o.owner).length;
    return diceTotal * (mod === 'ten' || n === 2 ? 100 : 40);
  }
  mortgageValue(i) { return BOARD[i].price / 2; }
  unmortgageCost(i) { return Math.ceil((BOARD[i].price / 2) * 1.1 / 10) * 10; }
  netWorth(pid) {
    const p = this.s.players[pid];
    let v = p.cash;
    for (const i of this.ownedBy(pid)) {
      const o = this.s.own[i], t = BOARD[i];
      v += o.mortgaged ? t.price / 2 : t.price;
      if (t.group) v += o.houses * GROUPS[t.group].house;
    }
    return v;
  }
  // cash a player could raise by selling all buildings and mortgaging everything
  liquidity(pid) {
    let v = this.s.players[pid].cash;
    for (const i of this.ownedBy(pid)) {
      const o = this.s.own[i], t = BOARD[i];
      if (t.group) v += (o.houses * GROUPS[t.group].house) / 2;
      if (!o.mortgaged) v += t.price / 2;
    }
    return v;
  }

  // ---------- building & mortgages ----------
  canBuild(pid, i) {
    const t = BOARD[i], o = this.s.own[i];
    if (t.type !== 'prop' || o.owner !== pid || o.houses >= 5) return false;
    if (!this.hasGroup(pid, t.group)) return false;
    const tiles = GROUP_TILES[t.group];
    if (tiles.some((j) => this.s.own[j].mortgaged)) return false;
    if (o.houses > Math.min(...tiles.map((j) => this.s.own[j].houses))) return false;
    return this.s.players[pid].cash >= GROUPS[t.group].house;
  }
  canSell(pid, i) {
    const t = BOARD[i], o = this.s.own[i];
    if (t.type !== 'prop' || o.owner !== pid || o.houses === 0) return false;
    return o.houses >= Math.max(...GROUP_TILES[t.group].map((j) => this.s.own[j].houses));
  }
  canMortgage(pid, i) {
    const t = BOARD[i], o = this.s.own[i];
    if (!o || o.owner !== pid || o.mortgaged) return false;
    return !(t.group && this.groupHouses(t.group) > 0);
  }
  canUnmortgage(pid, i) {
    const o = this.s.own[i];
    return o && o.owner === pid && o.mortgaged && this.s.players[pid].cash >= this.unmortgageCost(i);
  }
  build(pid, i) {
    if (!this.canBuild(pid, i)) return false;
    const o = this.s.own[i], cost = GROUPS[BOARD[i].group].house;
    this.s.players[pid].cash -= cost; o.houses++;
    this.log(`${this.s.players[pid].name} built ${o.houses === 5 ? 'a tower' : 'a condo'} on ${BOARD[i].name}.`, pid);
    this.ui.onBuild?.(i, pid, -cost);
    return true;
  }
  sell(pid, i) {
    if (!this.canSell(pid, i)) return false;
    const o = this.s.own[i], back = GROUPS[BOARD[i].group].house / 2;
    o.houses--; this.s.players[pid].cash += back;
    this.log(`${this.s.players[pid].name} sold a building on ${BOARD[i].name}.`, pid);
    this.ui.onBuild?.(i, pid, back);
    return true;
  }
  mortgage(pid, i) {
    if (!this.canMortgage(pid, i)) return false;
    this.s.own[i].mortgaged = true; this.s.players[pid].cash += this.mortgageValue(i);
    this.log(`${this.s.players[pid].name} mortgaged ${BOARD[i].name}.`, pid);
    this.ui.onBuild?.(i, pid, this.mortgageValue(i));
    return true;
  }
  unmortgage(pid, i) {
    if (!this.canUnmortgage(pid, i)) return false;
    const c = this.unmortgageCost(i);
    this.s.own[i].mortgaged = false; this.s.players[pid].cash -= c;
    this.log(`${this.s.players[pid].name} lifted the mortgage on ${BOARD[i].name}.`, pid);
    this.ui.onBuild?.(i, pid, -c);
    return true;
  }

  // ---------- trading ----------
  tradeable(pid) {
    return this.ownedBy(pid).filter((i) => !(BOARD[i].group && this.groupHouses(BOARD[i].group) > 0));
  }
  validTrade(t) {
    const A = this.s.players[t.from], B = this.s.players[t.to];
    if (A.bankrupt || B.bankrupt) return false;
    if (t.give.cash > A.cash || t.get.cash > B.cash) return false;
    if (t.give.passes > A.passes.length || t.get.passes > B.passes.length) return false;
    const ta = this.tradeable(t.from), tb = this.tradeable(t.to);
    if (!t.give.props.every((i) => ta.includes(i)) || !t.get.props.every((i) => tb.includes(i))) return false;
    return t.give.props.length + t.get.props.length + t.give.cash + t.get.cash + t.give.passes + t.get.passes > 0;
  }
  applyTrade(t) {
    const A = this.s.players[t.from], B = this.s.players[t.to];
    A.cash += t.get.cash - t.give.cash; B.cash += t.give.cash - t.get.cash;
    B.passes.push(...A.passes.splice(0, t.give.passes)); A.passes.push(...B.passes.splice(0, t.get.passes));
    t.give.props.forEach((i) => { this.s.own[i].owner = B.id; });
    t.get.props.forEach((i) => { this.s.own[i].owner = A.id; });
    this.log(`${A.name} and ${B.name} made a trade.`, A.id);
    this.ui.onTrade?.(t);
  }

  // ---------- money ----------
  give(p, amount, why) {
    p.cash += amount;
    this.ui.onMoney?.(p.id, amount, why);
  }
  // Returns false when the payer went bankrupt.
  async pay(p, amount, toId = null, why = '') {
    if (amount <= 0) return true;
    if (p.cash < amount) {
      const ok = await this.raise(p, amount, toId);
      if (!ok) { await this.bankrupt(p, toId); return false; }
    }
    p.cash -= amount;
    this.ui.onMoney?.(p.id, -amount, why);
    if (toId !== null) { const q = this.s.players[toId]; q.cash += amount; this.ui.onMoney?.(toId, amount, why); }
    else if (this.s.settings.pot && why === 'tax') this.s.pot += amount;
    return true;
  }
  async raise(p, amount, toId) {
    if (this.liquidity(p.id) < amount) {
      if (p.human) await this.ui.cannotPay?.(p, amount, toId);
      return false;
    }
    if (!p.human) { AI.raise(this, p, amount); return p.cash >= amount; }
    return this.ui.raiseFunds(p, amount, toId);
  }
  async bankrupt(p, toId) {
    const to = toId !== null ? this.s.players[toId] : null;
    // buildings go back to the bank at half price first
    for (const i of this.ownedBy(p.id)) {
      const o = this.s.own[i];
      if (o.houses) { p.cash += (o.houses * GROUPS[BOARD[i].group].house) / 2; o.houses = 0; }
    }
    for (const i of this.ownedBy(p.id)) {
      if (to) this.s.own[i].owner = to.id;
      else Object.assign(this.s.own[i], { owner: null, mortgaged: false, houses: 0 });
    }
    if (to) { to.cash += Math.max(0, p.cash); to.passes.push(...p.passes); this.ui.onMoney?.(to.id, Math.max(0, p.cash), 'bankrupt'); }
    else while (p.passes.length) this.returnPass(p.passes.pop());
    p.cash = 0; p.passes = []; p.bankrupt = true; p.jail = 0;
    this.log(`${p.name} is bankrupt${to ? ` and hands everything to ${to.name}` : ''}.`, p.id);
    await this.ui.onBankrupt?.(p, to);
    this.checkWinner();
  }
  checkWinner() {
    const alive = this.alive;
    if (alive.length === 1) this.s.winner = alive[0].id;
    return this.s.winner !== null;
  }

  // ---------- moving ----------
  rollDice() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }
  async moveSteps(p, steps) {
    const from = p.pos;
    const to = (from + steps + 40) % 40;
    await this.ui.animateMove(p, from, steps);
    p.pos = to;
    if (steps > 0 && to < from) { this.give(p, SALARY, 'salary'); this.log(`${p.name} passed Simula and collected ${peso(SALARY)}.`, p.id); }
  }
  async moveTo(p, to, collect = true) {
    const steps = (to - p.pos + 40) % 40;
    if (collect) return this.moveSteps(p, steps);
    await this.ui.animateMove(p, p.pos, steps);
    p.pos = to;
  }
  async sendToJail(p) {
    this.log(`${p.name} got stuck in EDSA Traffic.`, p.id);
    await this.ui.toJail(p);
    p.pos = JAIL_POS; p.jail = 1;
    this.ui.render();
  }

  // ---------- landing ----------
  async land(p, total, mod = null) {
    const i = p.pos, t = BOARD[i], o = this.s.own[i];
    this.ui.render();
    if (o) {
      if (o.owner === null) return this.offer(p, i);
      if (o.owner === p.id) return;
      if (o.mortgaged) { this.ui.toast(`${t.name} is mortgaged. No rent!`, 'calm'); return; }
      const owner = this.s.players[o.owner];
      const rent = this.rent(i, total, mod);
      this.log(`${p.name} paid ${peso(rent)} rent to ${owner.name} for ${t.name}.`, p.id);
      await this.ui.rentNotice(p, owner, i, rent);
      await this.pay(p, rent, owner.id, 'rent');
      return;
    }
    switch (t.type) {
      case 'tax':
        this.log(`${p.name} paid ${t.name} (${peso(t.amount)}).`, p.id);
        await this.ui.notice(p, t.name, `Pay ${peso(t.amount)}.`, i);
        await this.pay(p, t.amount, null, 'tax');
        break;
      case 'swerte': case 'bayanihan': await this.draw(p, t.type); break;
      case 'gotojail': await this.sendToJail(p); break;
      case 'parking':
        if (this.s.settings.pot && this.s.pot > 0) {
          const pot = this.s.pot; this.s.pot = 0;
          this.log(`${p.name} won the Merienda pot of ${peso(pot)}!`, p.id);
          await this.ui.notice(p, 'Merienda pot!', `You collect ${peso(pot)} from the pot.`, i);
          this.give(p, pot, 'pot');
        }
        break;
    }
  }

  async offer(p, i) {
    const t = BOARD[i];
    const buy = p.human ? (p.cash >= t.price ? await this.ui.offerBuy(p, i) : (await this.ui.cantAfford(p, i), false))
      : AI.shouldBuy(this, p, i);
    if (buy && p.cash >= t.price) {
      p.cash -= t.price; this.s.own[i].owner = p.id;
      this.log(`${p.name} bought ${t.name} for ${peso(t.price)}.`, p.id);
      this.ui.onMoney?.(p.id, -t.price, 'buy');
      await this.ui.onBought(p, i);
      return;
    }
    if (this.s.settings.auctions && this.alive.length > 1) await this.auction(i);
  }

  async auction(i) {
    this.log(`${BOARD[i].name} goes up for auction.`);
    const res = await this.ui.auction(i);
    if (res && res.winner !== null) {
      const w = this.s.players[res.winner];
      w.cash -= res.price; this.s.own[i].owner = w.id;
      this.log(`${w.name} won ${BOARD[i].name} at auction for ${peso(res.price)}.`, w.id);
      this.ui.onMoney?.(w.id, -res.price, 'buy');
      this.ui.render();
    } else this.log(`Nobody bid on ${BOARD[i].name}.`);
  }

  drawCard(deck) {
    const pile = this.s.decks[deck];
    let idx = pile.shift();
    const cards = deck === 'swerte' ? SWERTE : BAYANIHAN;
    if (cards[idx].fx === 'pass' && this.s.players.some((q) => q.passes.includes(deck))) { pile.push(idx); idx = pile.shift(); }
    if (cards[idx].fx !== 'pass') pile.push(idx);
    return { idx, card: cards[idx] };
  }

  async draw(p, deck) {
    const { card } = this.drawCard(deck);
    this.log(`${p.name} drew ${deck === 'swerte' ? 'Swerte' : 'Bayanihan'}: “${card.text}”`, p.id);
    await this.ui.showCard(p, deck, card);
    switch (card.fx) {
      case 'money':
        if (card.amount > 0) this.give(p, card.amount, 'card');
        else await this.pay(p, -card.amount, null, 'tax');
        break;
      case 'move': await this.moveTo(p, card.to); await this.land(p, this.s.dice[0] + this.s.dice[1]); break;
      case 'back': await this.moveSteps(p, -card.n); await this.land(p, this.s.dice[0] + this.s.dice[1]); break;
      case 'jail': await this.sendToJail(p); break;
      case 'pass': p.passes.push(deck); break;
      case 'repairs': {
        const { houses, towers } = this.houseCount(p.id);
        await this.pay(p, houses * card.house + towers * card.tower, null, 'tax');
        break;
      }
      case 'each':
        for (const q of this.alive) if (q.id !== p.id && !p.bankrupt) await this.pay(p, card.amount, q.id, 'card');
        break;
      case 'collect':
        for (const q of this.alive) if (q.id !== p.id) await this.pay(q, card.amount, p.id, 'card');
        break;
      case 'nearest': {
        const list = card.kind === 'station' ? STATIONS : UTILITIES;
        const to = list.find((j) => j > p.pos) ?? list[0];
        await this.moveTo(p, to);
        if (card.kind === 'utility') {
          const o = this.s.own[to];
          if (o.owner !== null && o.owner !== p.id && !o.mortgaged) {
            const d = this.rollDice();
            await this.ui.roll(p, d, 'Roll for the fare');
            return this.land(p, d[0] + d[1], 'ten');
          }
        }
        await this.land(p, this.s.dice[0] + this.s.dice[1], 'double');
        break;
      }
    }
  }

  // ---------- turn flow ----------
  returnPass(deck) {
    const cards = deck === 'swerte' ? SWERTE : BAYANIHAN;
    this.s.decks[deck].push(cards.findIndex((c) => c.fx === 'pass'));
  }
  usePass(p) { this.returnPass(p.passes.pop()); }

  async run() {
    this.ui.render();
    while (!this.stopped && this.s.winner === null) {
      this.save();
      await this.turn(this.cur);
      if (this.stopped) return;
      if (this.s.winner !== null) break;
      if (this.s.players.some((p) => p.human) && !this.alive.some((p) => p.human)) {
        this.s.winner = [...this.alive].sort((a, b) => this.netWorth(b.id) - this.netWorth(a.id))[0].id;
        this.s.humansOut = true;
        break;
      }
      this.advanceTurn();
      if (this.s.settings.rounds && this.s.round > this.s.settings.rounds) {
        const best = [...this.alive].sort((a, b) => this.netWorth(b.id) - this.netWorth(a.id))[0];
        this.s.winner = best.id; this.s.timeUp = true;
      }
    }
    if (this.stopped) return;
    clearSave();
    await this.ui.gameOver(this.s.players[this.s.winner]);
  }

  advanceTurn() {
    const n = this.s.players.length;
    let t = this.s.turn;
    do { t = (t + 1) % n; if (t === 0) this.s.round++; } while (this.s.players[t].bankrupt);
    this.s.turn = t;
  }

  async turn(p) {
    this.ui.beginTurn(p);
    let doubles = 0;
    for (;;) {
      if (this.stopped || p.bankrupt) return;
      let dice;
      if (p.jail) {
        const choice = p.human ? await this.ui.preRoll(p, { jail: true }) : AI.jailChoice(this, p);
        if (this.stopped) return;
        if (choice === 'card' && p.passes.length > 0) {
          this.usePass(p); p.jail = 0; this.log(`${p.name} used an Angkas Pass to skip traffic.`, p.id);
          this.ui.toast('Angkas to the rescue! 🛵', 'good'); this.ui.render();
          continue;
        }
        if (choice === 'pay') {
          if (!(await this.pay(p, JAIL_FINE, null, 'tax'))) return;
          p.jail = 0; this.log(`${p.name} paid ${peso(JAIL_FINE)} to get out of traffic.`, p.id); this.ui.render();
          continue;
        }
        dice = this.rollDice(); this.s.dice = dice;
        await this.ui.roll(p, dice);
        if (dice[0] === dice[1]) {
          p.jail = 0; this.log(`${p.name} rolled doubles and escaped the traffic!`, p.id);
          this.ui.toast('Doubles! Traffic clears. 🚦', 'good');
          await this.moveSteps(p, dice[0] + dice[1]);
          await this.land(p, dice[0] + dice[1]);
          break; // no extra roll after escaping
        }
        if (p.jail >= 3) {
          this.ui.toast(`Third try. Pay ${peso(JAIL_FINE)} and move.`, 'warn');
          if (!(await this.pay(p, JAIL_FINE, null, 'tax'))) return;
          p.jail = 0;
          await this.moveSteps(p, dice[0] + dice[1]);
          await this.land(p, dice[0] + dice[1]);
          break;
        }
        p.jail++;
        this.ui.toast('Still stuck. Bumper to bumper.', 'calm');
        break;
      }

      const go = p.human ? await this.ui.preRoll(p, { again: doubles > 0 }) : (AI.manage(this, p), await AI.maybeTrade(this, p), 'roll');
      if (this.stopped || go !== 'roll') return;
      dice = this.rollDice(); this.s.dice = dice;
      await this.ui.roll(p, dice);
      const isDouble = dice[0] === dice[1];
      if (isDouble) {
        doubles++;
        if (doubles === 3) { this.ui.toast('Three doubles? Too fast! 🚨', 'warn'); await this.sendToJail(p); break; }
      }
      await this.moveSteps(p, dice[0] + dice[1]);
      await this.land(p, dice[0] + dice[1]);
      if (p.bankrupt || p.jail || this.s.winner !== null) break;
      if (!isDouble) break;
      this.ui.toast('Doubles! Roll again 🎲', 'good');
    }
    if (this.stopped || p.bankrupt || this.s.winner !== null) return;
    if (p.human) await this.ui.postRoll(p);
    else { AI.manage(this, p); await this.ui.pause(350); }
    this.ui.render();
  }
}
