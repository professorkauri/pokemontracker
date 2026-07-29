import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await (await import('node:fs/promises')).readFile(resolve(root, 'data/pokemon.js'), 'utf8');
const sandbox = { window: {} }; vm.runInNewContext(source, sandbox);
const pokemon = [...new Map(sandbox.window.POKEMON_DATA.boxes.flatMap(b => b.pokemon).map(p => [p.id, p])).values()];
await mkdir(resolve(root, 'images/regular'), { recursive: true });
await mkdir(resolve(root, 'images/shiny'), { recursive: true });

async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function fetchJson(url) { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} ${url}`); return res.json(); }
async function download(url, path) { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} ${url}`); await writeFile(path, Buffer.from(await res.arrayBuffer())); }
function officialArtwork(api, mode) {
  return mode === 'shiny' ? api.sprites.other['official-artwork'].front_shiny : api.sprites.other['official-artwork'].front_default;
}
async function imageUrls(id) {
  try {
    const api = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`);
    return Object.fromEntries(['regular', 'shiny'].map(mode => [mode, officialArtwork(api, mode)]));
  } catch (pokemonError) {
    try {
      const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
      const defaultId = species.varieties?.find(variety => variety.is_default)?.pokemon?.name;
      if (!defaultId || defaultId === id) throw pokemonError;
      const api = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${defaultId}`);
      return Object.fromEntries(['regular', 'shiny'].map(mode => [mode, officialArtwork(api, mode)]));
    } catch {
      const form = await fetchJson(`https://pokeapi.co/api/v2/pokemon-form/${id}`);
      const pokemonNumber = form.pokemon.url.match(/\/(\d+)\/$/)?.[1];
      if (!pokemonNumber || !form.form_name) throw pokemonError;
      const filename = `${pokemonNumber}-${form.form_name}.png`;
      const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home';
      return { regular: `${base}/${filename}`, shiny: `${base}/shiny/${filename}` };
    }
  }
}

let done = 0;
for (const p of pokemon) {
  try {
    const missingModes = [];
    for (const mode of ['regular', 'shiny']) {
      if (!await exists(resolve(root, `images/${mode}/${p.id}.png`))) missingModes.push(mode);
    }
    if (missingModes.length) {
      const urls = await imageUrls(p.imageId || p.id);
      for (const mode of missingModes) {
        const target = resolve(root, `images/${mode}/${p.id}.png`);
        const url = urls[mode];
        if (url) await download(url, target);
      }
    }
    process.stdout.write(`\r${++done}/${pokemon.length} ${p.name.padEnd(28)}`);
  } catch (error) { console.error(`\nSkipped ${p.id}: ${error.message}`); }
}
console.log('\nImages are ready. Re-run any time; existing files are skipped.');
