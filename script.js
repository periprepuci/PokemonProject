'use strict';

// ── TYPE CHART (Gen 6+) ──────────────────────────────────────
const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, steel:0.5 },
  fire:     { fire:0.5, water:0.5, rock:0.5, dragon:0.5, grass:2, ice:2, bug:2, steel:2 },
  water:    { water:0.5, grass:0.5, dragon:0.5, fire:2, ground:2, rock:2 },
  electric: { electric:0.5, grass:0.5, ground:0, water:2, flying:2 },
  grass:    { fire:0.5, grass:0.5, poison:0.5, flying:0.5, bug:0.5, dragon:0.5, steel:0.5, water:2, ground:2, rock:2 },
  ice:      { fire:0.5, water:0.5, ice:0.5, steel:0.5, grass:2, ground:2, flying:2, dragon:2 },
  fighting: { poison:0.5, flying:0.5, psychic:0.5, bug:0.5, fairy:0.5, ghost:0, normal:2, ice:2, rock:2, dark:2, steel:2 },
  poison:   { poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0, grass:2, fairy:2 },
  ground:   { grass:0.5, bug:0.5, flying:0, fire:2, electric:2, poison:2, rock:2, steel:2 },
  flying:   { electric:0.5, rock:0.5, steel:0.5, grass:2, fighting:2, bug:2 },
  psychic:  { psychic:0.5, steel:0.5, dark:0, fighting:2, poison:2 },
  bug:      { fire:0.5, fighting:0.5, flying:0.5, ghost:0.5, steel:0.5, fairy:0.5, grass:2, psychic:2, dark:2 },
  rock:     { fighting:0.5, ground:0.5, steel:0.5, fire:2, ice:2, flying:2, bug:2 },
  ghost:    { dark:0.5, normal:0, ghost:2, psychic:2 },
  dragon:   { steel:0.5, fairy:0, dragon:2 },
  dark:     { fighting:0.5, dark:0.5, fairy:0.5, ghost:2, psychic:2 },
  steel:    { fire:0.5, water:0.5, electric:0.5, steel:0.5, ice:2, rock:2, fairy:2 },
  fairy:    { fire:0.5, poison:0.5, steel:0.5, fighting:2, dragon:2, dark:2 },
};

const ALL_TYPES = [
  'normal','fire','water','electric','grass','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy',
];

const TYPE_COLORS = {
  normal:'#9199a1', fire:'#ff6f30',   water:'#4e8eff',  electric:'#f5c518',
  grass:'#3bc86a',  ice:'#74cec0',    fighting:'#ce4069',poison:'#a95fc6',
  ground:'#d67c32', flying:'#89aae3', psychic:'#f35282', bug:'#90c12c',
  rock:'#c5b78c',   ghost:'#5269ac',  dragon:'#0b6dc3',  dark:'#595761',
  steel:'#5a8ea1',  fairy:'#ec8fe6',  unknown:'#68a090', shadow:'#4e3a78',
};

const STAT_META = [
  { key:'hp',              label:'PS',  fullLabel:'PS (HP)',       },
  { key:'attack',          label:'ATK', fullLabel:'Ataque',        },
  { key:'defense',         label:'DEF', fullLabel:'Defensa',       },
  { key:'special-attack',  label:'SpA', fullLabel:'Atq. Especial', },
  { key:'special-defense', label:'SpD', fullLabel:'Def. Especial', },
  { key:'speed',           label:'VEL', fullLabel:'Velocidad',     },
];

const MAX_STAT = 255;


const GEN_RANGES = {
  '1':[1,151], '2':[152,251], '3':[252,386], '4':[387,493],
  '5':[494,649],'6':[650,721],'7':[722,809], '8':[810,905], '9':[906,1025],
};

// ── DATA PATHS ────────────────────────────────────────────────
const DATA = {
  list:    './data/pokemon-list.json',
  details: './data/pokemon-details.json',
  species: './data/species.json',
  types:   './data/types.json',
};

