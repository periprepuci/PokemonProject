'use strict';

const ALL_TYPES = [
  'normal','fire','water','electric','grass','ice',
  'fighting','poison','ground','flying','psychic','bug',
  'rock','ghost','dragon','dark','steel','fairy',
];

// attacking type → { defending type: multiplier }
const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, steel:0.5 },
  fire:     { grass:2, ice:2, bug:2, steel:2, fire:0.5, water:0.5, rock:0.5, dragon:0.5 },
  water:    { fire:2, ground:2, rock:2, water:0.5, grass:0.5, dragon:0.5 },
  electric: { water:2, flying:2, electric:0.5, grass:0.5, dragon:0.5, ground:0 },
  grass:    { water:2, ground:2, rock:2, fire:0.5, grass:0.5, poison:0.5, flying:0.5, bug:0.5, dragon:0.5, steel:0.5 },
  ice:      { grass:2, ground:2, flying:2, dragon:2, water:0.5, ice:0.5, steel:0.5 },
  fighting: { normal:2, ice:2, rock:2, dark:2, steel:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, fairy:0.5, ghost:0 },
  poison:   { grass:2, fairy:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0 },
  ground:   { fire:2, electric:2, poison:2, rock:2, steel:2, grass:0.5, bug:0.5, flying:0 },
  flying:   { grass:2, fighting:2, bug:2, electric:0.5, rock:0.5, steel:0.5 },
  psychic:  { fighting:2, poison:2, psychic:0.5, steel:0.5, dark:0 },
  bug:      { grass:2, psychic:2, dark:2, fire:0.5, fighting:0.5, flying:0.5, ghost:0.5, steel:0.5, fairy:0.5 },
  rock:     { fire:2, ice:2, flying:2, bug:2, fighting:0.5, ground:0.5, steel:0.5 },
  ghost:    { psychic:2, ghost:2, dark:0.5, normal:0 },
  dragon:   { dragon:2, steel:0.5, fairy:0 },
  dark:     { psychic:2, ghost:2, fighting:0.5, dark:0.5, fairy:0.5 },
  steel:    { ice:2, rock:2, fairy:2, fire:0.5, water:0.5, electric:0.5, steel:0.5 },
  fairy:    { fighting:2, dragon:2, dark:2, fire:0.5, poison:0.5, steel:0.5 },
};

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
    pageTitle:'Defensive Coverage', back:'← Pokédex', team:'⚔ Team',
    atk:'Atk ↓', totalWeak:'Total Weak', totalRes:'Total Resist',
    searchPlaceholder:'Search Pokémon…', noResults:'No Pokémon found',
    immune:'Immune', addHint:'Click + to add Pokémon',
  },
  es: {
    pageTitle:'Cobertura Defensiva', back:'← Pokédex', team:'⚔ Team',
    atk:'Ataq. ↓', totalWeak:'Total Debil.', totalRes:'Total Resist.',
    searchPlaceholder:'Buscar Pokémon…', noResults:'No se encontraron Pokémon',
    immune:'Inmune', addHint:'Pulsa + para añadir Pokémon',
  },
};

// ── STATE ──────────────────────────────────────────────────────────────────────
let lang        = localStorage.getItem('lang') || 'en';
let allPokemon  = [];
let detailCache = new Map();
let team        = Array(6).fill(null);
let pickerSlot  = -1;

// ── HELPERS ────────────────────────────────────────────────────────────────────
const normalize  = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const formatName = n => n.split('-').map(capitalize).join(' ');
const typeName   = t => lang === 'es' ? (TYPE_NAMES_ES[t] || capitalize(t)) : capitalize(t);

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
function baseId(d) {
  if (!d || d.id <= 1025) return d?.id ?? 0;
  const parts = (d.species?.url || '').split('/').filter(Boolean);
  return parts.length ? parseInt(parts[parts.length - 1]) : d.id;
}
function getTypes(d) {
  return d.types.map(t => t.type.name);
}
function effectiveness(atkType, defTypes) {
  let m = 1;
  for (const dt of defTypes) m *= (TYPE_CHART[atkType]?.[dt] ?? 1);
  return m;
}

// ── INIT ───────────────────────────────────────────────────────────────────────
async function init() {
  const [listData, detailsData] = await Promise.all([
    fetch('./data/pokemon-list.json').then(r => r.json()),
    fetch('./data/pokemon-details.json').then(r => r.json()),
  ]);
  allPokemon = listData;
  for (const [url, d] of Object.entries(detailsData)) detailCache.set(url, d);
  setupEvents();
  updateUI();
  render();
}

