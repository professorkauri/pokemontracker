(async () => {
  const DATA = window.POKEMON_DATA;
  const STORAGE_KEY = 'pokemon-home-tracker-v2';
  const LEGACY_STORAGE_KEY = 'pokemon-home-tracker-v1';
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
  const favouriteGroups = await loadFavouriteGroups();
  const excludedFavouriteGroupIds = new Set(favouriteGroups.filter(group => group.exclude).flatMap(group => group.pokemon || []));
  const FORM_BOX_REGIONS = new Map(DATA.boxes
    .filter(box => box.id.startsWith('forms-'))
    .map(box => [box.id, box.title.replace(/(?: & Convergent| Forms(?: II)?)$/, '')])
    .filter(([, region]) => [...REGION_STARTS.values()].includes(region)));
  const chooserPokemon = [...new Map(allPokemon.map(pokemon => [pokemon.id, pokemon])).values()]
    .filter(pokemon => pokemon.showInFavourites !== false)
    .sort((first, second) => (first.dex || nationalSpecies.find(pokemon => pokemon.id === baseSpeciesId(first))?.dex || Infinity)
      - (second.dex || nationalSpecies.find(pokemon => pokemon.id === baseSpeciesId(second))?.dex || Infinity));
  const evolutionLineBySpecies = new Map((DATA.evolutionLines || []).flatMap(line => line.map(id => [id, line])));
  let view = 'pokedex';
  let openKey = DATA.boxes.find(box => box.id.startsWith('dex-'))?.id || null;
  let activeMode = 'regular';
  let searchQuery = '';
  let state = loadState();
  let favourites = loadFavourites();
  let chooser = null;

  function normalizeSearch(value) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
  async function loadFavouriteGroups() {
    try {
      const response = await fetch('data/favourite-groups.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Failed to load favourite groups: ${response.status}`);
      return await response.json();
    } catch {
      return DATA.favouriteGroups || [];
    }
  }
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
  function regionForPokemon(pokemon) {
    return pokemon.region
      || regionForDex(pokemon.dex)
      || FORM_BOX_REGIONS.get(FORM_BOX_BY_POKEMON.get(pokemon.id))
      || regionForDex(nationalSpecies.find(species => species.id === baseSpeciesId(pokemon))?.dex);
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
      const currentSave = localStorage.getItem(STORAGE_KEY);
      const saved = JSON.parse(currentSave || localStorage.getItem(LEGACY_STORAGE_KEY)) || {};
      const legacySave = !currentSave && localStorage.getItem(LEGACY_STORAGE_KEY);
      let migrated = false;
      if (legacySave) {
        for (const savedKey of Object.keys(saved)) saved[savedKey] += 1;
        migrated = true;
      }
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
  function imagePath(pokemonId, mode) { return `images/thumbs/${mode}/${pokemonId}.webp`; }
  function artworkPath(pokemonId, mode) { return `images/${mode}/${pokemonId}.png`; }
  function imageSources(pokemon, mode) {
    const ids = [...new Set([pokemon.id, pokemon.imageId].filter(Boolean))];
    return [...ids.map(id => imagePath(id, mode)), ...ids.map(id => artworkPath(id, mode))];
  }
  function imageMarkup(pokemon, mode, attributes = '') {
    const [src, ...fallbacks] = imageSources(pokemon, mode);
    const fallbackAttr = fallbacks.length ? ` data-fallback-srcs="${fallbacks.join('|')}"` : '';
    return `<img src="${src}"${fallbackAttr} loading="lazy" decoding="async" ${attributes}>`;
  }
  function addImageFallbacks(parent) {
    parent.querySelectorAll('img[data-fallback-srcs]').forEach(img => {
      img.onerror = () => {
        const [next, ...rest] = (img.dataset.fallbackSrcs || '').split('|').filter(Boolean);
        if (!next) {
          img.onerror = null;
          return;
        }
        img.dataset.fallbackSrcs = rest.join('|');
        img.src = next;
      };
    });
  }
  function pokemonById(id) { return chooserPokemon.find(pokemon => pokemon.id === id); }
  function favouriteValue(slot) { return favourites[activeMode][slot]; }
  function isColourFavourite(pokemonId) {
    return FAVOURITE_COLOURS.some(colour => favourites[activeMode][`colour-${colour.toLowerCase()}`] === pokemonId);
  }
  function newCandidates(slot, candidates) {
    const seen = favourites.seen[activeMode][slot] || {};
  
    return candidates.filter(pokemon =>
      isCollected(pokemon) &&
      !seen[pokemon.id]
    );
  }
  function isCollected(pokemon) {
    return DATA.boxes.some(box => box.pokemon.some(entry => entry.id === pokemon.id && getStatus(box.id, entry.id, activeMode) >= 2));
  }
  function saveFavourite(slot, pokemon) {
    if (pokemon) favourites[activeMode][slot] = pokemon.id;
    else delete favourites[activeMode][slot];
    saveFavourites();
  }

  function favouriteChoicesWithNewPokemonCount() {
    const choices = [];

    for (const group of favouriteGroups) {
      choices.push([`group-${group.id}`, candidateList('group', group.id)]);
    }
    for (const region of new Set(REGION_STARTS.values())) {
      choices.push([`region-${region.toLowerCase()}`, candidateList('region', region)]);
    }
    for (const type of new Set(allPokemon.map(pokemon => pokemon.types?.[0]).filter(Boolean))) {
      choices.push([`type-${type}`, candidateList('type', type)]);
    }
    const colourCandidates = candidateList('colour');
    for (const colour of FAVOURITE_COLOURS) {
      choices.push([`colour-${colour.toLowerCase()}`, colourCandidates]);
    }

    return choices.filter(([slot, candidates]) => newCandidates(slot, candidates).length > 0).length;
  }

  function updateCounts() {
    const values = Object.values(state);
    const targetCount = values.filter(value => value === 1).length;
    const transferCount = values.filter(value => value === 2).length;
    const favouriteCount = favouriteChoicesWithNewPokemonCount();
    const total = DATA.boxes.reduce((sum, box) => sum + box.pokemon.length, 0);
    const regularHome = DATA.boxes.reduce((sum, box) => sum + box.pokemon.filter(p => getStatus(box.id, p.id, 'regular') === 3).length, 0);
    const shinyHome = DATA.boxes.reduce((sum, box) => sum + box.pokemon.filter(p => getStatus(box.id, p.id, 'shiny') === 3).length, 0);
    const regularProgress = document.querySelector('#regular-progress');
    const shinyProgress = document.querySelector('#shiny-progress');
    regularProgress.max = total; regularProgress.value = regularHome;
    shinyProgress.max = total; shinyProgress.value = shinyHome;
    document.querySelector('#regular-home-count').textContent = `${regularHome} / ${total}`;
    document.querySelector('#shiny-home-count').textContent = `${shinyHome} / ${total}`;
    for (const [selector, count] of [
      ['#target-count', targetCount],
      ['#transfer-count', transferCount],
      ['#favourites-count', favouriteCount]
    ]) {
      const badge = document.querySelector(selector);
      badge.textContent = count;
      badge.hidden = count === 0;
    }
  }

  function statusIcon(status) {
    if (status === 1) return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7.5"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path></svg>';
    if (status === 2) return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v12"></path><path d="m7.5 8.5 4.5-4.5 4.5 4.5"></path><path d="M5 15.5v2.25A2.25 2.25 0 0 0 7.25 20h9.5A2.25 2.25 0 0 0 19 17.75V15.5"></path></svg>';
    if (status === 3) return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5.5 12.5 4 4 9-9"></path></svg>';
    return '';
  }

  function card(box, pokemon, mode, queueStatus, favouriteMode = false) {
    const status = getStatus(box.id, pokemon.id, mode);
    const region = REGION_STARTS.get(pokemon.dex);
    const names = ['missing', 'target', 'caught', 'home'];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pokemon ${names[status]}`;
    button.classList.toggle('favourite', favouriteMode && favourites[mode][pokemon.id]);
    button.dataset.label = pokemon.name;
    button.title = `${pokemon.name}: ${names[status]}`;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = `${region ? `<div class="region-pill">${region}</div>` : ''}${favouriteMode ? '<span class="favourite-mark" aria-hidden="true">★</span>' : ''}<span class="status">${statusIcon(status)}</span>${imageMarkup(pokemon, mode, 'alt=""')}<small>${pokemon.name}</small>`;
    addImageFallbacks(button);
    if (favouriteMode) button.addEventListener('click', () => {
      if (favourites[mode][pokemon.id]) delete favourites[mode][pokemon.id];
      else favourites[mode][pokemon.id] = pokemon.id;
      saveFavourites(); render();
    });
    else if (queueStatus === null || status === queueStatus) button.addEventListener('click', () => {
      state[key(box.id, pokemon.id, mode)] = queueStatus === null ? (status + 1) % 4 : status + 1;
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
    return `<span class="box-title-sprite" title="${pokemon.name}" aria-hidden="true">${imageMarkup(pokemon, mode, 'alt=""')}</span>`;
  }

  function boxTitle(box, pokemon, mode, queueStatus) {
    const first = pokemon[0];
    const title = `${box.title}${queueStatus !== null && mode === 'shiny' ? ' Shiny' : ''}`;
    return `${boxTitleSprite(first, mode)}<span class="box-title">${title}</span>`;
  }

  function boxPanel(box, mode, queueStatus, options = {}) {
    const pokemon = options.pokemon || box.pokemon;
    const forceOpen = options.forceOpen || false;
    const filtered = pokemon.length !== box.pokemon.length;
    const panelKey = queueStatus !== null ? `${box.id}-${mode}` : box.id;
    const isOpen = forceOpen || queueStatus !== null || openKey === panelKey;
    const region = pokemon.map(pokemon => REGION_STARTS.get(pokemon.dex)).find(Boolean);
    const section = document.createElement('section');
    const queueClass = queueStatus === 1 ? 'queue-box target-box' : queueStatus === 2 ? 'queue-box transfer-box' : '';
    section.className = `box ${region ? 'region-start' : ''} ${isOpen ? 'open' : ''} ${queueClass} ${forceOpen ? 'forced-open' : ''}`;
    const regularHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'regular') === 3).length;
    const shinyHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'shiny') === 3).length;
    const boxMeta = `${progressDonut('regular', regularHome, box.pokemon.length)}${progressDonut('shiny', shinyHome, box.pokemon.length)}`;
    section.innerHTML = `<button class="box-head" type="button" aria-expanded="${isOpen}" ${queueStatus !== null ? 'aria-disabled="true"' : ''}>${region ? `<div class="region-pill">${region}</div>` : ''}${boxTitle(box, pokemon, mode, queueStatus)}<span class="box-meta">${boxMeta}</span><span class="chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5 8l5 5 5-5" /></svg></span></button>`;
    addImageFallbacks(section);
    if (queueStatus === null && !forceOpen) section.querySelector('.box-head').addEventListener('click', () => { openKey = openKey === panelKey ? null : panelKey; render(); });
    if (isOpen) {
      const body = document.createElement('div'); body.className = 'box-body';
      if (queueStatus === null) {
        mode = activeMode;
        const tabs = document.createElement('div'); tabs.className = 'mode-tabs';
        tabs.innerHTML = `<button class="${mode === 'regular' ? 'active' : ''}" data-mode="regular">Regular</button><button class="${mode === 'shiny' ? 'active' : ''}" data-mode="shiny">Shiny</button>`;
        tabs.addEventListener('click', e => { if (e.target.dataset.mode) { activeMode = e.target.dataset.mode; render(); } });
        body.append(tabs);
      }
      const grid = document.createElement('div'); grid.className = 'pokemon-grid';
      pokemon.forEach(p => grid.append(card(box, p, mode, queueStatus, options.favouriteMode)));
      if (!filtered) for (let i = pokemon.length; i < 30; i++) grid.append(emptySlot());
      body.append(grid); section.append(body);
    }
    return section;
  }

  function appendBoxGroup(title, boxes, queueStatus = null, favouriteMode = false) {
    const panels = [];
    for (const box of boxes) {
      if (queueStatus === null) panels.push(boxPanel(box, activeMode, null, { favouriteMode, forceOpen: favouriteMode }));
      else for (const mode of ['regular', 'shiny']) {
        if (box.pokemon.some(p => getStatus(box.id, p.id, mode) === queueStatus)) panels.push(boxPanel(box, mode, queueStatus));
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
      button.innerHTML = `${imageMarkup(selected, activeMode, 'alt=""')}<small class="favourite-name">${selected.name}</small><small class="favourite-category">${category}</small>`;
    } else {
      button.innerHTML = `<span class="favourite-image-placeholder" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path class="pokeball-fill" d="M4 16a12 12 0 0 1 24 0Z"></path><circle cx="16" cy="16" r="12"></circle><path d="M4 16h7.75M20.25 16H28"></path><circle class="pokeball-cutout" cx="16" cy="16" r="4.25"></circle></svg></span><small class="favourite-name">Choose...</small><small class="favourite-category">${category}</small>`;
    }
    const newCount = newCandidates(slot, candidates).length;
    if (newCount) button.innerHTML += `<span class="new-pill">${newCount} New</span>`;
    addImageFallbacks(button);
    button.addEventListener('click', () => chooserAction(favouriteLabel, slot, candidates));
    return button;
  }

  function candidateList(kind, value, stage = 0) {
    let candidates;
  
    if (kind === 'starter') {
      candidates = [...new Set(
        (DATA.starterGroups || [])
          .flatMap(group => group.pokemon.filter((_, index) => index % 3 === stage))
      )]
        .map(pokemonById)
        .filter(Boolean);
  
    } else if (kind === 'group') {
      candidates = (favouriteGroups.find(group => group.id === value)?.pokemon || [])
        .map(pokemonById)
        .filter(Boolean);
  
    } else if (kind === 'region') {
      candidates = chooserPokemon.filter(pokemon =>
        !excludedFavouriteGroupIds.has(pokemon.id) &&
        regionForPokemon(pokemon) === value
      );
  
    } else if (kind === 'colour') {
      candidates = chooserPokemon;
  
    } else {
      candidates = chooserPokemon.filter(pokemon =>
        !excludedFavouriteGroupIds.has(pokemon.id) &&
        pokemon.types?.[0] === value
      );
    }
  
    return candidates;
  }

  function openChooser(label, slot, candidates) {
    const newIds = new Set(newCandidates(slot, candidates).map(pokemon => pokemon.id));
    const sortedCandidates = [...candidates].sort((first, second) => Number(newIds.has(second.id)) - Number(newIds.has(first.id)));
    chooser = { label, slot, candidates: sortedCandidates, page: 0, newIds };
    renderChooser();
  }

  function openColourChooser() {
    const candidates = candidateList('colour');
    const newIds = {};
    for (const colour of FAVOURITE_COLOURS) {
      newIds[colour] = new Set(newCandidates(`colour-${colour.toLowerCase()}`, candidates).map(pokemon => pokemon.id));
    }
    const sortedCandidates = [...candidates].sort((first, second) => {
      const firstNew = Object.values(newIds).some(ids => ids.has(first.id));
      const secondNew = Object.values(newIds).some(ids => ids.has(second.id));
      return Number(secondNew) - Number(firstNew);
    });
    chooser = { colour: true, candidates: sortedCandidates, page: 0, newIds };
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
      if (selected) target.innerHTML += `${imageMarkup(selected, activeMode, 'alt=""')}<small>${selected.name}</small>`;
      else target.innerHTML += '<span>Choose...</span>';
      addImageFallbacks(target);
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
      option.innerHTML = `${imageMarkup(pokemon, activeMode, 'alt=""')}<small>${pokemon.name}</small>`;
      addImageFallbacks(option);
      option.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', pokemon.id));
      let dragPreview = null;
      let activeTarget = null;
      const clearTouchDrag = () => {
        dragPreview?.remove();
        activeTarget?.classList.remove('drag-target');
        dragPreview = null;
        activeTarget = null;
      };
      const updateTouchDrag = event => {
        if (!dragPreview) return;
        dragPreview.style.left = `${event.clientX}px`;
        dragPreview.style.top = `${event.clientY}px`;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.colour-favourite-target');
        if (target === activeTarget) return;
        activeTarget?.classList.remove('drag-target');
        activeTarget = target && modal.contains(target) ? target : null;
        activeTarget?.classList.add('drag-target');
      };
      option.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') return;
        event.preventDefault();
        dragPreview = document.createElement('div');
        dragPreview.className = 'touch-drag-preview';
        dragPreview.innerHTML = `${imageMarkup(pokemon, activeMode, 'alt=""')}<strong>${pokemon.name}</strong>`;
        addImageFallbacks(dragPreview);
        modal.append(dragPreview);
        updateTouchDrag(event);
        option.setPointerCapture(event.pointerId);
      });
      option.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') updateTouchDrag(event);
      });
      option.addEventListener('pointerup', event => {
        if (event.pointerType === 'mouse') return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.colour-favourite-target');
        const dropTarget = target && modal.contains(target) ? target : null;
        clearTouchDrag();
        if (!dropTarget) return;
        saveFavourite(dropTarget.dataset.slot, pokemon);
        render();
        renderColourChooser();
      });
      option.addEventListener('pointercancel', clearTouchDrag);
      grid.append(option);
    }
    const pages = Math.ceil(chooser.candidates.length / 30);
    modal.querySelector('.chooser-page').textContent = pages > 1 ? `Page ${chooser.page + 1} of ${pages}` : '';
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
  
    modal.innerHTML = `
      <div class="chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title">
        <div class="chooser-head">
          <h2 id="chooser-title"></h2>
          <button type="button" class="chooser-close" aria-label="Close chooser">×</button>
        </div>
  
        <div class="chooser-selected"></div>
  
        <div class="chooser-grid"></div>
  
        <div class="chooser-actions">
          <button type="button" class="chooser-prev">Previous</button>
          <span class="chooser-page"></span>
          <button type="button" class="chooser-next">Next</button>
        </div>
      </div>
    `;
  
    modal.querySelector('#chooser-title').textContent = 'Choose a Favourite';
  
    const selected = pokemonById(favouriteValue(chooser.slot));
    const selectedEl = modal.querySelector('.chooser-selected');
  
    selectedEl.innerHTML = selected
      ? `
        <span>${chooser.label}</span>
        ${imageMarkup(selected, activeMode, 'alt=""')}
        <strong>${selected.name}</strong>
      `
      : `
        <span>${chooser.label}</span>
        <strong>None selected</strong>
      `;
  
    const grid = modal.querySelector('.chooser-grid');
    addImageFallbacks(selectedEl);
    const start = chooser.page * 30;
  
    for (const pokemon of chooser.candidates.slice(start, start + 30)) {
      const option = document.createElement('button');
      const collected = isCollected(pokemon);
      const isNew = chooser.newIds.has(pokemon.id);
  
      option.type = 'button';
  
      option.className = [
        'pokemon',
        'home',
        'chooser-pokemon',
        pokemon.id === favouriteValue(chooser.slot) ? 'selected' : '',
        isNew ? 'new' : '',
        !collected ? 'unobtained' : ''
      ].filter(Boolean).join(' ');
  
      option.innerHTML = `
        ${imageMarkup(pokemon, activeMode, 'alt=""')}
        <small>${pokemon.name}</small>
        ${isNew ? '<span class="new-pill chooser-new-pill">!</span>' : ''}
      `;
      addImageFallbacks(option);
  
      if (collected) {
        option.addEventListener('click', () => {
          saveFavourite(chooser.slot, pokemon);
          render();
          renderChooser();
        });
      } else {
        option.disabled = true;
        option.setAttribute('aria-label', `${pokemon.name} — not obtained`);
  
      }
  
      grid.append(option);
    }
  
    const pages = Math.ceil(chooser.candidates.length / 30);
  
    modal.querySelector('.chooser-page').textContent =
      pages > 1 ? `Page ${chooser.page + 1} of ${pages}` : '';
  
    modal.querySelector('.chooser-prev').hidden = pages === 1;
    modal.querySelector('.chooser-next').hidden = pages === 1;
  
    modal.querySelector('.chooser-prev').disabled = chooser.page === 0;
    modal.querySelector('.chooser-next').disabled = chooser.page >= pages - 1;
  
    modal.querySelector('.chooser-prev').addEventListener('click', () => {
      chooser.page--;
      renderChooser();
    });
  
    modal.querySelector('.chooser-next').addEventListener('click', () => {
      chooser.page++;
      renderChooser();
    });
  
    modal.querySelector('.chooser-close').addEventListener('click', closeChooser);
  
    modal.addEventListener('click', event => {
      if (event.target === modal) closeChooser();
    });
  
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
    if (favouriteGroups.length) {
      const groups = document.createElement('div');
      groups.className = 'favourite-choice-grid';
      let pendingDivider = null;
      for (const group of favouriteGroups) {
        if (group.divider) pendingDivider = group.divider;
        const candidates = candidateList('group', group.id);
        if (!candidates.length) continue;
        if (pendingDivider) {
          const divider = document.createElement('div');
          divider.className = 'favourite-group-divider';
          divider.textContent = pendingDivider;
          groups.append(divider);
          pendingDivider = null;
        }
        groups.append(favouriteSlot(group.label, `group-${group.id}`, candidates, group.label, `Favourite ${group.label}`));
      }
      if (groups.children.length) appendFavouriteBox('Groups', groups);
    }

    const regions = document.createElement('div');
    regions.className = 'favourite-choice-grid';
    for (const region of [...new Set(REGION_STARTS.values())]) {
      const candidates = candidateList('region', region);
      if (candidates.length) regions.append(favouriteSlot(region, `region-${region.toLowerCase()}`, candidates, region, `Favourite ${region} Pokemon`));
    }
    if (regions.children.length) appendFavouriteBox('Region', regions);

    const types = document.createElement('div');
    types.className = 'favourite-choice-grid';
    for (const type of [...new Set(allPokemon.map(pokemon => pokemon.types?.[0]).filter(Boolean))].sort()) {
      const category = type[0].toUpperCase() + type.slice(1);
      const candidates = candidateList('type', type);
      if (candidates.length) types.append(favouriteSlot(type, `type-${type}`, candidates, category, `Favourite ${category} Type`));
    }
    if (types.children.length) appendFavouriteBox('Type', types);

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
      if (matches.length) panels.push(boxPanel(box, activeMode, null, { pokemon: matches, forceOpen: true }));
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
      const queueStatus = view === 'target' ? 1 : view === 'transfer' ? 2 : null;
      appendBoxGroup('National Pokédex', nationalDex, queueStatus);
      appendBoxGroup('Pokémon Forms', forms, queueStatus);
    }
    const hasBoxes = boxesEl.querySelector('.box') !== null;
    const hasSearchQuery = normalizeSearch(searchQuery) !== '';
    emptyEl.querySelector('h2').textContent = view === 'search' ? 'No matches' : view === 'target' ? 'No targets' : 'All transferred';
    emptyEl.querySelector('p').textContent = view === 'search' ? 'Try a different Pokémon or form name.' : view === 'target' ? 'Mark Pokémon as targets in the Dex to focus on them here.' : 'No caught Pokémon are waiting for Home.';
    emptyEl.hidden = hasBoxes || (view === 'search' && !hasSearchQuery);
    updateCounts();
  }

  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; render(); });
  searchPanel.addEventListener('submit', e => e.preventDefault());
  document.querySelector('.dock').addEventListener('click', e => {
    const button = e.target.closest('[data-view]'); if (!button) return;
    view = button.dataset.view;
    document.querySelectorAll('.dock button').forEach(b => b.classList.toggle('active', b === button));
    render();
    if (view === 'search') searchInput.focus();
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
  render();
})();