// ── STATE ─────────────────────────────────────────────────────
let allPokemon    = [];
let filtered      = [];
let page          = 0;
let isLoading     = false;
let detailCache   = new Map();
let speciesCache  = new Map();
let typeMap       = new Map();
let typeFilterVal = '';
let genFilterVal  = '';
let searchVal     = '';
let statSortVal   = '';

// ── DOM REFS ──────────────────────────────────────────────────
const grid         = document.getElementById('grid');
const emptyEl      = document.getElementById('empty');
const statusBar    = document.getElementById('status-bar');
const loader       = document.getElementById('loader');
const searchEl     = document.getElementById('search');
const typeSelect   = document.getElementById('type-filter');
const genSelect    = document.getElementById('gen-filter');
const statSortEl   = document.getElementById('stat-sort');
const modalOverlay = document.getElementById('modal-overlay');
const modalBox     = document.getElementById('modal-box');
const modalClose   = document.getElementById('modal-close');

function trimPokemon(d) {
  const sprites = d.sprites || {};
  const other   = sprites.other || {};
  return {
    id:    d.id,
    name:  d.name,
    types: d.types,
    stats: d.stats,
    species: d.species ? { url: d.species.url } : null,
    sprites: {
      front_default: sprites.front_default ?? null,
      other: {
        'official-artwork': { front_default: other['official-artwork']?.front_default ?? null },
        home:               { front_default: other.home?.front_default ?? null },
      },
    },
  };
}

// ── FETCH ─────────────────────────────────────────────────────
async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(tid);
  }
}

async function getPokemonDetail(url) {
  if (detailCache.has(url)) return detailCache.get(url);
  // Fallback a API para entradas no incluidas en los datos locales
  const data    = await fetchJSON(url);
  const trimmed = trimPokemon(data);
  detailCache.set(url, trimmed);
  return trimmed;
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  statusBar.textContent = 'Cargando datos locales...';
  try {
    const [listData, detailsData, speciesData, typesData] = await Promise.all([
      fetchJSON(DATA.list),
      fetchJSON(DATA.details),
      fetchJSON(DATA.species),
      fetchJSON(DATA.types),
    ]);

    allPokemon = listData;

    // Pre-popular caches desde los JSON locales
    for (const [url, detail] of Object.entries(detailsData))
      detailCache.set(url, detail);
    for (const [url, sp] of Object.entries(speciesData))
      speciesCache.set(url, sp);

    // Construir typeMap desde los detalles ya cargados (sin llamadas extra a la API)
    for (const detail of detailCache.values()) {
      for (const t of detail.types) {
        const n = t.type.name;
        if (!typeMap.has(n)) typeMap.set(n, new Set());
        typeMap.get(n).add(detail.name);
      }
    }

    // Dropdown de tipos
    [...typesData.map(t => t.name)].sort().forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = capitalize(name);
      typeSelect.appendChild(opt);
    });

    statusBar.textContent = `${allPokemon.length.toLocaleString()} Pokémon · Haz clic en cualquiera para ver detalles`;
    applyFilters();
  } catch (e) {
    statusBar.textContent = `Error cargando datos locales: ${e.message}`;
    console.error(e);
  }
}

// ── STAT SORT HELPER ──────────────────────────────────────────
function getStatVal(d, key) {
  if (!d) return 0;
  if (key === 'total') return d.stats.reduce((s, x) => s + x.base_stat, 0);
  return d.stats.find(s => s.stat.name === key)?.base_stat ?? 0;
}

// ── FILTERING ─────────────────────────────────────────────────
function applyFilters() {
  const q = searchVal.toLowerCase().trim();
  filtered = allPokemon.filter(p => {
    if (q && !p.name.includes(q)) return false;
    if (genFilterVal) {
      const [lo, hi] = GEN_RANGES[genFilterVal];
      if (p.id < lo || p.id > hi) return false;
    }
    if (typeFilterVal && typeMap.has(typeFilterVal) && !typeMap.get(typeFilterVal).has(p.name)) return false;
    return true;
  });

  if (statSortVal) {
    filtered.sort((a, b) =>
      getStatVal(detailCache.get(b.url), statSortVal) -
      getStatVal(detailCache.get(a.url), statSortVal)
    );
  }

  page = 0;
  grid.innerHTML = '';
  emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
  statusBar.textContent = `${filtered.length.toLocaleString()} Pokémon encontrados`;
  loadNextPage();
}

