// Board, cards and tokens for Polymono Manila.
// Money is in pesos. Rent arrays: [lot, 1 condo, 2, 3, 4, tower].

export const GROUPS = {
  brown:    { name: 'Tondo Market',   color: '#b0714f', house: 500 },
  sky:      { name: 'Old Manila',     color: '#7fcbe0', house: 500 },
  pink:     { name: 'Quezon City',    color: '#ee93b4', house: 1000 },
  orange:   { name: 'East Side',      color: '#f3a24f', house: 1000 },
  red:      { name: 'Ortigas',        color: '#e2584f', house: 1500 },
  yellow:   { name: 'Bay Area',       color: '#f2c443', house: 1500 },
  green:    { name: 'Makati',         color: '#5fb46a', house: 2000 },
  navy:     { name: 'The Fort',       color: '#4a6db0', house: 2000 },
};

const P = (name, group, price, rent, blurb, look) => ({ type: 'prop', name, group, price, rent, blurb, look });

export const BOARD = [
  { type: 'start', name: 'Simula', blurb: 'Collect ₱2,000 sweldo every time you pass.' },
  P('Divisoria', 'brown', 600, [20, 100, 300, 900, 1600, 2500], 'Tawad is a contact sport here.', 'stall'),
  { type: 'bayanihan', name: 'Bayanihan' },
  P('Quiapo', 'brown', 600, [40, 200, 600, 1800, 3200, 4500], 'Church bells, herbal stalls and the best turon.', 'church'),
  { type: 'tax', name: 'Income Tax', amount: 2000, blurb: 'Pay ₱2,000 to the BIR.' },
  { type: 'station', name: 'LRT-1', price: 2000, blurb: 'Baclaran to Fernando Poe Jr. on the green line.', look: 'train' },
  P('Intramuros', 'sky', 1000, [60, 300, 900, 2700, 4000, 5500], 'Walled city, calesas and Fort Santiago.', 'fort'),
  { type: 'swerte', name: 'Swerte' },
  P('Binondo', 'sky', 1000, [60, 300, 900, 2700, 4000, 5500], 'The oldest Chinatown. Bring an empty stomach.', 'arch'),
  P('Luneta Park', 'sky', 1200, [80, 400, 1000, 3000, 4500, 6000], 'Picnics, dancing fountains and the Rizal Monument.', 'park'),
  { type: 'jail', name: 'EDSA Traffic', blurb: 'Just passing? Wave to the jeepneys stuck inside.' },
  P('Cubao Expo', 'pink', 1400, [100, 500, 1500, 4500, 6250, 7500], 'Vintage shops and vinyl in Araneta City.', 'shop'),
  { type: 'utility', name: 'Kuryente Co.', price: 1500, blurb: 'Keeps the aircon of Metro Manila running.', look: 'bolt' },
  P('Maginhawa', 'pink', 1400, [100, 500, 1500, 4500, 6250, 7500], 'The food street of Teachers Village.', 'cafe'),
  P('Tomas Morato', 'pink', 1600, [120, 600, 1800, 5000, 7000, 9000], 'Restos, bars and showbiz sightings.', 'shop'),
  { type: 'station', name: 'MRT-3', price: 2000, blurb: 'North Avenue to Taft, straight down EDSA.', look: 'train' },
  P('Greenhills', 'orange', 1800, [140, 700, 2000, 5500, 7500, 9500], 'Tiangge heaven and pearls by the kilo.', 'mall'),
  { type: 'bayanihan', name: 'Bayanihan' },
  P('Eastwood City', 'orange', 1800, [140, 700, 2000, 5500, 7500, 9500], 'The city that never sleeps, for BPO night owls.', 'tower'),
  P('Kapitolyo', 'orange', 2000, [160, 800, 2200, 6000, 8000, 10000], 'Pasig foodie village with lines out the door.', 'cafe'),
  { type: 'parking', name: 'Merienda', blurb: 'Free stop. Coffee and pandesal on the house.' },
  P('Ortigas Center', 'red', 2200, [180, 900, 2500, 7000, 8750, 10500], 'Glass towers and the business of Pasig.', 'tower'),
  { type: 'swerte', name: 'Swerte' },
  P('Capitol Commons', 'red', 2200, [180, 900, 2500, 7000, 8750, 10500], 'Leafy blocks, coffee and Sunday markets.', 'park'),
  P('Shangri-La Plaza', 'red', 2400, [200, 1000, 3000, 7500, 9250, 11000], 'The grand mall at EDSA and Shaw.', 'mall'),
  { type: 'station', name: 'LRT-2', price: 2000, blurb: 'Recto to Antipolo on the purple line.', look: 'train' },
  P('Parqal', 'yellow', 2600, [220, 1100, 3300, 8000, 9750, 11500], 'A park-lined promenade in Aseana City.', 'park'),
  P('Landers', 'yellow', 2600, [220, 1100, 3300, 8000, 9750, 11500], 'Membership superstore, giant pizza included.', 'store'),
  { type: 'utility', name: 'Tubig Co.', price: 1500, blurb: 'Water for twelve million thirsty Manileños.', look: 'drop' },
  P('Great Mall of Asia', 'yellow', 2800, [240, 1200, 3600, 8500, 10250, 12000], 'MOA: the globe, the bay and the sunset.', 'mall'),
  { type: 'gotojail', name: 'Huli sa Traffic', blurb: 'Go straight to EDSA Traffic. Do not pass Simula.' },
  P('Greenbelt', 'green', 3000, [260, 1300, 3900, 9000, 11000, 12750], 'Garden malls in the heart of Makati.', 'mall'),
  P('Rockwell', 'green', 3000, [260, 1300, 3900, 9000, 11000, 12750], 'Power Plant Mall and riverside condos.', 'tower'),
  { type: 'bayanihan', name: 'Bayanihan' },
  P('Ayala Triangle', 'green', 3200, [280, 1500, 4500, 10000, 12000, 14000], 'Christmas lights show and the CBD skyline.', 'park'),
  { type: 'station', name: 'Pasig Ferry', price: 2000, blurb: 'Skip EDSA. Take the river.', look: 'boat' },
  { type: 'swerte', name: 'Swerte' },
  P('Bonifacio High St.', 'navy', 3500, [350, 1750, 5000, 11000, 13000, 15000], 'BGC promenade of murals and shops.', 'tower'),
  { type: 'tax', name: 'Skyway Toll', amount: 1000, blurb: 'Pay ₱1,000. The fast lane is never free.' },
  P('Forbes Park', 'navy', 4000, [500, 2000, 6000, 14000, 17000, 20000], 'The most exclusive address in the country.', 'villa'),
];

