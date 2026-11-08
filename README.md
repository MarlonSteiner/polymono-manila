# Polymono Manila

A cozy property-trading board game set in Metro Manila, for iPhone and iPad (and any browser).
Plain HTML/CSS/JS, no build step. All art is hand-built SVG in `js/art.js`.

- 2–6 players on one device, any mix of humans and CPUs
- Buy, auction, trade, build condos and towers, mortgage (sangla), Swerte and Bayanihan cards, EDSA Traffic
- Classic, 30-round or 15-round games; optional Merienda pot
- Saves at the start of every turn; installable to the home screen and playable offline

## Run locally

```
python3 -m http.server 5181
```

Then open http://localhost:5181.

## Files

- `js/data.js` board, cards, tokens
- `js/engine.js` rules and turn flow
- `js/ai.js` CPU players
- `js/board.js` 3D board and camera
- `js/ui.js` HUD, dock, sheets, auctions, trades
- `js/art.js` all artwork
- `js/main.js` home, setup, game start
