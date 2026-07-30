import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const DATA_PATH = 'data/pokemon.js';
const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species';
const CONCURRENCY = 12;

const source = await readFile(DATA_PATH, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);

const data = sandbox.window.POKEMON_DATA;
const nationalPokemon = data.boxes
  .filter(box => box.id.startsWith('dex-'))
  .flatMap(box => box.pokemon);
const dexById = new Map(nationalPokemon.map(pokemon => [pokemon.id, pokemon.dex]));
const speciesIds = [...dexById.keys()];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed ${url}: ${response.status}`);
  return response.json();
}

async function mapConcurrent(items, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function collectEvolutionSpecies(chain, species = []) {
  species.push(chain.species.name);
  for (const next of chain.evolves_to) collectEvolutionSpecies(next, species);
  return species;
}

function withEvolutionLines(sourceText, evolutionLines) {
  const linesOutput = evolutionLines
    .map(line => `    [${line.map(id => JSON.stringify(id)).join(', ')}]`)
    .join(',\n');
  const block = `,\n  "evolutionLines": [\n${linesOutput}\n  ]`;
  const dataEnd = sourceText.lastIndexOf('\n};');
  if (dataEnd === -1) throw new Error(`Could not find the end of ${DATA_PATH}.`);
  const existingStart = sourceText.lastIndexOf(',\n  "evolutionLines": [');
  if (existingStart !== -1) return `${sourceText.slice(0, existingStart)}${block}\n};\n`;
  return `${sourceText.slice(0, dataEnd)}${block}\n};\n`;
}

console.log(`Fetching species details for ${speciesIds.length} Pokemon...`);
const speciesDetails = await mapConcurrent(speciesIds, id => fetchJson(`${SPECIES_URL}/${id}`));

const chainUrls = [...new Set(speciesDetails.map(species => species.evolution_chain.url))];
console.log(`Fetching ${chainUrls.length} evolution chains...`);
const chains = await mapConcurrent(chainUrls, url => fetchJson(url));

const evolutionLines = chains
  .map(chain => collectEvolutionSpecies(chain.chain)
    .filter(id => dexById.has(id))
    .sort((a, b) => dexById.get(a) - dexById.get(b)))
  .filter(line => line.length > 1)
  .sort((a, b) => dexById.get(a[0]) - dexById.get(b[0]));

await writeFile(DATA_PATH, withEvolutionLines(source, evolutionLines));
console.log(`Wrote ${evolutionLines.length} evolution lines to ${DATA_PATH}.`);
