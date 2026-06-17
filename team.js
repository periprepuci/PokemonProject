'use strict';

const BACKEND_URL = 'https://pokemonproject-vwu0.onrender.com';

const TYPE_COLORS = {
  normal:'#9199a1', fire:'#ff6f30',   water:'#4e8eff',  electric:'#f5c518',
  grass:'#3bc86a',  ice:'#74cec0',    fighting:'#ce4069',poison:'#a95fc6',
  ground:'#d67c32', flying:'#89aae3', psychic:'#f35282', bug:'#90c12c',
  rock:'#c5b78c',   ghost:'#5269ac',  dragon:'#0b6dc3',  dark:'#595761',
  steel:'#5a8ea1',  fairy:'#ec8fe6',
};

const TYPE_NAMES_ES = {
  normal:'Normal', fire:'Fuego', water:'Agua', electric:'Eléctrico',
  grass:'Planta', ice:'Hielo', fighting:'Lucha', poison:'Veneno',
  ground:'Tierra', flying:'Volador', psychic:'Psíquico', bug:'Bicho',
  rock:'Roca', ghost:'Fantasma', dragon:'Dragón', dark:'Siniestro',
  steel:'Acero', fairy:'Hada',
};

const I18N = {
  en: {
    pageTitle:'Team Builder', back:'← Pokédex', addPokemon:'Add Pokémon',
    ability:'Ability', hiddenAbility:'Hidden',
    item:'Held item', moves:'Moves', analyze:'⚡ Analyze Team',
    analyzing:'Analyzing…', analysisTitle:'Team Analysis',
    searchPlaceholder:'Search Pokémon…', remove:'Remove',
    noResults:'No Pokémon found', itemPlaceholder:'e.g. Choice Specs',
    move: n => `Move ${n}`, clickToChange:'Click to change',
  },
  es: {
    pageTitle:'Team Builder', back:'← Pokédex', addPokemon:'Añadir Pokémon',
    ability:'Habilidad', hiddenAbility:'Oculta',
    item:'Objeto', moves:'Movimientos', analyze:'⚡ Analizar Equipo',
    analyzing:'Analizando…', analysisTitle:'Análisis del Equipo',
    searchPlaceholder:'Buscar Pokémon…', remove:'Quitar',
    noResults:'No se encontraron Pokémon', itemPlaceholder:'ej. Restos',
    move: n => `Movimiento ${n}`, clickToChange:'Click para cambiar',
  },
};

// ── STATE ────────────────────────────────────────────────────
let lang             = 'en';
let allPokemon       = [];
let detailCache      = new Map();
let abilityNames     = new Map();   // eng slug → Spanish name
let megaAbilityPatch = {};          // pokemon name → abilities array
let movesList    = [];
let itemsList    = [];
let team = Array.from({length: 6}, () => ({ pokemon:null, ability:'', item:'', moves:['','','',''] }));
let pickerSlot  = -1;

// ── DOM ───────────────────────────────────────────────────────
const teamGrid       = document.getElementById('team-grid');
const btnAnalyze     = document.getElementById('btn-analyze');
const pickerOverlay  = document.getElementById('picker-overlay');
const pickerCloseBtn = document.getElementById('picker-close');
const pickerSearchEl = document.getElementById('picker-search');
const pickerGridEl   = document.getElementById('picker-grid');
const analysisOverlay  = document.getElementById('analysis-overlay');
const analysisCloseBtn = document.getElementById('analysis-close');
const analysisTitleEl  = document.getElementById('analysis-title');
const analysisContent  = document.getElementById('analysis-content');

