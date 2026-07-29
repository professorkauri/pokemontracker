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

let done = 0;
for (const p of pokemon) {
  try {
    const api = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
    for (const mode of ['regular', 'shiny']) {
      const target = resolve(root, `images/${mode}/${p.id}.png`);
      if (await exists(target)) continue;
      const url = mode === 'shiny' ? api.sprites.other['official-artwork'].front_shiny : api.sprites.other['official-artwork'].front_default;
      if (url) await download(url, target);
    }
    process.stdout.write(`\r${++done}/${pokemon.length} ${p.name.padEnd(28)}`);
  } catch (error) { console.error(`\nSkipped ${p.id}: ${error.message}`); }
}
console.log('\nImages are ready. Re-run any time; existing files are skipped.');
