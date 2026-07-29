# Pokémon Home Tracker

A dependency-free, mobile-first tracker. Every appearance of a Pokémon has its own state per box and per Regular/Shiny view: **Missing → Caught → Home**.

## Run it

1. Open this folder in VS Code.
2. Run `npm run images` in the terminal to download all artwork into `images/` (requires Node 18+ and internet access). You can stop and restart it safely.
3. Use the VS Code **Live Server** extension on `index.html`, or run `npm run serve`.

Progress is kept indefinitely in that browser's local storage. Clearing site data or changing the served URL/port can create a separate save. The app itself does not need internet after images have been downloaded.

## Customise boxes

Edit `data/pokemon.js`. Box IDs must stay unique. A Pokémon can appear in any number of boxes; its progress remains independent because saves use the box ID, Pokémon form ID, and Regular/Shiny mode together.

Form artwork uses PokéAPI identifiers (for example `rattata-alola`). National Dex entries use the base Pokémon identifier.
