import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/build-data.mjs path/to/pokemon-species.json');
const raw = JSON.parse(await readFile(input, 'utf8'));
const API_URL = 'https://pokeapi.co/api/v2/pokemon';
const CONCURRENCY = 12;
async function readExistingEvolutionLines() {
  try {
    const source = await readFile('data/pokemon.js', 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    return sandbox.window.POKEMON_DATA?.evolutionLines || [];
  }
  catch {
    return [];
  }
}
async function readFavouriteGroups() {
  try {
    return JSON.parse(await readFile('data/favourite-groups.json', 'utf8'));
  }
  catch {
    return [];
  }
}
const title = id => id.split('-').map(w => ({mr:'Mr.',mime:'Mime',jr:'Jr.',type:'Type:',nidoran:'Nidoran'}[w] || w[0].toUpperCase()+w.slice(1))).join(' ')
  .replace('Nidoran F','Nidoran ♀').replace('Nidoran M','Nidoran ♂').replace('Farfetchd','Farfetch’d').replace('Sirfetchd','Sirfetch’d');
const starterRoots = new Map([
  ['Kanto', ['bulbasaur', 'charmander', 'squirtle']],
  ['Johto', ['chikorita', 'cyndaquil', 'totodile']],
  ['Hoenn', ['treecko', 'torchic', 'mudkip']],
  ['Sinnoh', ['turtwig', 'chimchar', 'piplup']],
  ['Unova', ['snivy', 'tepig', 'oshawott']],
  ['Kalos', ['chespin', 'fennekin', 'froakie']],
  ['Alola', ['rowlet', 'litten', 'popplio']],
  ['Galar', ['grookey', 'scorbunny', 'sobble']],
  ['Paldea', ['sprigatito', ' fuecoco', 'quaxly'].map(id => id.trim())]
]);
const species = raw.results.map((p, i) => ({ id:p.name, name:title(p.name), dex:i+1 }));
const P = (id, name, imageId=id) => ({id,name,imageId});
const unownForms = 'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => P(`unown-${letter}`, `Unown ${letter.toUpperCase()}`))
  .concat([P('unown-exclamation', 'Unown !'), P('unown-question', 'Unown ?')]);
const vivillonForms = [
  P('vivillon-archipelago', 'Vivillon Archipelago'), P('vivillon-continental', 'Vivillon Continental'),
  P('vivillon-elegant', 'Vivillon Elegant'), P('vivillon-fancy', 'Vivillon Fancy'),
  P('vivillon-garden', 'Vivillon Garden'), P('vivillon-high-plains', 'Vivillon High Plains'),
  P('vivillon-icy-snow', 'Vivillon Icy Snow'), P('vivillon-jungle', 'Vivillon Jungle'),
  P('vivillon-marine', 'Vivillon Marine'), P('vivillon-meadow', 'Vivillon Meadow'),
  P('vivillon-modern', 'Vivillon Modern'), P('vivillon-monsoon', 'Vivillon Monsoon'),
  P('vivillon-ocean', 'Vivillon Ocean'), P('vivillon-poke-ball', 'Vivillon Poké Ball'),
  P('vivillon-polar', 'Vivillon Polar'), P('vivillon-river', 'Vivillon River'),
  P('vivillon-sandstorm', 'Vivillon Sandstorm'), P('vivillon-savanna', 'Vivillon Savanna'),
  P('vivillon-sun', 'Vivillon Sun'), P('vivillon-tundra', 'Vivillon Tundra')
];
const genderForms = new Map([
  ['Sinnoh Forms', [
    P('hippopotas-male', 'Hippopotas Male', 'hippopotas'), P('hippopotas-female', 'Hippopotas Female'),
    P('hippowdon-male', 'Hippowdon Male', 'hippowdon'), P('hippowdon-female', 'Hippowdon Female')
  ]],
  ['Unova Forms', [
    P('unfezant-male', 'Unfezant Male', 'unfezant'), P('unfezant-female', 'Unfezant Female'),
    P('frillish-male', 'Frillish Male'), P('frillish-female', 'Frillish Female'),
    P('jellicent-male', 'Jellicent Male'), P('jellicent-female', 'Jellicent Female')
  ]],
  ['Kalos Forms', [
    P('pyroar-male', 'Pyroar Male'), P('pyroar-female', 'Pyroar Female'),
    P('meowstic-male', 'Meowstic Male'), P('meowstic-female', 'Meowstic Female')
  ]],
  ['Galar Forms', [
    P('indeedee-male', 'Indeedee Male'), P('indeedee-female', 'Indeedee Female')
  ]],
  ['Hisui Forms', [
    P('basculegion-male', 'Basculegion Male'), P('basculegion-female', 'Basculegion Female')
  ]],
  ['Paldea Forms', [
    P('oinkologne-male', 'Oinkologne Male'), P('oinkologne-female', 'Oinkologne Female')
  ]]
]);

const rawForms = [
  ['Unown Forms', unownForms],
  ['Kanto Forms', [P('rattata','Rattata'),P('rattata-alola','Alolan Rattata'),P('raticate','Raticate'),P('raticate-alola','Alolan Raticate'),P('raichu','Raichu'),P('raichu-alola','Alolan Raichu'),P('sandshrew','Sandshrew'),P('sandshrew-alola','Alolan Sandshrew'),P('sandslash','Sandslash'),P('sandslash-alola','Alolan Sandslash'),P('vulpix','Vulpix'),P('vulpix-alola','Alolan Vulpix'),P('ninetales','Ninetales'),P('ninetales-alola','Alolan Ninetales'),P('diglett','Diglett'),P('diglett-alola','Alolan Diglett'),P('dugtrio','Dugtrio'),P('dugtrio-alola','Alolan Dugtrio'),P('meowth','Meowth'),P('meowth-alola','Alolan Meowth'),P('meowth-galar','Galarian Meowth'),P('persian','Persian'),P('persian-alola','Alolan Persian'),P('geodude','Geodude'),P('geodude-alola','Alolan Geodude'),P('graveler','Graveler'),P('graveler-alola','Alolan Graveler'),P('golem','Golem'),P('golem-alola','Alolan Golem')]],
  ['Kanto Forms II', [P('ponyta','Ponyta'),P('ponyta-galar','Galarian Ponyta'),P('rapidash','Rapidash'),P('rapidash-galar','Galarian Rapidash'),P('slowpoke','Slowpoke'),P('slowpoke-galar','Galarian Slowpoke'),P('slowbro','Slowbro'),P('slowbro-galar','Galarian Slowbro'),P('farfetchd','Farfetch’d'),P('farfetchd-galar','Galarian Farfetch’d'),P('grimer','Grimer'),P('grimer-alola','Alolan Grimer'),P('muk','Muk'),P('muk-alola','Alolan Muk'),P('exeggutor','Exeggutor'),P('exeggutor-alola','Alolan Exeggutor'),P('marowak','Marowak'),P('marowak-alola','Alolan Marowak'),P('weezing','Weezing'),P('weezing-galar','Galarian Weezing'),P('mr-mime','Mr. Mime'),P('mr-mime-galar','Galarian Mr. Mime'),P('tauros','Tauros'),P('tauros-paldea-combat-breed','Paldean Tauros: Combat'),P('tauros-paldea-blaze-breed','Paldean Tauros: Blaze'),P('tauros-paldea-aqua-breed','Paldean Tauros: Aqua'),P('articuno','Articuno'),P('articuno-galar','Galarian Articuno'),P('zapdos','Zapdos'),P('zapdos-galar','Galarian Zapdos')]],
  ['Johto & Hoenn Forms', [P('moltres','Moltres'),P('moltres-galar','Galarian Moltres'),P('typhlosion','Typhlosion'),P('typhlosion-hisui','Hisuian Typhlosion'),P('wooper','Wooper'),P('wooper-paldea','Paldean Wooper'),P('slowking','Slowking'),P('slowking-galar','Galarian Slowking'),P('qwilfish','Qwilfish'),P('qwilfish-hisui','Hisuian Qwilfish'),P('sneasel','Sneasel'),P('sneasel-hisui','Hisuian Sneasel'),P('corsola','Corsola'),P('corsola-galar','Galarian Corsola'),P('zigzagoon','Zigzagoon'),P('zigzagoon-galar','Galarian Zigzagoon'),P('linoone','Linoone'),P('linoone-galar','Galarian Linoone'),P('deoxys-normal','Deoxys Normal'),P('deoxys-attack','Deoxys Attack'),P('deoxys-defense','Deoxys Defense'),P('deoxys-speed','Deoxys Speed')]],
  ['Sinnoh Forms', [P('burmy','Burmy Plant'),P('burmy-sandy','Burmy Sandy'),P('burmy-trash','Burmy Trash'),P('wormadam-plant','Wormadam Plant'),P('wormadam-sandy','Wormadam Sandy'),P('wormadam-trash','Wormadam Trash'),P('cherrim','Cherrim Overcast'),P('shellos-west','Shellos West'),P('shellos-east','Shellos East'),P('gastrodon-west','Gastrodon West'),P('gastrodon-east','Gastrodon East'),P('rotom','Rotom'),P('rotom-heat','Heat Rotom'),P('rotom-wash','Wash Rotom'),P('rotom-frost','Frost Rotom'),P('rotom-fan','Fan Rotom'),P('rotom-mow','Mow Rotom'),P('shaymin-land','Shaymin Land'),P('shaymin-sky','Shaymin Sky')]],
  ['Unova Forms', [P('basculin-red-striped','Basculin Red'),P('basculin-blue-striped','Basculin Blue'),P('deerling-spring','Deerling Spring'),P('deerling-summer','Deerling Summer'),P('deerling-autumn','Deerling Autumn'),P('deerling-winter','Deerling Winter'),P('sawsbuck-spring','Sawsbuck Spring'),P('sawsbuck-summer','Sawsbuck Summer'),P('sawsbuck-autumn','Sawsbuck Autumn'),P('sawsbuck-winter','Sawsbuck Winter'),P('tornadus-incarnate','Tornadus Incarnate'),P('tornadus-therian','Tornadus Therian'),P('thundurus-incarnate','Thundurus Incarnate'),P('thundurus-therian','Thundurus Therian'),P('landorus-incarnate','Landorus Incarnate'),P('landorus-therian','Landorus Therian'),P('keldeo-ordinary','Keldeo Ordinary'),P('keldeo-resolute','Keldeo Resolute')]],
  ['Vivillon Forms', vivillonForms],
  ['Kalos Forms', [P('flabebe-red','Flabébé Red'),P('flabebe-orange','Flabébé Orange'),P('flabebe-yellow','Flabébé Yellow'),P('flabebe-white','Flabébé White'),P('flabebe-blue','Flabébé Blue'),P('floette-red','Floette Red'),P('floette-orange','Floette Orange'),P('floette-yellow','Floette Yellow'),P('floette-white','Floette White'),P('floette-blue','Floette Blue'),P('floette-eternal','Floette Eternal Flower'),P('florges-red','Florges Red'),P('florges-orange','Florges Orange'),P('florges-yellow','Florges Yellow'),P('florges-white','Florges White'),P('florges-blue','Florges Blue'),P('furfrou-natural','Furfrou Natural'),P('furfrou-heart','Furfrou Heart'),P('furfrou-star','Furfrou Star'),P('furfrou-diamond','Furfrou Diamond'),P('furfrou-debutante','Furfrou Debutante'),P('furfrou-matron','Furfrou Matron'),P('furfrou-dandy','Furfrou Dandy'),P('furfrou-la-reine','Furfrou La Reine'),P('furfrou-kabuki','Furfrou Kabuki'),P('furfrou-pharaoh','Furfrou Pharaoh')]],
  ['Kalos Forms II', [P('pumpkaboo-small','Pumpkaboo Small'),P('pumpkaboo-average','Pumpkaboo Average'),P('pumpkaboo-large','Pumpkaboo Large'),P('pumpkaboo-super','Pumpkaboo Super'),P('gourgeist-small','Gourgeist Small'),P('gourgeist-average','Gourgeist Average'),P('gourgeist-large','Gourgeist Large'),P('gourgeist-super','Gourgeist Super')]],
  ['Alola Forms', [P('oricorio-baile','Oricorio Baile'),P('oricorio-pom-pom','Oricorio Pom-Pom'),P('oricorio-pau','Oricorio Pa’u'),P('oricorio-sensu','Oricorio Sensu'),P('lycanroc-midday','Lycanroc Midday'),P('lycanroc-midnight','Lycanroc Midnight'),P('lycanroc-dusk','Lycanroc Dusk'),P('wishiwashi-solo','Wishiwashi Solo'),P('wishiwashi-school','Wishiwashi School'),P('minior-red','Minior Red Core'),P('minior-orange','Minior Orange Core'),P('minior-yellow','Minior Yellow Core'),P('minior-green','Minior Green Core'),P('minior-blue','Minior Blue Core'),P('minior-indigo','Minior Indigo Core'),P('minior-violet','Minior Violet Core')]],
  ['Galar Forms', [P('corsola-galar','Galarian Corsola'),P('cursola','Cursola'),P('farfetchd-galar','Galarian Farfetch’d'),P('sirfetchd','Sirfetch’d'),P('meowth-galar','Galarian Meowth'),P('perrserker','Perrserker'),P('mr-mime-galar','Galarian Mr. Mime'),P('mr-rime','Mr. Rime'),P('yamask','Yamask'),P('yamask-galar','Galarian Yamask'),P('stunfisk','Stunfisk'),P('stunfisk-galar','Galarian Stunfisk'),P('darumaka','Darumaka'),P('darumaka-galar','Galarian Darumaka'),P('darmanitan-galar-standard','Galarian Darmanitan'),P('toxtricity-amped','Toxtricity Amped'),P('toxtricity-low-key','Toxtricity Low Key'),P('sinistea','Sinistea Phony'),P('sinistea-antique','Sinistea Antique','sinistea'),P('polteageist','Polteageist Phony'),P('polteageist-antique','Polteageist Antique','polteageist'),P('urshifu-single-strike','Urshifu Single Strike'),P('urshifu-rapid-strike','Urshifu Rapid Strike')]],
  ['Hisui Forms', [P('growlithe-hisui','Hisuian Growlithe'),P('arcanine-hisui','Hisuian Arcanine'),P('voltorb-hisui','Hisuian Voltorb'),P('electrode-hisui','Hisuian Electrode'),P('samurott-hisui','Hisuian Samurott'),P('lilligant-hisui','Hisuian Lilligant'),P('zorua-hisui','Hisuian Zorua'),P('zoroark-hisui','Hisuian Zoroark'),P('braviary-hisui','Hisuian Braviary'),P('sliggoo-hisui','Hisuian Sliggoo'),P('goodra-hisui','Hisuian Goodra'),P('avalugg-hisui','Hisuian Avalugg'),P('decidueye-hisui','Hisuian Decidueye'),P('enamorus-incarnate','Enamorus Incarnate'),P('enamorus-therian','Enamorus Therian')]],
  ['Paldea & Convergent Forms', [P('maushold-family-of-four','Maushold Family of Four'),P('maushold-family-of-three','Maushold Family of Three'),P('squawkabilly-green-plumage','Squawkabilly Green'),P('squawkabilly-blue-plumage','Squawkabilly Blue'),P('squawkabilly-yellow-plumage','Squawkabilly Yellow'),P('squawkabilly-white-plumage','Squawkabilly White'),P('tatsugiri-curly','Tatsugiri Curly'),P('tatsugiri-droopy','Tatsugiri Droopy'),P('tatsugiri-stretchy','Tatsugiri Stretchy'),P('dudunsparce-two-segment','Dudunsparce Two Segment'),P('dudunsparce-three-segment','Dudunsparce Three Segment'),P('gimmighoul','Gimmighoul Chest'),P('gimmighoul-roaming','Gimmighoul Roaming'),P('poltchageist','Poltchageist Counterfeit'),P('poltchageist-artisan','Poltchageist Artisan','poltchageist'),P('sinistcha','Sinistcha Unremarkable'),P('sinistcha-masterpiece','Sinistcha Masterpiece','sinistcha'),P('tentacool','Tentacool'),P('toedscool','Toedscool'),P('tentacruel','Tentacruel'),P('toedscruel','Toedscruel'),P('diglett','Diglett'),P('wiglett','Wiglett'),P('dugtrio','Dugtrio'),P('wugtrio','Wugtrio')]]
];
const nationalIds = new Set(species.map(p => p.id));
const dexById = new Map(species.map(p => [p.id, p.dex]));
function baseSpeciesId(id) {
  let current = id;
  while (current) {
    if (nationalIds.has(current)) return current;
    current = current.includes('-') ? current.replace(/-[^-]+$/, '') : '';
  }
  return id;
}
function sortByDex(pokemon) {
  return pokemon.map((form, index) => ({ form, index }))
    .sort((a, b) => (dexById.get(baseSpeciesId(a.form.imageId || a.form.id)) || 9999) - (dexById.get(baseSpeciesId(b.form.imageId || b.form.id)) || 9999) || a.index - b.index)
    .map(entry => entry.form);
}
const formSetDefaults = new Set([
  'deoxys-normal', 'burmy', 'wormadam-plant', 'shellos-west', 'gastrodon-west', 'rotom', 'shaymin-land',
  'basculin-red-striped', 'deerling-spring', 'sawsbuck-spring', 'tornadus-incarnate', 'thundurus-incarnate',
  'landorus-incarnate', 'keldeo-ordinary', 'flabebe-red', 'floette-red', 'florges-red',
  'furfrou-natural', 'pumpkaboo-average', 'gourgeist-average', 'oricorio-baile', 'lycanroc-midday',
  'wishiwashi-solo', 'toxtricity-amped', 'sinistea', 'polteageist',
  'urshifu-single-strike', 'enamorus-incarnate', 'maushold-family-of-four',
  'squawkabilly-green-plumage', 'tatsugiri-curly', 'dudunsparce-two-segment', 'gimmighoul',
  'poltchageist', 'sinistcha'
]);
const regionalBox = id => id.endsWith('-alola') ? 'Alola Forms'
  : id.endsWith('-galar') || id.includes('-galar-') ? 'Galar Forms'
  : id.endsWith('-hisui') ? 'Hisui Forms'
  : id.endsWith('-paldea') || id.includes('-paldea-') ? 'Paldea Forms'
  : null;
const formsByName = new Map();
for (const [sourceName, pokemon] of rawForms) {
  for (const form of pokemon) {
    if (nationalIds.has(form.id) && !formSetDefaults.has(form.id)) continue;
    const fallbackName = sourceName === 'Johto & Hoenn Forms' ? 'Hoenn Forms'
      : sourceName === 'Paldea & Convergent Forms' ? 'Paldea Forms'
      : sourceName;
    const targetName = regionalBox(form.id) || fallbackName;
    if (!formsByName.has(targetName)) formsByName.set(targetName, []);
    if (!formsByName.get(targetName).some(existing => existing.id === form.id)) formsByName.get(targetName).push(form);
  }
}
const alolaForms = formsByName.get('Alola Forms');
const alolaSplit = alolaForms.findIndex(form => form.id.startsWith('minior-'));
formsByName.set('Alola Forms', alolaForms.slice(0, alolaSplit));
formsByName.set('Alola Forms II', alolaForms.slice(alolaSplit));
for (const [name, pokemon] of genderForms) formsByName.get(name).push(...pokemon);
for (const [name, pokemon] of formsByName) formsByName.set(name, sortByDex(pokemon));
const formOrder = ['Unown Forms', 'Hoenn Forms', 'Sinnoh Forms', 'Unova Forms', 'Kalos Forms', 'Kalos Forms II', 'Vivillon Forms', 'Alola Forms', 'Alola Forms II', 'Galar Forms', 'Hisui Forms', 'Paldea Forms'];
const forms = formOrder.filter(name => formsByName.has(name)).map(name => [name, formsByName.get(name)]);
const boxes = [];
for (let i=0;i<species.length;i+=30) boxes.push({id:`dex-${i+1}-${Math.min(i+30,species.length)}`,title:`${i+1}–${Math.min(i+30,species.length)}`,pokemon:species.slice(i,i+30)});
const formIds = new Map([['Hoenn Forms','forms-3'],['Sinnoh Forms','forms-4'],['Unova Forms','forms-5'],['Kalos Forms','forms-6'],['Alola Forms','forms-7'],['Galar Forms','forms-8'],['Hisui Forms','forms-9'],['Paldea Forms','forms-10'],['Kalos Forms II','forms-11'],['Alola Forms II','forms-12'],['Unown Forms','forms-13'],['Vivillon Forms','forms-14']]);
forms.forEach(([name,pokemon]) => boxes.push({id:formIds.get(name),title:name,pokemon}));
const existingEvolutionLines = await readExistingEvolutionLines();
const favouriteGroups = await readFavouriteGroups();
const starterGroups = [...starterRoots].map(([region, roots]) => ({
  region,
  pokemon: [...new Set(roots.flatMap(root => existingEvolutionLines.find(line => line.includes(root)) || [root]))]
}));
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
      results[current] = await mapper(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}
const allEntries = [...species, ...forms.flatMap(([, pokemon]) => pokemon)];
const defaultTypeAliases = new Map([
  ['giratina', 'giratina-altered'], ['meloetta', 'meloetta-aria'], ['aegislash', 'aegislash-shield'],
  ['zygarde', 'zygarde-50'], ['mimikyu', 'mimikyu-disguised'], ['eiscue', 'eiscue-ice'], ['morpeko', 'morpeko-full-belly']
]);
const typeIds = [...new Set([...allEntries.map(pokemon => pokemon.imageId || pokemon.id), ...defaultTypeAliases.values()])];
const typeEntries = await mapConcurrent(typeIds, async id => {
  try {
    const details = await fetchJson(`${API_URL}/${id}`);
    return [id, details.types.map(entry => entry.type.name)];
  }
  catch {
    return [id, []];
  }
});
const typesById = new Map(typeEntries);
for (const [speciesId, apiId] of defaultTypeAliases) {
  if (typesById.has(apiId)) typesById.set(speciesId, typesById.get(apiId));
}
for (const pokemon of allEntries) {
  const directTypes = typesById.get(pokemon.imageId || pokemon.id) || [];
  const fallback = allEntries.find(candidate => baseSpeciesId(candidate.imageId || candidate.id) === baseSpeciesId(pokemon.imageId || pokemon.id) && typesById.get(candidate.imageId || candidate.id)?.length);
  pokemon.types = directTypes.length ? directTypes : (fallback ? typesById.get(fallback.imageId || fallback.id) : []);
}
const availableIds = new Set(allEntries.map(pokemon => pokemon.id));
const validFavouriteGroups = favouriteGroups
  .map(group => ({
    id: group.id,
    label: group.label,
    ...(group.divider ? { divider: group.divider } : {}),
    ...(group.exclude ? { exclude: true } : {}),
    pokemon: (group.pokemon || []).filter(id => availableIds.has(id))
  }))
  .filter(group => group.id && group.label && group.pokemon.length);
const data = { boxes, starterGroups };
if (validFavouriteGroups.length) data.favouriteGroups = validFavouriteGroups;
if (existingEvolutionLines.length) data.evolutionLines = existingEvolutionLines;
const output = JSON.stringify(data, null, 2).replace(
  /\{\n\s+"id": ([^\n]+),\n\s+"name": ([^\n]+),\n\s+"(dex|imageId)": ([^\n]+)\n\s+\}/g,
  '{ "id": $1, "name": $2, "$3": $4 }'
);
await writeFile('data/pokemon.js', `// Generated Pokemon and box definitions. Edit freely; keep box and form IDs stable once tracking.\nwindow.POKEMON_DATA = ${output};\n`);
console.log(`Wrote ${boxes.length} boxes (${species.length} National Dex species + ${forms.reduce((n,f)=>n+f[1].length,0)} form slots).`);
