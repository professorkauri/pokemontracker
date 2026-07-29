(() => {
  const DATA = window.POKEMON_DATA;
  const STORAGE_KEY = 'pokemon-home-tracker-v1';
  const REGION_STARTS = new Map([[1, 'Kanto'], [152, 'Johto'], [252, 'Hoenn'], [387, 'Sinnoh'], [494, 'Unova'], [650, 'Kalos'], [722, 'Alola'], [810, 'Galar'], [899, 'Hisui'], [906, 'Paldea']]);
  const FORM_BOX_BY_POKEMON = new Map(DATA.boxes.filter(box => box.id.startsWith('forms-')).flatMap(box => box.pokemon.map(pokemon => [pokemon.id, box.id])));
  const boxesEl = document.querySelector('#boxes');
  const emptyEl = document.querySelector('#empty');
  let view = 'pokedex';
  let openKey = null;
  let modes = {};
  let state = loadState();

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

  function card(box, pokemon, mode, transferMode) {
    const status = getStatus(box.id, pokemon.id, mode);
    const region = REGION_STARTS.get(pokemon.dex);
    const names = ['missing', 'caught', 'home'];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pokemon ${names[status]}`;
    button.dataset.label = pokemon.name;
    button.title = `${pokemon.name}: ${names[status]}`;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = `${region ? `<div class="region-pill">${region}</div>` : ''}<span class="status">${status === 1 ? '!' : status === 2 ? '✓' : ''}</span><img alt="" loading="lazy"><small>${pokemon.name}</small>`;
    const img = button.querySelector('img');
    img.src = imagePath(pokemon.id, mode);
    img.onerror = () => { img.onerror = null; img.src = imagePath(pokemon.imageId || pokemon.id, mode); };
    if (!transferMode || status === 1) button.addEventListener('click', () => {
      state[key(box.id, pokemon.id, mode)] = transferMode ? 2 : (status + 1) % 3;
      if (state[key(box.id, pokemon.id, mode)] === 0) delete state[key(box.id, pokemon.id, mode)];
      saveState(); render();
    });
    return button;
  }

  function boxPanel(box, mode, transferMode) {
    const panelKey = transferMode ? `${box.id}-${mode}` : box.id;
    const isOpen = transferMode || openKey === panelKey;
    const region = box.pokemon.map(pokemon => REGION_STARTS.get(pokemon.dex)).find(Boolean);
    const section = document.createElement('section');
    section.className = `box ${region ? 'region-start' : ''} ${isOpen ? 'open' : ''} ${transferMode ? 'transfer-box' : ''}`;
    const regularHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'regular') === 2).length;
    const shinyHome = box.pokemon.filter(p => getStatus(box.id, p.id, 'shiny') === 2).length;
    const regularPercent = (regularHome / box.pokemon.length) * 100;
    const shinyPercent = (shinyHome / box.pokemon.length) * 100;
    const boxMeta = `<span class="progress-donut regular" role="progressbar" aria-label="Regular Home progress" aria-valuemin="0" aria-valuemax="${box.pokemon.length}" aria-valuenow="${regularHome}" style="--progress:${regularPercent}%"></span><span class="progress-donut shiny" role="progressbar" aria-label="Shiny Home progress" aria-valuemin="0" aria-valuemax="${box.pokemon.length}" aria-valuenow="${shinyHome}" style="--progress:${shinyPercent}%"></span>`;
    section.innerHTML = `<button class="box-head" type="button" aria-expanded="${isOpen}" ${transferMode ? 'aria-disabled="true"' : ''}>${region ? `<div class="region-pill">${region}</div>` : ''}<span class="box-title">${box.title}${transferMode && mode === 'shiny' ? ' Shiny' : ''}</span><span class="box-meta">${boxMeta}</span><span class="chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5 8l5 5 5-5" /></svg></span></button>`;
    if (!transferMode) section.querySelector('.box-head').addEventListener('click', () => { openKey = openKey === panelKey ? null : panelKey; render(); });
    if (isOpen) {
      const body = document.createElement('div'); body.className = 'box-body';
      if (!transferMode) {
        mode = modes[box.id] || 'regular';
        const tabs = document.createElement('div'); tabs.className = 'mode-tabs';
        tabs.innerHTML = `<button class="${mode === 'regular' ? 'active' : ''}" data-mode="regular">Regular</button><button class="${mode === 'shiny' ? 'active' : ''}" data-mode="shiny">Shiny</button>`;
        tabs.addEventListener('click', e => { if (e.target.dataset.mode) { modes[box.id] = e.target.dataset.mode; render(); } });
        body.append(tabs);
      }
      const grid = document.createElement('div'); grid.className = 'pokemon-grid';
      box.pokemon.forEach(p => grid.append(card(box, p, mode, transferMode)));
      body.append(grid); section.append(body);
    }
    return section;
  }

  function appendBoxGroup(title, boxes, transferMode) {
    const panels = [];
    for (const box of boxes) {
      if (!transferMode) panels.push(boxPanel(box, modes[box.id] || 'regular', false));
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

  function render() {
    boxesEl.replaceChildren();
    const nationalDex = DATA.boxes.filter(box => box.id.startsWith('dex-'));
    const forms = DATA.boxes.filter(box => box.id.startsWith('forms-'));
    appendBoxGroup('National Pokédex', nationalDex, view === 'transfer');
    appendBoxGroup('Pokémon Forms', forms, view === 'transfer');
    emptyEl.hidden = boxesEl.querySelector('.box') !== null;
    updateCounts();
  }

  document.querySelector('.dock').addEventListener('click', e => {
    const button = e.target.closest('[data-view]'); if (!button) return;
    view = button.dataset.view; openKey = null;
    document.querySelectorAll('.dock button').forEach(b => b.classList.toggle('active', b === button));
    render(); window.scrollTo({top: 0, behavior: 'smooth'});
  });
  render();
})();
