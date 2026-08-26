# Pokémon Home Tracker

A dependency-free, mobile-first tracker. Every appearance of a Pokémon has its own state per box and per Regular/Shiny view: **Missing → Caught → Home**.

## Run it

1. Open this folder in VS Code.
2. Run `npm run images` in the terminal to download all artwork into `images/` (requires Node 18+ and internet access). You can stop and restart it safely.
3. Use the VS Code **Live Server** extension on `index.html`, or run `npm run serve`.

Progress is kept indefinitely in that browser's local storage. Clearing site data or changing the served URL/port can create a separate save. The app itself does not need internet after images have been downloaded.

## Rebuild data

Run `npm run data` after updating `pokemon-species.json`. The importer fetches Pokémon types from PokéAPI and preserves the existing evolution lines while rebuilding `data/pokemon.js`, so it requires internet access.

The Favourites view stores its selections separately from collection progress and supports starter families, custom groups, regions, types, and existing form groups. Edit `data/favourite-groups.json` to change the custom Groups box; set `"exclude": true` on a group to hide its Pokémon from the Region and Type choosers.

## Customise boxes

Edit `data/pokemon.js`. Box IDs must stay unique. A Pokémon can appear in any number of boxes; its progress remains independent because saves use the box ID, Pokémon form ID, and Regular/Shiny mode together.

Form artwork uses PokéAPI identifiers (for example `rattata-alola`). National Dex entries use the base Pokémon identifier.