// ── LANG ───────────────────────────────────────────────────────────────────────
function updateUI() {
  const t = I18N[lang];
  document.getElementById('page-title').textContent = t.pageTitle;
  document.getElementById('back-link').textContent  = t.back;
  document.getElementById('team-link').textContent  = t.team;
  document.getElementById('picker-search').placeholder = t.searchPlaceholder;
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────────────
function render() {
  const t = I18N[lang];
  const table = document.getElementById('coverage-table');
  const filled = team.map((d, i) => ({ d, i })).filter(x => x.d);
  const hasRoom = filled.length < 6;

  // ── HEADER ROW ──
  let html = '<thead><tr>';
  html += `<th class="type-col-hdr">${t.atk}</th>`;

  for (const { d, i } of filled) {
    const id    = baseId(d);
    const types = getTypes(d);
    html += `<th class="pokemon-col">
      <div class="pc-inner">
        <button class="pc-remove" data-slot="${i}" title="Remove">✕</button>
        <img src="${spriteUrl(id)}" alt="${formatName(d.name)}" loading="lazy">
        <div class="pc-num">#${String(d.id).padStart(4,'0')}</div>
        <div class="pc-name">${formatName(d.name)}</div>
        <div class="pc-types">${types.map(tp =>
          `<span class="type-badge sm" style="background:${TYPE_COLORS[tp]}">${typeName(tp)}</span>`
        ).join('')}</div>
      </div>
    </th>`;
  }

  if (hasRoom) {
    html += `<th class="pokemon-col add-col">
      <button class="add-poke-btn" id="add-poke-btn">+</button>
    </th>`;
  }

  html += `<th class="total-col">${t.totalWeak}</th>`;
  html += `<th class="total-col">${t.totalRes}</th>`;
  html += '</tr></thead>';

  // ── BODY ROWS ──
  if (filled.length === 0) {
    const span = 3 + (hasRoom ? 1 : 0);
    html += `<tbody><tr><td colspan="${span}" class="cov-hint">${t.addHint}</td></tr></tbody>`;
    table.innerHTML = html;
    bindTableEvents();
    return;
  }

  html += '<tbody>';
  for (const atkType of ALL_TYPES) {
    const effs = filled.map(({ d }) => effectiveness(atkType, getTypes(d)));
    const weakCount = effs.filter(e => e >= 2).length;
    const resCount  = effs.filter(e => e > 0 && e <= 0.5).length + effs.filter(e => e === 0).length;

    const color = TYPE_COLORS[atkType];
    const label = lang === 'es' ? (TYPE_NAMES_ES[atkType] || capitalize(atkType)) : capitalize(atkType);

    html += '<tr>';
    html += `<td class="type-label-td">
      <span class="type-badge" style="background:${color};font-size:10px;padding:3px 8px">${label}</span>
    </td>`;

    for (const eff of effs) {
      let cls = 'eff-cell', txt = '';
      if      (eff === 0)    { cls += ' eff-immune';  txt = t.immune; }
      else if (eff <= 0.25)  { cls += ' eff-quarter'; txt = '¼'; }
      else if (eff < 1)      { cls += ' eff-half';    txt = '½'; }
      else if (eff === 4)    { cls += ' eff-4x';      txt = '4×'; }
      else if (eff >= 2)     { cls += ' eff-2x';      txt = '2×'; }
      html += `<td class="${cls}">${txt}</td>`;
    }

    if (hasRoom) html += '<td class="eff-cell"></td>';

    const wCls = weakCount === 0 ? '' : weakCount === 1 ? 'w1' : weakCount === 2 ? 'w2' : 'w3';
    const rCls = resCount  === 0 ? '' : resCount  === 1 ? 'r1' : resCount  === 2 ? 'r2' : 'r3';
    html += `<td class="total-cell weak-num ${wCls}">${weakCount || ''}</td>`;
    html += `<td class="total-cell res-num  ${rCls}">${resCount  || ''}</td>`;
    html += '</tr>';
  }

  html += '</tbody>';
  table.innerHTML = html;
  bindTableEvents();
}

function bindTableEvents() {
  document.querySelectorAll('.pc-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      team[parseInt(btn.dataset.slot)] = null;
      render();
    });
  });
  const addBtn = document.getElementById('add-poke-btn');
  if (addBtn) addBtn.addEventListener('click', () => openPicker(team.findIndex(x => !x)));
}

// ── PICKER ─────────────────────────────────────────────────────────────────────
function openPicker(slot) {
  pickerSlot = slot;
  document.getElementById('picker-overlay').classList.add('open');
  const inp = document.getElementById('picker-search');
  inp.value = '';
  inp.focus();
  renderPickerGrid('');
}
function closePicker() {
  document.getElementById('picker-overlay').classList.remove('open');
  pickerSlot = -1;
}
function renderPickerGrid(search) {
  const grid = document.getElementById('picker-grid');
  const t    = I18N[lang];
  const norm = normalize(search);
  const results = norm
    ? allPokemon.filter(p => normalize(p.name).includes(norm)).slice(0, 100)
    : allPokemon.slice(0, 100);

  if (!results.length) {
    grid.innerHTML = `<div class="picker-empty">${t.noResults}</div>`;
    return;
  }

  grid.innerHTML = results.map(p => {
    const d = detailCache.get(p.url);
    if (!d) return '';
    const id    = baseId(d);
    const types = getTypes(d);
    return `<div class="picker-item" data-url="${p.url}">
      <img src="${spriteUrl(id)}" loading="lazy">
      <div class="picker-item-num">#${String(d.id).padStart(4,'0')}</div>
      <div class="picker-item-name">${formatName(d.name)}</div>
      <div class="picker-item-types">${types.map(tp =>
        `<span class="type-badge sm" style="background:${TYPE_COLORS[tp]}">${typeName(tp)}</span>`
      ).join('')}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', () => {
      const d = detailCache.get(el.dataset.url);
      if (d && pickerSlot >= 0) {
        team[pickerSlot] = d;
        closePicker();
        render();
      }
    });
  });
}

// ── EVENTS ─────────────────────────────────────────────────────────────────────
function setupEvents() {
  document.getElementById('picker-close').addEventListener('click', closePicker);
  document.getElementById('picker-overlay').addEventListener('click', e => {
    if (e.target.id === 'picker-overlay') closePicker();
  });
  document.getElementById('picker-search').addEventListener('input', e => {
    renderPickerGrid(e.target.value);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      lang = btn.dataset.lang;
      localStorage.setItem('lang', lang);
      updateUI();
      render();
    });
  });
}

init();