export const SALARY = 2000;
export const JAIL_POS = 10;
export const JAIL_FINE = 500;
export const STATION_RENT = [250, 500, 1000, 2000];

export const GROUP_TILES = {};
BOARD.forEach((t, i) => { if (t.group) (GROUP_TILES[t.group] ||= []).push(i); });
export const STATIONS = BOARD.map((t, i) => (t.type === 'station' ? i : -1)).filter((i) => i >= 0);
export const UTILITIES = BOARD.map((t, i) => (t.type === 'utility' ? i : -1)).filter((i) => i >= 0);
export const isOwnable = (i) => ['prop', 'station', 'utility'].includes(BOARD[i].type);

// Card effects: money (+/-), move (to index), back, jail, pass, repairs, each (pay each), collect (from each), nearest
export const SWERTE = [
  { text: 'Hop on a Grab to the Great Mall of Asia.', fx: 'move', to: 29 },
  { text: 'Back to Simula! Collect ₱2,000 sweldo.', fx: 'move', to: 0 },
  { text: 'Window-shopping date at Shangri-La Plaza.', fx: 'move', to: 24 },
  { text: 'Ride to the nearest train or ferry. If it’s owned, pay double fare.', fx: 'nearest', kind: 'station' },
  { text: 'Typhoon signal no. 2! Walk back 3 spaces.', fx: 'back', n: 3 },
  { text: 'Brownout! Go to the nearest utility. If it’s owned, pay 10× the dice.', fx: 'nearest', kind: 'utility' },
  { text: 'Your sari-sari store had a record month. Collect ₱500.', fx: 'money', amount: 500 },
  { text: 'Angkas Pass: skip EDSA Traffic for free. Keep this card.', fx: 'pass' },
  { text: 'Caught counterflowing on EDSA. Go straight to Traffic.', fx: 'jail' },
  { text: 'Barangay clean-up drive. Pay ₱250 per condo and ₱1,000 per tower.', fx: 'repairs', house: 250, tower: 1000 },
  { text: 'Overspeeding on Roxas Boulevard. Pay ₱150.', fx: 'money', amount: -150 },
  { text: 'Joyride on the LRT-1.', fx: 'move', to: 5 },
  { text: 'Sunset drive to Forbes Park.', fx: 'move', to: 39 },
  { text: 'You were elected barangay captain. Treat everyone: pay each player ₱500.', fx: 'each', amount: 500 },
  { text: 'Your halo-halo stall went viral. Collect ₱1,500.', fx: 'money', amount: 1500 },
  { text: 'Found ₱1,000 in last year’s jacket. Swerte!', fx: 'money', amount: 1000 },
];