// ── PAGINATION ────────────────────────────────────────────────
const PAGE_SIZE = 40;

async function loadNextPage() {
  if (isLoading) return;
  const start = page * PAGE_SIZE;
  if (start >= filtered.length) { loader.style.display = 'none'; return; }

  isLoading = true;
  loader.style.display = 'block';

  const slice = filtered.slice(start, start + PAGE_SIZE);
  page++;

  // Insert all skeletons in one DocumentFragment (single reflow)
  const frag = document.createDocumentFragment();
  const entries = slice.map(pokemon => {
    const el = createSkeleton(pokemon);
    frag.appendChild(el);
    return { el, pokemon };
  });
  grid.appendChild(frag);

  try {
    // Fetch details in parallel batches
    const BATCH = 10;
    for (let i = 0; i < entries.length; i += BATCH) {
      await Promise.all(entries.slice(i, i + BATCH).map(async ({ el, pokemon }) => {
        try {
          const detail = await getPokemonDetail(pokemon.url);
          const card   = buildCard(detail);
          el.replaceWith(card);
          requestAnimationFrame(() => {
            card.querySelectorAll('.stat-bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; });
          });
        } catch { el.remove(); }
      }));
    }
  } finally {
    // Guaranteed reset — even si algo falla o se aborta un fetch
    isLoading = false;
    loader.style.display = filtered.length > page * PAGE_SIZE ? 'block' : 'none';
  }
}

// ── CARD BUILDER ──────────────────────────────────────────────
function buildCard(d) {
  const types  = d.types.map(t => t.type.name);
  const sprite = d.sprites?.other?.['official-artwork']?.front_default
              || d.sprites?.other?.home?.front_default
              || d.sprites?.front_default
              || null;
  const statsMap = {};
  for (const s of d.stats) statsMap[s.stat.name] = s.base_stat;

  const card = document.createElement('div');
  card.className = 'card';

  const mainColor = TYPE_COLORS[types[0]] || '#555';

  const bg = document.createElement('div');
  bg.className = 'card-bg';
  bg.style.background = `radial-gradient(circle at 70% 20%, ${mainColor} 0%, transparent 65%)`;
  card.appendChild(bg);

  const num = document.createElement('div');
  num.className = 'card-num';
  num.textContent = `#${String(d.id).padStart(4, '0')}`;
  card.appendChild(num);

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';
  if (sprite) {
    const img = document.createElement('img');
    img.src = sprite;
    img.alt = d.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    imgWrap.appendChild(img);
  }
  card.appendChild(imgWrap);

  const nameEl = document.createElement('div');
  nameEl.className = 'card-name';
  nameEl.textContent = formatName(d.name);
  card.appendChild(nameEl);

  const typesEl = document.createElement('div');
  typesEl.className = 'types';
  for (const t of types) {
    const b = document.createElement('span');
    b.className = `type-badge t-${t}`;
    b.textContent = capitalize(t);
    typesEl.appendChild(b);
  }
  card.appendChild(typesEl);

  const statsEl = document.createElement('div');
  statsEl.className = 'stats';
  for (const { key, label } of STAT_META) {
    const val = statsMap[key] ?? 0;
    const pct = Math.min(100, (val / MAX_STAT) * 100).toFixed(1);
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div class="stat-label">${label}</div>
      <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:0%;background:${statBarColor(val)}" data-pct="${pct}"></div></div>
      <div class="stat-val" style="color:${statColor(val)}">${val}</div>`;
    statsEl.appendChild(row);
  }
  card.appendChild(statsEl);

  card.addEventListener('click', () => openModal(d));
  return card;
}

function spriteFromId(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
function shinySpriteFromId(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`;
}

function createSkeleton(pokemon) {
  const sk = document.createElement('div');
  sk.className = 'skeleton';
  const hasData = pokemon?.id != null;
  sk.innerHTML = `
    <div class="card-num" style="align-self:flex-start;font-size:11px;color:var(--text2);font-weight:600">
      ${hasData ? '#' + String(pokemon.id).padStart(4, '0') : ''}
    </div>
    <div class="card-img-wrap">
      ${hasData
        ? `<img src="${spriteFromId(pokemon.id)}" alt="${pokemon.name}" loading="lazy" decoding="async"
               style="max-width:100%;max-height:100%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))"
               onerror="this.style.display='none'">`
        : `<div class="sk-block" style="width:90px;height:90px;border-radius:50%"></div>`}
    </div>
    ${hasData
      ? `<div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:8px;word-break:break-word;text-transform:capitalize">
           ${formatName(pokemon.name)}
         </div>`
      : `<div class="sk-block" style="width:80%;height:14px"></div>`}
    <div style="display:flex;gap:6px">
      <div class="sk-block" style="width:55px;height:20px;border-radius:20px"></div>
    </div>
    ${STAT_META.map(() => `<div class="sk-block" style="width:100%;height:5px;border-radius:3px"></div>`).join('')}`;
  return sk;
}

// ── STAT COLORS ───────────────────────────────────────────────
function statHue(val) {
  if (val <= 150) return (val / 150) * 120;
  if (val <= 190) return 120 + ((val - 150) / 40) * 40;
  return 160 + Math.min((val - 190) / 65, 1) * 25;
}

function statBarColor(val) {
  const hue = statHue(val);
  return `linear-gradient(90deg, hsl(${Math.max(0, hue - 14)},85%,40%), hsl(${hue},82%,55%))`;
}

function statColor(val) {
  const hue = statHue(val);
  return `hsl(${hue}, 75%, 62%)`;
}

// ── TYPE EFFECTIVENESS ────────────────────────────────────────
function calculateDefensive(defTypes) {
  const result = { 4:[], 2:[], 1:[], 0.5:[], 0.25:[], 0:[] };
  for (const atkType of ALL_TYPES) {
    let mult = 1;
    for (const defType of defTypes) mult *= TYPE_CHART[atkType]?.[defType] ?? 1;
    if      (mult < 0.01) result[0].push(atkType);
    else if (mult < 0.4)  result[0.25].push(atkType);
    else if (mult < 0.8)  result[0.5].push(atkType);
    else if (mult < 1.5)  result[1].push(atkType);
    else if (mult < 3)    result[2].push(atkType);
    else                  result[4].push(atkType);
  }
  return result;
}

function calculateOffensive(atkTypes) {
  const result = { 2:[], 1:[], 0.5:[], 0:[] };
  for (const defType of ALL_TYPES) {
    let best = -Infinity;
    for (const atkType of atkTypes) {
      const mult = TYPE_CHART[atkType]?.[defType] ?? 1;
      if (mult > best) best = mult;
    }
    if      (best < 0.01) result[0].push(defType);
    else if (best < 0.8)  result[0.5].push(defType);
    else if (best < 1.5)  result[1].push(defType);
    else                  result[2].push(defType);
  }
  return result;
}

// ── MODAL HTML BUILDERS ───────────────────────────────────────
function effRowHTML(label, cls, title, types) {
  const badges = types.length === 0
    ? '<span class="eff-none">—</span>'
    : types.map(t => `<span class="eff-badge t-${t}">${capitalize(t)}</span>`).join('');
  return `<div class="eff-group">
    <div class="eff-mult ${cls}" title="${title}">${label}</div>
    <div class="eff-badges">${badges}</div>
  </div>`;
}

function buildDefHTML(eff) {
  return [
    { key:4,    label:'×4', cls:'mult-4',    title:'Muy débil'      },
    { key:2,    label:'×2', cls:'mult-2',    title:'Débil'          },
    { key:1,    label:'×1', cls:'mult-1',    title:'Normal'         },
    { key:0.5,  label:'×½', cls:'mult-half', title:'Resistente'     },
    { key:0.25, label:'×¼', cls:'mult-qtr',  title:'Muy resistente' },
    { key:0,    label:'×0', cls:'mult-0',    title:'Inmune'         },
  ].map(g => effRowHTML(g.label, g.cls, g.title, eff[g.key] || [])).join('');
}


function buildOffHTML(eff) {
  return [
    { key:2,   label:'×2', cls:'mult-2',    title:'Super efectivo' },
    { key:1,   label:'×1', cls:'mult-1',    title:'Normal'         },
    { key:0.5, label:'×½', cls:'mult-half', title:'Poco efectivo'  },
    { key:0,   label:'×0', cls:'mult-0',    title:'Sin efecto'     },
  ].map(g => effRowHTML(g.label, g.cls, g.title, eff[g.key] || [])).join('');
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(d) {
  // Reset form selector while species loads
  const formsEl = document.getElementById('modal-forms');
  formsEl.innerHTML = '';
  formsEl.style.display = 'none';

  updateModalContent(d);

  modalBox.scrollTop = 0;
  modalBox.style.willChange = 'transform';
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Load alternate forms in background
  loadFormsForModal(d);
}

function updateModalContent(d) {
  const types     = d.types.map(t => t.type.name);
  const sprite    = d.sprites?.other?.['official-artwork']?.front_default
                 || d.sprites?.other?.home?.front_default
                 || d.sprites?.front_default || '';
  const mainColor = TYPE_COLORS[types[0]] || '#555';

  document.getElementById('modal-hero-bg').style.background =
    `radial-gradient(ellipse at 50% 0%, ${mainColor} 0%, transparent 70%)`;

  const img      = document.getElementById('modal-img');
  const shinyBtn = document.getElementById('modal-shiny-btn');

  // Reset shiny toggle whenever we load a new Pokemon or form
  shinyBtn.classList.remove('active');
  img.classList.remove('shiny');
  shinyBtn.dataset.normal = sprite;
  shinyBtn.dataset.shiny  = shinySpriteFromId(d.id);

  if (sprite) {
    img.style.opacity = '0';
    img.onload = () => { img.style.opacity = '1'; };
    img.src    = sprite;
    img.alt    = d.name;
    img.style.display = '';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('modal-num').textContent  = `#${String(d.id).padStart(4, '0')}`;
  document.getElementById('modal-name').textContent = formatName(d.name);
  document.getElementById('modal-types').innerHTML  =
    types.map(t => `<span class="type-badge t-${t}">${capitalize(t)}</span>`).join('');

  // Stats
  const statsMap = {};
  let total = 0;
  for (const s of d.stats) statsMap[s.stat.name] = s.base_stat;
  for (const { key } of STAT_META) total += statsMap[key] ?? 0;

  document.getElementById('modal-stats').innerHTML = STAT_META.map(({ key, fullLabel }) => {
    const val = statsMap[key] ?? 0;
    const pct = Math.min(100, (val / MAX_STAT) * 100).toFixed(1);
    return `<div class="modal-stat-row">
      <div class="modal-stat-label">${fullLabel}</div>
      <div class="modal-stat-bar-bg">
        <div class="modal-stat-bar-fill" style="width:0%;background:${statBarColor(val)}" data-pct="${pct}"></div>
      </div>
      <div class="modal-stat-val" style="color:${statColor(val)}">${val}</div>
    </div>`;
  }).join('');

  document.getElementById('modal-total').textContent = total;

  document.getElementById('modal-effectiveness').innerHTML = buildDefHTML(calculateDefensive(types));
  document.getElementById('modal-offensive').innerHTML     = buildOffHTML(calculateOffensive(types));

  requestAnimationFrame(() => {
    document.getElementById('modal-stats')
      .querySelectorAll('.modal-stat-bar-fill')
      .forEach(b => { b.style.width = b.dataset.pct + '%'; });
  });
}

async function loadFormsForModal(d) {
  // Build species URL: use stored one, or derive from name for base species
  const speciesUrl = d.species?.url
    || `https://pokeapi.co/api/v2/pokemon-species/${d.name}/`;
  try {
    const species   = await getCachedSpecies(speciesUrl);
    const varieties = species.varieties;
    if (varieties.length <= 1) return;

    const formsEl = document.getElementById('modal-forms');
    formsEl.innerHTML = varieties.map(v =>
      `<button class="form-btn ${v.pokemon.name === d.name ? 'active' : ''}"
               data-url="${v.pokemon.url}">
         ${formLabel(species.name, v.pokemon.name)}
       </button>`
    ).join('');
    formsEl.style.display = 'flex';

    formsEl.querySelectorAll('.form-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.classList.contains('active')) return;
        formsEl.querySelectorAll('.form-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const formData = await getPokemonDetail(btn.dataset.url);
        updateModalContent(formData);
      });
    });

    // Pre-fetch data + preload images for all other forms in background
    varieties
      .filter(v => v.pokemon.name !== d.name)
      .forEach(async (v) => {
        try {
          const fd     = await getPokemonDetail(v.pokemon.url);
          const sprite = fd.sprites?.other?.['official-artwork']?.front_default
                      || fd.sprites?.other?.home?.front_default
                      || fd.sprites?.front_default;
          if (sprite) new Image().src = sprite;
        } catch {}
      });
  } catch {}
}

async function getCachedSpecies(url) {
  if (speciesCache.has(url)) return speciesCache.get(url);
  const data    = await fetchJSON(url);
  const trimmed = { name: data.name, varieties: data.varieties };
  speciesCache.set(url, trimmed);
  return trimmed;
}

function formLabel(baseName, formName) {
  if (formName === baseName) return 'Normal';
  const stripped = formName.startsWith(baseName + '-')
    ? formName.slice(baseName.length + 1)
    : formName;
  return stripped.split('-').map(capitalize).join(' ');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { modalBox.style.willChange = ''; }, 220);
}

// ── MODAL EVENTS ──────────────────────────────────────────────
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });


