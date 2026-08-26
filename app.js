(() => {
  const DATA = window.POKEMON_DATA;
  const STORAGE_KEY = 'pokemon-home-tracker-v1';
  const FAVOURITES_KEY = 'pokemon-home-tracker-favourites-v1';
  const FAVOURITE_COLOURS = ['White', 'Grey', 'Black', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Magenta', 'Pink'];
  const REGION_STARTS = new Map([[1, 'Kanto'], [152, 'Johto'], [252, 'Hoenn'], [387, 'Sinnoh'], [494, 'Unova'], [650, 'Kalos'], [722, 'Alola'], [810, 'Galar'], [899, 'Hisui'], [906, 'Paldea']]);
  const FORM_BOX_BY_POKEMON = new Map(DATA.boxes.filter(box => box.id.startsWith('forms-')).flatMap(box => box.pokemon.map(pokemon => [pokemon.id, box.id])));
  const boxesEl = document.querySelector('#boxes');
  const emptyEl = document.querySelector('#empty');
  const searchPanel = document.querySelector('#search-panel');
  const searchInput = document.querySelector('#search-input');
  const nationalSpecies = DATA.boxes.filter(box => box.id.startsWith('dex-')).flatMap(box => box.pokemon);
  const allPokemon = DATA.boxes.flatMap(box => box.pokemon);
  const speciesIds = new Set(nationalSpecies.map(pokemon => pokemon.id));
  const evolutionLineBySpecies = new Map((DATA.evolutionLines || []).flatMap(line => line.map(id => [id, line])));
  let view = 'pokedex';
  let openKey = null;
  let activeMode = 'regular';
  let searchQuery = '';
  let state = loadState();
  let favourites = loadFavourites();
  let chooser = null;

  function normalizeSearch(value) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
  function loadFavourites() {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVOURITES_KEY)) || {};
      return {
        regular: saved.regular || {},
        shiny: saved.shiny || {},
        seen: { regular: saved.seen?.regular || {}, shiny: saved.seen?.shiny || {} }
      };
    } catch { return { regular: {}, shiny: {}, seen: { regular: {}, shiny: {} } }; }
  }
  function saveFavourites() { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)); }
  function regionForDex(dex) {
    let region = null;
    for (const [start, name] of REGION_STARTS) {
      if (dex >= start) region = name;
      else break;
    }
    return region;
  }
  function baseSpeciesId(pokemon) {
    const candidates = [pokemon.id, pokemon.imageId].filter(Boolean);
    for (const candidate of candidates) {
      const parts = candidate.split('-');
      while (parts.length) {
        const id = parts.join('-');
        if (speciesIds.has(id)) return id;
        parts.pop();
      }
    }
    return pokemon.id;
  }

  function searchMatcher(query) {
    const directQuery = normalizeSearch(query);
    const evolutionMatches = new Set();
    for (const pokemon of allPokemon) {
      if (normalizeSearch(pokemon.name) !== directQuery) continue;
      const speciesId = baseSpeciesId(pokemon);
      for (const lineSpecies of evolutionLineBySpecies.get(speciesId) || [speciesId]) evolutionMatches.add(lineSpecies);
    }
    return pokemon => pokemon.name.toLowerCase().includes(directQuery) || evolutionMatches.has(baseSpeciesId(pokemon));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      let migrated = false;
      for (const savedKey of Object.keys(saved)) {
        const [boxId, pokemonId, mode] = savedKey.split('|');
        const targetBoxId = FORM_BOX_BY_POKEMON.get(pokemonId);
        if (!boxId.startsWith('forms-') || !targetBoxId || targetBoxId === boxId) continue;
        const newKey = key(targetBoxId, pokemonId, mode);
        if (!(newKey in saved)) saved[newKey] = saved[savedKey];
        delete saved[savedKey];
        migrated = true;
      }
      if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return saved;
    }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateCounts(); }
  function key(boxId, pokemonId, mode) { return `${boxId}|${pokemonId}|${mode}`; }
  function getStatus(boxId, pokemonId, mode) { return state[key(boxId, pokemonId, mode)] || 0; }
  function imagePath(pokemonId, mode) { return `images/${mode}/${pokemonId}.png`; }
  function pokemonById(id) { return nationalSpecies.find(pokemon => pokemon.id === id); }
  function favouriteValue(slot) { return favourites[activeMode][slot]; }
  function isColourFavourite(pokemonId) {
    return FAVOURITE_COLOURS.some(colour => favourites[activeMode][`colour-${colour.toLowerCase()}`] === pokemonId);
  }
  function newCandidates(slot, candidates) {
    const seen = favourites.seen[activeMode][slot] || {};
    return candidates.filter(pokemon => !seen[pokemon.id]);
  }
  function isCollected(pokemon) {
    return DATA.boxes.some(box => box.pokemon.some(entry => entry.id === pokemon.id && getStatus(box.id, entry.id, activeMode) > 0));
  }
  function saveFavourite(slot, pokemon) {
    if (pokemon) favourites[activeMode][slot] = pokemon.id;
    else delete favourites[activeMode][slot];
    saveFavourites();
  }

  function updateCounts() {
    const values = Object.values(state);
    const total = DATA.boxes.reduce((sum, box) => sum + box.pokemon.length, 0);
    const regularHome = DATA.boxes.reduce((sum, box) => sum + box.pokemon.filter(p => getStatus(box.id, p.id, 'regular') === 2).length, 0);
    const shinyHome = DATA.boxes.reduce((sum, box) => sum + box.pokemon.filter(p => getStatus(box.id, p.id, 'shiny') === 2).length, 0);
    const regularProgress = document.querySelector('#regular-progress');
    const shinyProgress = document.querySelector('#shiny-progress');
    regularProgress.max = total; regularProgress.value = regularHome;
    shinyProgress.max = total; shinyProgress.value = shinyHome;
    document.querySelector('#regular-home-count').textContent = `${regularHome} / ${total}`;
    document.querySelector('#shiny-home-count').textContent = `${shinyHome} / ${total}`;
    document.querySelector('#transfer-count').textContent = values.filter(v => v === 1).length;
  }

  function card(box, pokemon, mode, transferMode, favouriteMode = false) {
    const status = getStatus(box.id, pokemon.id, mode);
    const region = REGION_STARTS.get(pokemon.dex);
    const names = ['missing', 'caught', 'home'];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pokemon ${names[status]}`;
    button.classList.toggle('favourite', favouriteMode && favourites[mode][pokemon.id]);
    button.dataset.label = pokemon.name;
    button.title = `${pokemon.name}: ${names[status]}`;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = `${region ? `<div class="region-pill">${region}</div>` : ''}${favouriteMode ? '<span class="favourite-mark" aria-hidden="true">★</span>' : ''}<span class="status">${status === 1 ? '!' : ''}</span><img alt="" loading="lazy"><small>${pokemon.name}</small>`;
    const img = button.querySelector('img');
    img.src = imagePath(pokemon.id, mode);
    img.onerror = () => { img.onerror = null; img.src = imagePath(pokemon.imageId || pokemon.id, mode); };
    if (favouriteMode) button.addEventListener('click', () => {
      if (favourites[mode][pokemon.id]) delete favourites[mode][pokemon.id];
      else favourites[mode][pokemon.id] = pokemon.id;
      saveFavourites(); render();
    });
    else if (!transferMode || status === 1) button.addEventListener('click', () => {
      state[key(box.id, pokemon.id, mode)] = transferMode ? 2 : (status + 1) % 3;
      if (state[key(box.id, pokemon.id, mode)] === 0) delete state[key(box.id, pokemon.id, mode)];
      saveState(); render();
    });
    return button;
  }

  function emptySlot() {
    const slot = document.createElement('div');
    slot.className = 'empty-slot';
    slot.setAttribute('aria-hidden', 'true');
    slot.innerHTML = '<svg viewBox="0 0 32 32" focusable="false"><path class="pokeball-fill" d="M4 16a12 12 0 0 1 24 0Z"></path><circle cx="16" cy="16" r="12"></circle><path d="M4 16h7.75M20.25 16H28"></path><circle class="pokeball-cutout" cx="16" cy="16" r="4.25"></circle></svg>';
    return slot;
  }

  function progressDonut(kind, home, total) {
    const percent = (home / total) * 100;
    const complete = home === total;
    const label = `${kind === 'regular' ? 'Regular' : 'Shiny'} Home progress`;
    const tick = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.4 8.4 14 15 6"></path></svg>';
    return `<span class="progress-donut ${kind} ${complete ? 'complete' : ''}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${home}" style="--progress:${percent}%">${complete ? tick : ''}</span>`;
  }

  function boxTitleSprite(pokemon, mode) {
    if (!pokemon) return '';
    const fallbackId = pokemon.imageId || pokemon.id;
    return `<span class="box-title-sprite" title="${pokemon.name}" aria-hidden="true"><img src="${imagePath(pokemon.id, mode)}" data-fallback-src="${imagePath(fallbackId, mode)}" alt=""></span>`;
  }

  function boxTitle(box, pokemon, mode, transferMode) {
    const first = pokemon[0];
    const title = `${box.title}${transferMode && mode === 'shiny' ? ' Shiny' : ''}`;
    return `${boxTitleSprite(first, mode)}<span class="box-title">${title}</span>`;
  }

  function addSpriteFallbacks(parent) {
    parent.querySelectorAll('img[data-fallback-src]').forEach(img => {
      img.onerror = () => {
        img.onerror = null;
        if (img.src.endsWith(img.dataset.fallbackSrc)) return;
        img.src = img.dataset.fallbackSrc;
      };
    });
  }

  function boxPanel(box, mode, transferMode, options = {}) {
    const pokemon = options.pokemon || box.pokemon;
    const forceOpen = options.forceOpen || false;
    const filtered = pokemon.length !== box.pokemon.length;
    const panelKey = transferMode ? `${box.id}-${mode}` : box.id;
    const isOpen = forceOpen || transferMode || openKey === panelKey;
    const region = pokemon.map(pokemon => REGION_STARTS.get(pokemon.dex)).find(Boolean);
    const section = document.createElement('section');
    section.className = `box ${region ? 'region-start' : ''} ${isOpen ? 'open' : ''} ${transferMode ? 'transfer-box' : ''} ${forceOpen ? 'forced-open' : ''}`;
    const regularHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'regular') === 2).length;
    const shinyHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'shiny') === 2).length;
    const boxMeta = `${progressDonut('regular', regularHome, box.pokemon.length)}${progressDonut('shiny', shinyHome, box.pokemon.length)}`;
    section.innerHTML = `<button class="box-head" type="button" aria-expanded="${isOpen}" ${transferMode ? 'aria-disabled="true"' : ''}>${region ? `<div class="region-pill">${region}</div>` : ''}${boxTitle(box, pokemon, mode, transferMode)}<span class="box-meta">${boxMeta}</span><span class="chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5 8l5 5 5-5" /></svg></span></button>`;
    addSpriteFallbacks(section);
    if (!transferMode && !forceOpen) section.querySelector('.box-head').addEventListener('click', () => { openKey = openKey === panelKey ? null : panelKey; render(); });
    if (isOpen) {
      const body = document.createElement('div'); body.className = 'box-body';
      if (!transferMode) {
        mode = activeMode;
        const tabs = document.createElement('div'); tabs.className = 'mode-tabs';
        tabs.innerHTML = `<button class="${mode === 'regular' ? 'active' : ''}" data-mode="regular">Regular</button><button class="${mode === 'shiny' ? 'active' : ''}" data-mode="shiny">Shiny</button>`;
        tabs.addEventListener('click', e => { if (e.target.dataset.mode) { activeMode = e.target.dataset.mode; render(); } });
        body.append(tabs);
      }
      const grid = document.createElement('div'); grid.className = 'pokemon-grid';
      pokemon.forEach(p => grid.append(card(box, p, mode, transferMode, options.favouriteMode)));
      if (!filtered) for (let i = pokemon.length; i < 30; i++) grid.append(emptySlot());
      body.append(grid); section.append(body);
    }
    return section;
  }

  function appendBoxGroup(title, boxes, transferMode, favouriteMode = false) {
    const panels = [];
    for (const box of boxes) {
      if (!transferMode) panels.push(boxPanel(box, activeMode, false, { favouriteMode, forceOpen: favouriteMode }));
      else for (const mode of ['regular', 'shiny']) {
        if (box.pokemon.some(p => getStatus(box.id, p.id, mode) === 1)) panels.push(boxPanel(box, mode, true));
      }
    }
    if (!panels.length) return;
    const heading = document.createElement('h2');
    heading.className = 'box-section-title';
    heading.textContent = title;
    boxesEl.append(heading, ...panels);
  }

  function favouriteSlot(label, slot, candidates, category, favouriteLabel = label, chooserAction = openChooser) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pokemon home favourite-slot';
    button.setAttribute('aria-label', label);
    button.dataset.slot = slot;
    const selected = pokemonById(favouriteValue(slot));
    if (selected) {
      button.classList.add('filled');
      button.innerHTML = `<img src="${imagePath(selected.id, activeMode)}" alt=""><small class="favourite-name">${selected.name}</small><small class="favourite-category">${category}</small>`;
    } else {
      button.innerHTML = `<span class="favourite-image-placeholder" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path class="pokeball-fill" d="M4 16a12 12 0 0 1 24 0Z"></path><circle cx="16" cy="16" r="12"></circle><path d="M4 16h7.75M20.25 16H28"></path><circle class="pokeball-cutout" cx="16" cy="16" r="4.25"></circle></svg></span><small class="favourite-name">Choose...</small><small class="favourite-category">${category}</small>`;
    }
    const newCount = newCandidates(slot, candidates).length;
    if (newCount) button.innerHTML += `<span class="new-pill">${newCount} New</span>`;
    button.addEventListener('click', () => chooserAction(favouriteLabel, slot, candidates));
    return button;
  }

  function candidateList(kind, value, stage = 0) {
    let candidates;
    if (kind === 'starter') {
      candidates = [...new Set((DATA.starterGroups || []).flatMap(group => group.pokemon.filter((_, index) => index % 3 === stage)))].map(pokemonById).filter(Boolean);
    } else if (kind === 'region') {
      candidates = nationalSpecies.filter(pokemon => regionForDex(pokemon.dex) === value);
    } else if (kind === 'colour') {
      candidates = nationalSpecies;
    } else {
      candidates = nationalSpecies.filter(pokemon => pokemon.types?.[0] === value);
    }
    return candidates.filter(isCollected);
  }

  function openChooser(label, slot, candidates) {
    chooser = { label, slot, candidates, page: 0, newIds: new Set(newCandidates(slot, candidates).map(pokemon => pokemon.id)) };
    renderChooser();
  }

  function openColourChooser() {
    chooser = { colour: true, candidates: candidateList('colour'), page: 0, newIds: {} };
    for (const colour of FAVOURITE_COLOURS) {
      chooser.newIds[colour] = new Set(newCandidates(`colour-${colour.toLowerCase()}`, chooser.candidates).map(pokemon => pokemon.id));
    }
    renderColourChooser();
  }

  function renderColourChooser() {
    document.querySelector('#favourite-chooser')?.remove();
    const modal = document.createElement('div');
    modal.id = 'favourite-chooser';
    modal.className = 'chooser-backdrop';
    modal.innerHTML = '<div class="chooser colour-chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title"><div class="chooser-head"><h2 id="chooser-title">Choose Colour Favourites</h2><button type="button" class="chooser-close" aria-label="Close chooser">×</button></div><p class="chooser-instruction">Drag a Pokémon onto the colour it should replace.</p><div class="colour-favourites"></div><div class="chooser-grid"></div><div class="chooser-actions"><button type="button" class="chooser-prev">Previous</button><span class="chooser-page"></span><button type="button" class="chooser-next">Next</button></div></div>';
    const favouritesGrid = modal.querySelector('.colour-favourites');
    for (const colour of FAVOURITE_COLOURS) {
      const slot = `colour-${colour.toLowerCase()}`;
      const target = document.createElement('div');
      target.className = 'colour-favourite-target';
      target.dataset.slot = slot;
      target.innerHTML = `<strong>${colour}</strong>`;
      const selected = pokemonById(favouriteValue(slot));
      if (selected) target.innerHTML += `<img src="${imagePath(selected.id, activeMode)}" alt=""><small>${selected.name}</small>`;
      else target.innerHTML += '<span>Choose...</span>';
      target.addEventListener('dragover', event => event.preventDefault());
      target.addEventListener('drop', event => {
        event.preventDefault();
        const pokemon = pokemonById(event.dataTransfer.getData('text/plain'));
        if (pokemon) { saveFavourite(slot, pokemon); render(); renderColourChooser(); }
      });
      favouritesGrid.append(target);
    }
    const grid = modal.querySelector('.chooser-grid');
    const start = chooser.page * 30;
    for (const pokemon of chooser.candidates.slice(start, start + 30)) {
      const option = document.createElement('button');
      option.type = 'button';
      option.draggable = true;
      const isNew = [...Object.values(chooser.newIds)].some(ids => ids.has(pokemon.id));
      option.className = `pokemon home chooser-pokemon ${isColourFavourite(pokemon.id) ? 'selected' : ''} ${isNew ? 'new' : ''}`;
      option.dataset.pokemonId = pokemon.id;
      option.innerHTML = `<img src="${imagePath(pokemon.id, activeMode)}" alt=""><small>${pokemon.name}</small>`;
      option.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', pokemon.id));
      grid.append(option);
    }
    const pages = Math.ceil(chooser.candidates.length / 30);
    modal.querySelector('.chooser-page').textContent = `Page ${chooser.page + 1} of ${pages}`;
    modal.querySelector('.chooser-prev').hidden = pages === 1;
    modal.querySelector('.chooser-next').hidden = pages === 1;
    modal.querySelector('.chooser-prev').disabled = chooser.page === 0;
    modal.querySelector('.chooser-next').disabled = chooser.page >= pages - 1;
    modal.querySelector('.chooser-prev').addEventListener('click', () => { chooser.page--; renderColourChooser(); });
    modal.querySelector('.chooser-next').addEventListener('click', () => { chooser.page++; renderColourChooser(); });
    modal.querySelector('.chooser-close').addEventListener('click', closeColourChooser);
    modal.addEventListener('click', event => { if (event.target === modal) closeColourChooser(); });
    document.body.append(modal);
  }

  function closeColourChooser() {
    for (const colour of FAVOURITE_COLOURS) {
      const slot = `colour-${colour.toLowerCase()}`;
      const seen = favourites.seen[activeMode][slot] || {};
      for (const pokemonId of chooser.newIds[colour]) seen[pokemonId] = true;
      favourites.seen[activeMode][slot] = seen;
    }
    saveFavourites();
    chooser = null;
    document.querySelector('#favourite-chooser')?.remove();
    render();
  }

  function renderChooser() {
    document.querySelector('#favourite-chooser')?.remove();
    const modal = document.createElement('div');
    modal.id = 'favourite-chooser';
    modal.className = 'chooser-backdrop';
    modal.innerHTML = '<div class="chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title"><div class="chooser-head"><h2 id="chooser-title"></h2><button type="button" class="chooser-close" aria-label="Close chooser">×</button></div><div class="chooser-selected"></div><div class="chooser-grid"></div><div class="chooser-actions"><button type="button" class="chooser-prev">Previous</button><span class="chooser-page"></span><button type="button" class="chooser-next">Next</button></div></div>';
    modal.querySelector('#chooser-title').textContent = 'Choose a Favourite';
    const selected = pokemonById(favouriteValue(chooser.slot));
    const selectedEl = modal.querySelector('.chooser-selected');
    selectedEl.innerHTML = selected ? `<span>${chooser.label}</span><img src="${imagePath(selected.id, activeMode)}" alt=""><strong>${selected.name}</strong>` : `<span>${chooser.label}</span><strong>None selected</strong>`;
    const grid = modal.querySelector('.chooser-grid');
    const start = chooser.page * 30;
    for (const pokemon of chooser.candidates.slice(start, start + 30)) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = `pokemon home chooser-pokemon ${pokemon.id === favouriteValue(chooser.slot) ? 'selected' : ''} ${chooser.newIds.has(pokemon.id) ? 'new' : ''}`;
      const newCount = chooser.newIds.size;
      option.innerHTML = `<img src="${imagePath(pokemon.id, activeMode)}" alt=""><small>${pokemon.name}</small>${chooser.newIds.has(pokemon.id) ? `<span class="new-pill chooser-new-pill">${newCount} New</span>` : ''}`;
      option.addEventListener('click', () => { saveFavourite(chooser.slot, pokemon); render(); renderChooser(); });
      grid.append(option);
    }
    const pages = Math.ceil(chooser.candidates.length / 30);
    modal.querySelector('.chooser-page').textContent = `Page ${chooser.page + 1} of ${pages}`;
    modal.querySelector('.chooser-prev').hidden = pages === 1;
    modal.querySelector('.chooser-next').hidden = pages === 1;
    modal.querySelector('.chooser-prev').disabled = chooser.page === 0;
    modal.querySelector('.chooser-next').disabled = chooser.page >= pages - 1;
    modal.querySelector('.chooser-prev').addEventListener('click', () => { chooser.page--; renderChooser(); });
    modal.querySelector('.chooser-next').addEventListener('click', () => { chooser.page++; renderChooser(); });
    modal.querySelector('.chooser-close').addEventListener('click', closeChooser);
    modal.addEventListener('click', event => { if (event.target === modal) closeChooser(); });
    document.body.append(modal);
  }

  function closeChooser() {
    const seen = favourites.seen[activeMode][chooser.slot] || {};
    for (const pokemonId of chooser.newIds) seen[pokemonId] = true;
    favourites.seen[activeMode][chooser.slot] = seen;
    saveFavourites();
    chooser = null;
    document.querySelector('#favourite-chooser')?.remove();
    render();
  }

  function favouriteBox(title, content) {
    const section = document.createElement('section');
    section.className = 'box favourite-box';
    const head = document.createElement('div');
    head.className = 'favourite-box-head';
    head.innerHTML = `<span class="box-title">${title}</span>`;
    const tabs = document.createElement('div');
    tabs.className = 'mode-tabs';
    tabs.innerHTML = `<button class="${activeMode === 'regular' ? 'active' : ''}" data-mode="regular">Regular</button><button class="${activeMode === 'shiny' ? 'active' : ''}" data-mode="shiny">Shiny</button>`;
    tabs.addEventListener('click', event => { if (event.target.dataset.mode) { activeMode = event.target.dataset.mode; render(); } });
    head.append(tabs);
    section.append(head, content);
    return section;
  }

  function appendFavouriteBox(title, content) {
    boxesEl.append(favouriteBox(title, content));
  }

  function appendFavouriteGroups() {
    const starters = document.createElement('div');
    starters.className = 'starter-table';
    const row = document.createElement('div');
    row.className = 'starter-row';
    for (let stage = 0; stage < 3; stage++) {
      const category = `${stage + 1}${stage === 0 ? 'st' : stage === 1 ? 'nd' : 'rd'} Evo.`;
      row.append(favouriteSlot(`Starter ${category}`, `starter-${stage}`, candidateList('starter', '', stage), category, `Favourite Starter - ${category}`));
    }
    starters.append(row);
    appendFavouriteBox('Starters', starters);

    const regions = document.createElement('div');
    regions.className = 'favourite-choice-grid';
    for (const region of [...new Set(REGION_STARTS.values())]) regions.append(favouriteSlot(region, `region-${region.toLowerCase()}`, candidateList('region', region), region, `Favourite ${region} Pokemon`));
    appendFavouriteBox('Region', regions);

    const types = document.createElement('div');
    types.className = 'favourite-choice-grid';
    for (const type of [...new Set(allPokemon.map(pokemon => pokemon.types?.[0]).filter(Boolean))].sort()) {
      const category = type[0].toUpperCase() + type.slice(1);
      types.append(favouriteSlot(type, `type-${type}`, candidateList('type', type), category, `Favourite ${category} Type`));
    }
    appendFavouriteBox('Type', types);

    const colours = document.createElement('div');
    colours.className = 'favourite-choice-grid';
    const caughtPokemon = candidateList('colour');
    for (const colour of FAVOURITE_COLOURS) colours.append(favouriteSlot(colour, `colour-${colour.toLowerCase()}`, caughtPokemon, colour, `Favourite ${colour} Pokemon`, openColourChooser));
    appendFavouriteBox('Colour', colours);
  }

  function appendSearchGroup(title, boxes) {
    const query = normalizeSearch(searchQuery);
    if (!query) return;
    const matchesSearch = searchMatcher(query);
    const panels = [];
    for (const box of boxes) {
      const matches = box.pokemon.filter(matchesSearch);
      if (matches.length) panels.push(boxPanel(box, activeMode, false, { pokemon: matches, forceOpen: true }));
    }
    if (!panels.length) return;
    const heading = document.createElement('h2');
    heading.className = 'box-section-title';
    heading.textContent = title;
    boxesEl.append(heading, ...panels);
  }

  function render() {
    boxesEl.replaceChildren();
    searchPanel.hidden = view !== 'search';
    document.body.classList.toggle('favourites-view', view === 'favourites');
    document.body.classList.toggle('searching', view === 'search');
    const nationalDex = DATA.boxes.filter(box => box.id.startsWith('dex-'));
    const forms = DATA.boxes.filter(box => box.id.startsWith('forms-'));
    if (view === 'favourites') {
      appendFavouriteGroups();
    } else if (view === 'search') {
      appendSearchGroup('National Pokédex', nationalDex);
      appendSearchGroup('Pokémon Forms', forms);
    } else {
      appendBoxGroup('National Pokédex', nationalDex, view === 'transfer');
      appendBoxGroup('Pokémon Forms', forms, view === 'transfer');
    }
    const hasBoxes = boxesEl.querySelector('.box') !== null;
    const hasSearchQuery = normalizeSearch(searchQuery) !== '';
    emptyEl.querySelector('h2').textContent = view === 'search' ? 'No matches' : 'All transferred';
    emptyEl.querySelector('p').textContent = view === 'search' ? 'Try a different Pokémon or form name.' : 'No caught Pokémon are waiting for Home.';
    emptyEl.hidden = hasBoxes || (view === 'search' && !hasSearchQuery);
    updateCounts();
  }

  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; render(); });
  searchPanel.addEventListener('submit', e => e.preventDefault());
  document.querySelector('.dock').addEventListener('click', e => {
    const button = e.target.closest('[data-view]'); if (!button) return;
    view = button.dataset.view; openKey = null;
    document.querySelectorAll('.dock button').forEach(b => b.classList.toggle('active', b === button));
    render();
    if (view === 'search') searchInput.focus();
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
  render();
})();