// ── HELPERS ───────────────────────────────────────────────────
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const formatName = n => n.split('-').map(capitalize).join(' ');
const typeName   = t => lang === 'es' ? (TYPE_NAMES_ES[t] || capitalize(t)) : capitalize(t);
const normalize  = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const spriteUrl  = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
function baseId(d) {
  if (!d || d.id <= 1025) return d?.id ?? 0;
  const parts = (d.species?.url || '').split('/').filter(Boolean);
  return parts.length ? parseInt(parts[parts.length - 1]) : d.id;
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  const [listData, detailsData, movesRaw, itemsRaw, abilitiesRaw, patchRaw] = await Promise.all([
    fetch('./data/pokemon-list.json').then(r => r.json()),
    fetch('./data/pokemon-details.json').then(r => r.json()),
    fetch('./data/moves.json').then(r => r.json()).catch(() => ({})),
    fetch('./data/items.json').then(r => r.json()).catch(() => ({})),
    fetch('./data/abilities.json').then(r => r.json()).catch(() => ({})),
    fetch('./data/mega-abilities-patch.json').then(r => r.json()).catch(() => ({})),
  ]);

  allPokemon = listData;
  for (const [url, d] of Object.entries(detailsData)) detailCache.set(url, d);
  for (const [eng, es] of Object.entries(abilitiesRaw)) abilityNames.set(eng, es);

  // Load mega patch: custom ability names + per-pokemon ability lists
  const customNames = patchRaw._customNames || {};
  for (const [slug, names] of Object.entries(customNames)) abilityNames.set(slug, names.es);
  const { _customNames: _, ...pokemonPatch } = patchRaw;
  megaAbilityPatch = pokemonPatch;

  movesList = Object.entries(movesRaw).map(([slug, n]) => ({ slug, en: n.en||slug, es: n.es||n.en||slug }));
  itemsList = Object.entries(itemsRaw).map(([slug, n]) => ({ slug, en: n.en||slug, es: n.es||n.en||slug }));

  updateUI();
  renderSlots();
}

// ── I18N ──────────────────────────────────────────────────────
function updateUI() {
  const t = I18N[lang];
  document.getElementById('page-title').textContent = t.pageTitle;
  document.getElementById('back-link').textContent  = t.back;
  btnAnalyze.textContent     = t.analyze;
  pickerSearchEl.placeholder = t.searchPlaceholder;
  renderSlots();
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────
function acLabel(item) { return item[lang] || item.en; }

// Resolves a stored slug → display name in current lang; raw text passes through
function resolveValue(val, list) {
  if (!val) return '';
  const found = list.find(x => x.slug === val);
  return found ? acLabel(found) : val;
}

function attachAutocomplete(input, list, onSelect) {
  let dropdown = null;
  let activeIdx = -1;

  function close() {
    if (dropdown) { dropdown.remove(); dropdown = null; activeIdx = -1; }
  }

  function open(q) {
    close();
    if (!q) return;
    const ql = normalize(q);

    const matches = list
      .filter(x => {
        const en = normalize(x.en), es = normalize(x.es||'');
        return en.includes(ql) || es.includes(ql);
      })
      .sort((a, b) => {
        const al = acLabel(a).toLowerCase(), bl = acLabel(b).toLowerCase();
        return (al.startsWith(ql) ? 0 : 1) - (bl.startsWith(ql) ? 0 : 1)
            || al.localeCompare(bl);
      })
      .slice(0, 10);

    if (!matches.length) return;

    dropdown = document.createElement('ul');
    dropdown.className = 'ac-dropdown';

    matches.forEach(item => {
      const li = document.createElement('li');
      li.className = 'ac-option';
      const primary   = acLabel(item);
      const secondary = lang === 'en' ? item.es : item.en;
      li.innerHTML = `<span class="ac-primary">${primary}</span>`
        + (secondary && secondary !== primary
            ? `<span class="ac-secondary"> / ${secondary}</span>` : '');
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = acLabel(item);
        onSelect(item);
        close();
      });
      dropdown.appendChild(li);
    });

    // Render in body to escape overflow:hidden on the card
    const rect = input.getBoundingClientRect();
    dropdown.style.top   = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.left  = (rect.left   + window.scrollX) + 'px';
    dropdown.style.width = rect.width + 'px';
    document.body.appendChild(dropdown);
  }

  input.addEventListener('input',  e => open(e.target.value));
  input.addEventListener('focus',  e => { if (e.target.value) open(e.target.value); });
  input.addEventListener('blur',   () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    if (!dropdown) return;
    const opts = dropdown.querySelectorAll('.ac-option');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, opts.length - 1);
      opts.forEach((o, i) => o.classList.toggle('active', i === activeIdx));
      opts[activeIdx]?.scrollIntoView({block:'nearest'});
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      opts.forEach((o, i) => o.classList.toggle('active', i === activeIdx));
      opts[activeIdx]?.scrollIntoView({block:'nearest'});
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      input.value = opts[activeIdx].textContent;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      close();
    } else if (e.key === 'Escape') {
      close();
    }
  });
}

