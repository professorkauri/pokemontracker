(() => {
  const DATA = window.POKEMON_DATA;
  const STORAGE_KEY = 'pokemon-home-tracker-v1';
  const boxesEl = document.querySelector('#boxes');
  const emptyEl = document.querySelector('#empty');
  let view = 'pokedex';
  let openKey = null;
  let modes = {};
  let state = loadState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateCounts(); }
  function key(boxId, pokemonId, mode) { return `${boxId}|${pokemonId}|${mode}`; }
  function getStatus(boxId, pokemonId, mode) { return state[key(boxId, pokemonId, mode)] || 0; }
  function imagePath(pokemonId, mode) { return `images/${mode}/${pokemonId}.png`; }

  function updateCounts() {
    const values = Object.values(state);
    document.querySelector('#home-count').textContent = values.filter(v => v === 2).length;
    document.querySelector('#transfer-count').textContent = values.filter(v => v === 1).length;
  }

  function card(box, pokemon, mode, transferMode) {
    const status = getStatus(box.id, pokemon.id, mode);
    const names = ['missing', 'caught', 'home'];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pokemon ${names[status]}`;
    button.dataset.label = pokemon.name;
    button.title = `${pokemon.name}: ${names[status]}`;
    button.setAttribute('aria-label', button.title);
    button.innerHTML = `<span class="status">${status === 1 ? '!' : status === 2 ? '✓' : ''}</span><img alt="" loading="lazy"><small>${pokemon.name}</small>`;
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
    const section = document.createElement('section');
    section.className = `box ${openKey === panelKey ? 'open' : ''} ${transferMode ? 'transfer-box' : ''}`;
    const waiting = box.pokemon.filter(p => getStatus(box.id, p.id, mode) === 1).length;
    section.innerHTML = `<button class="box-head" type="button" aria-expanded="${openKey === panelKey}"><span class="box-title">${box.title}${transferMode && mode === 'shiny' ? ' Shiny' : ''}</span><span class="box-meta">${transferMode ? `${waiting} waiting` : `${box.pokemon.length} slots`}</span><span class="chevron">⌄</span></button>`;
    section.querySelector('.box-head').addEventListener('click', () => { openKey = openKey === panelKey ? null : panelKey; render(); });
    if (openKey === panelKey) {
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

  function render() {
    boxesEl.replaceChildren();
    if (view === 'pokedex') DATA.boxes.forEach(box => boxesEl.append(boxPanel(box, modes[box.id] || 'regular', false)));
    else DATA.boxes.forEach(box => ['regular', 'shiny'].forEach(mode => {
      if (box.pokemon.some(p => getStatus(box.id, p.id, mode) === 1)) boxesEl.append(boxPanel(box, mode, true));
    }));
    emptyEl.hidden = boxesEl.children.length > 0;
    updateCounts();
  }

  document.querySelector('.dock').addEventListener('click', e => {
    const button = e.target.closest('[data-view]'); if (!button) return;
    view = button.dataset.view; openKey = null;
    document.querySelectorAll('.dock button').forEach(b => b.classList.toggle('active', b === button));
    document.querySelector('#view-description').textContent = view === 'pokedex' ? 'Tap a box to open it. Each Pokémon cycles from missing → caught → in Home.' : 'Only boxes with caught Pokémon appear. Tap a waiting Pokémon after transferring it to Home.';
    render(); window.scrollTo({top: 0, behavior: 'smooth'});
  });
  render();
})();