document.getElementById('modal-shiny-btn').addEventListener('click', () => {
  const btn    = document.getElementById('modal-shiny-btn');
  const img    = document.getElementById('modal-img');
  const isShiny = btn.classList.toggle('active');
  img.classList.toggle('shiny', isShiny);
  const newSrc = isShiny ? btn.dataset.shiny : btn.dataset.normal;
  img.style.opacity = '0';
  img.onload  = () => { img.style.opacity = '1'; };
  img.onerror = () => { img.style.opacity = '1'; btn.classList.remove('active'); img.classList.remove('shiny'); };
  img.src = newSrc;
});

// ── LOGO RESET ────────────────────────────────────────────────
document.getElementById('logo').addEventListener('click', () => {
  searchEl.value    = '';
  typeSelect.value  = '';
  genSelect.value   = '';
  statSortEl.value  = '';
  searchVal         = '';
  typeFilterVal     = '';
  genFilterVal      = '';
  statSortVal       = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  applyFilters();
});

// ── FILTER EVENTS ─────────────────────────────────────────────
let searchTimeout;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchVal = searchEl.value;
  searchTimeout = setTimeout(applyFilters, 300);
});
typeSelect.addEventListener('change',  () => { typeFilterVal = typeSelect.value;  applyFilters(); });
genSelect.addEventListener('change',   () => { genFilterVal  = genSelect.value;   applyFilters(); });
statSortEl.addEventListener('change',  () => { statSortVal   = statSortEl.value;  applyFilters(); });

// ── INFINITE SCROLL ───────────────────────────────────────────
const observer = new IntersectionObserver(
  entries => { if (entries[0].isIntersecting && !isLoading) loadNextPage(); },
  { rootMargin: '400px' }
);
observer.observe(document.getElementById('sentinel'));

// ── HELPERS ───────────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatName(n) { return n.split('-').map(capitalize).join(' '); }

// ── START ─────────────────────────────────────────────────────
init();