// ── RENDER SLOTS ──────────────────────────────────────────────
function renderSlots() {
  teamGrid.innerHTML = '';
  team.forEach((slot, i) => teamGrid.appendChild(slot.pokemon ? renderFilled(i) : renderEmpty(i)));
  btnAnalyze.disabled = !team.some(s => s.pokemon);
}

function renderEmpty(i) {
  const card = document.createElement('div');
  card.className = 'team-card empty';
  card.innerHTML = `
    <button class="add-slot-btn">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>${I18N[lang].addPokemon}</span>
    </button>`;
  card.addEventListener('click', () => openPicker(i));
  return card;
}

function renderFilled(i) {
  const t     = I18N[lang];
  const slot  = team[i];
  const d     = slot.pokemon;
  const types = d.types.map(x => x.type.name);
  const sprite = d.sprites?.other?.['official-artwork']?.front_default
              || d.sprites?.other?.home?.front_default
              || d.sprites?.front_default || '';
  const mainColor = TYPE_COLORS[types[0]] || '#555';

  const card = document.createElement('div');
  card.className = 'team-card filled';

  // Background glow
  const bg = document.createElement('div');
  bg.className = 'card-top-bg';
  bg.style.background = `radial-gradient(circle at 65% 15%, ${mainColor}44 0%, transparent 68%)`;
  card.appendChild(bg);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-slot-btn';
  removeBtn.title = t.remove;
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', e => { e.stopPropagation(); clearSlot(i); });
  card.appendChild(removeBtn);

  // Header (click to change)
  const header = document.createElement('div');
  header.className = 'slot-header';
  header.title = t.clickToChange;
  header.innerHTML = `
    ${sprite ? `<img src="${sprite}" alt="${d.name}" class="slot-img">` : ''}
    <div class="slot-info">
      <div class="slot-num">#${String(baseId(d)).padStart(4,'0')}</div>
      <div class="slot-name">${formatName(d.name)}</div>
      <div class="slot-types">${types.map(tp => `<span class="type-badge t-${tp}">${typeName(tp)}</span>`).join('')}</div>
    </div>`;
  header.addEventListener('click', () => openPicker(i));
  card.appendChild(header);

  // Inputs section
  const inputs = document.createElement('div');
  inputs.className = 'slot-inputs';

  // Ability select — fall back to mega patch for Champions megas
  const abilities = (d.abilities && d.abilities.length)
    ? d.abilities
    : (megaAbilityPatch[d.name] || []);
  if (abilities.length) {
    const abilityGroup = document.createElement('div');
    abilityGroup.className = 'input-group';
    abilityGroup.innerHTML = `<label>${t.ability}</label>`;
    const sel = document.createElement('select');
    sel.className = 'slot-ability';
    abilities.forEach(ab => {
      const opt = document.createElement('option');
      opt.value = ab.name;
      const display = lang === 'es'
        ? (abilityNames.get(ab.name) || formatName(ab.name))
        : formatName(ab.name);
      opt.textContent = ab.is_hidden ? `${display} (${t.hiddenAbility})` : display;
      opt.selected = slot.ability ? ab.name === slot.ability : ab.slot === 1;
      sel.appendChild(opt);
    });
    if (!slot.ability) team[i].ability = sel.value;
    sel.addEventListener('change', e => { team[i].ability = e.target.value; });
    abilityGroup.appendChild(sel);
    inputs.appendChild(abilityGroup);
  }

  // Item
  const itemGroup = document.createElement('div');
  itemGroup.className = 'input-group';
  itemGroup.innerHTML = `<label>${t.item}</label>`;
  const itemWrap = document.createElement('div');
  itemWrap.className = 'ac-wrap';
  const itemInput = document.createElement('input');
  itemInput.type = 'text';
  itemInput.className = 'slot-item';
  itemInput.placeholder = t.itemPlaceholder;
  itemInput.value = resolveValue(slot.item, itemsList) || slot.item;
  itemInput.addEventListener('input', e => { team[i].item = e.target.value; });
  itemWrap.appendChild(itemInput);
  itemGroup.appendChild(itemWrap);
  inputs.appendChild(itemGroup);
  if (itemsList.length) attachAutocomplete(itemInput, itemsList, item => { team[i].item = item.slug; });

  // Moves
  const movesGroup = document.createElement('div');
  movesGroup.className = 'input-group';
  movesGroup.innerHTML = `<label>${t.moves}</label>`;
  [0,1,2,3].forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap';
    const mv = document.createElement('input');
    mv.type = 'text';
    mv.className = 'slot-move';
    mv.placeholder = t.move(m + 1);
    mv.value = resolveValue(slot.moves[m], movesList) || slot.moves[m];
    mv.addEventListener('input', e => { team[i].moves[m] = e.target.value; });
    wrap.appendChild(mv);
    movesGroup.appendChild(wrap);
    if (movesList.length) attachAutocomplete(mv, movesList, item => { team[i].moves[m] = item.slug; });
  });
  inputs.appendChild(movesGroup);
  card.appendChild(inputs);

  return card;
}