export const BAYANIHAN = [
  { text: 'Tricycle ride to Simula. Collect ₱2,000.', fx: 'move', to: 0 },
  { text: '13th month pay! Collect ₱2,000.', fx: 'money', amount: 2000 },
  { text: 'Hospital bill. Pay ₱1,000.', fx: 'money', amount: -1000 },
  { text: 'Balikbayan box garage sale. Collect ₱500.', fx: 'money', amount: 500 },
  { text: 'Angkas Pass: skip EDSA Traffic for free. Keep this card.', fx: 'pass' },
  { text: 'Snapped by a no-contact traffic camera. Go to Traffic.', fx: 'jail' },
  { text: 'Pamasko! Collect ₱200 from every player.', fx: 'collect', amount: 200 },
  { text: 'BIR tax refund. Collect ₱200.', fx: 'money', amount: 200 },
  { text: 'Ninong duties at a binyag. Pay ₱500.', fx: 'money', amount: -500 },
  { text: 'Your paluwagan paid out. Collect ₱1,000.', fx: 'money', amount: 1000 },
  { text: 'Tuition is due. Pay ₱1,500.', fx: 'money', amount: -1500 },
  { text: 'Won the raffle at the office Christmas party. Collect ₱1,000.', fx: 'money', amount: 1000 },
  { text: 'Baha season. Pay ₱400 per condo and ₱1,150 per tower.', fx: 'repairs', house: 400, tower: 1150 },
  { text: 'Sold your old phone on Marketplace. Collect ₱250.', fx: 'money', amount: 250 },
  { text: 'Second place at the barangay videoke contest. Collect ₱100.', fx: 'money', amount: 100 },
  { text: 'Lola slipped you some baon. Collect ₱1,000.', fx: 'money', amount: 1000 },
];

export const TOKENS = [
  { id: 'jeepney',  name: 'Jeepney',   color: '#e2584f' },
  { id: 'puspin',   name: 'Puspin',    color: '#f3a24f' },
  { id: 'halohalo', name: 'Halo-halo', color: '#9b7ed8' },
  { id: 'mangga',   name: 'Mangga',    color: '#e8b52f' },
  { id: 'pandesal', name: 'Pandesal',  color: '#33a99b' },
  { id: 'trike',    name: 'Tricycle',  color: '#4a86d6' },
];

export const BOT_NAMES = ['Tita Baby', 'Kuya Jun', 'Lola Nena', 'Ate Joy', 'Tito Boy', 'Bunso'];

export const peso = (n) => (n < 0 ? '−' : '') + '₱' + Math.abs(Math.round(n)).toLocaleString('en-US');