function clearSlot(i) {
  team[i] = { pokemon:null, ability:'', item:'', moves:['','','',''] };
  renderSlots();
}

// ── PICKER ────────────────────────────────────────────────────
function openPicker(slotIndex) {
  pickerSlot = slotIndex;
  pickerSearchEl.value = '';
  renderPickerGrid('');
  pickerOverlay.classList.add('open');
  setTimeout(() => pickerSearchEl.focus(), 50);
}

function closePicker() {
  pickerOverlay.classList.remove('open');
  pickerSlot = -1;
}

function renderPickerGrid(search) {
  const q = normalize(search);
  const results = allPokemon.filter(p => !q || normalize(p.name).includes(q)).slice(0, 100);
  const frag = document.createDocumentFragment();

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = I18N[lang].noResults;
    frag.appendChild(empty);
  } else {
    for (const p of results) {
      const d = detailCache.get(p.url);
      const types = d?.types.map(x => x.type.name) || [];
      const el = document.createElement('div');
      el.className = 'picker-item';
      el.innerHTML = `
        <img src="${spriteUrl(p.id)}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">
        <div class="picker-item-num">#${String(p.id).padStart(4,'0')}</div>
        <div class="picker-item-name">${formatName(p.name)}</div>
        <div class="picker-item-types">${types.map(tp =>
          `<span class="type-badge t-${tp} sm">${typeName(tp)}</span>`).join('')}</div>`;
      el.addEventListener('click', () => {
        if (d) { team[pickerSlot].pokemon = d; renderSlots(); }
        closePicker();
      });
      frag.appendChild(el);
    }
  }
  pickerGridEl.innerHTML = '';
  pickerGridEl.appendChild(frag);
}

// ── ANALYZE ───────────────────────────────────────────────────
async function analyzeTeam() {
  const filled = team.filter(s => s.pokemon);
  if (!filled.length) return;

  const t = I18N[lang];
  analysisTitleEl.textContent = t.analysisTitle;
  analysisContent.innerHTML = `<div class="analysis-loading">${t.analyzing}</div>`;
  analysisOverlay.classList.add('open');

  const teamData = filled.map(s => ({
    name:             s.pokemon.name,
    types:            s.pokemon.types,
    stats:            s.pokemon.stats,
    selectedAbility:  s.ability,
    item:             s.item,
    moves:            s.moves,
  }));

  try {
    const resp = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: teamData, lang }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    analysisContent.innerHTML = data.analysis
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  } catch (e) {
    analysisContent.innerHTML = `<div class="analysis-loading" style="color:#ff6b6b">Error: ${e.message}</div>`;
  }
}

// ── EVENTS ────────────────────────────────────────────────────
btnAnalyze.addEventListener('click', analyzeTeam);
pickerCloseBtn.addEventListener('click', closePicker);
pickerOverlay.addEventListener('click', e => { if (e.target === pickerOverlay) closePicker(); });
pickerSearchEl.addEventListener('input', e => renderPickerGrid(e.target.value));
analysisCloseBtn.addEventListener('click', () => analysisOverlay.classList.remove('open'));
analysisOverlay.addEventListener('click', e => { if (e.target === analysisOverlay) analysisOverlay.classList.remove('open'); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePicker(); analysisOverlay.classList.remove('open'); }
});
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
    updateUI();
  });
});

init();
