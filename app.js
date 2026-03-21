/* ═══════════════════════════════════════════════════════════════
   CRYSTAL SAGE — app.js
   All runtime logic: search, filter, grid, modal, notes, starfield
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────────────
const STATE = {
  query:      '',
  filters:    {},   // { dimension: Set<value> }
  mohsMin:    1,
  mohsMax:    10,
  viewMode:   'grid',
  filtered:   [],
  openId:     null,
  activeTab:  'identity',
  notes:      {}
};

// ── Synonym Map ───────────────────────────────────────────────
const SYNONYMS = {
  wealth:       ['abundance', 'prosperity', 'money', 'citrine', 'pyrite'],
  rich:         ['abundance', 'prosperity'],
  money:        ['abundance', 'prosperity', 'citrine'],
  anxiety:      ['calm', 'calming', 'stress', 'soothe', 'peace', 'peace of mind'],
  stress:       ['calm', 'calming', 'anxiety', 'relief'],
  sleep:        ['dream', 'rest', 'insomnia', 'moonstone', 'howlite'],
  insomnia:     ['sleep', 'rest', 'dream', 'calming'],
  love:         ['heart', 'romance', 'relationship', 'rose quartz'],
  romance:      ['love', 'heart', 'relationship'],
  protection:   ['shield', 'ward', 'guard', 'black tourmaline', 'obsidian'],
  shield:       ['protection', 'guard'],
  intuition:    ['psychic', 'third eye', 'vision', 'amethyst'],
  psychic:      ['intuition', 'third eye', 'clairvoyant'],
  grounding:    ['earth', 'root', 'stabilize', 'hematite', 'smoky quartz', 'anchor'],
  ground:       ['grounding', 'root', 'earth', 'stabilize'],
  creativity:   ['create', 'inspire', 'sacral', 'carnelian', 'creative'],
  creative:     ['creativity', 'sacral', 'carnelian'],
  healing:      ['health', 'wellness', 'recovery', 'cure'],
  clarity:      ['focus', 'clear', 'mental clarity', 'thought'],
  focus:        ['clarity', 'concentration', 'mental clarity'],
  transformation: ['change', 'transform', 'shift', 'growth'],
  dream:        ['sleep', 'lucid', 'vision', 'subconscious'],
  communication: ['speak', 'voice', 'throat', 'expression'],
  courage:      ['brave', 'confidence', 'strength', 'bold'],
  spiritual:    ['spirit', 'soul', 'higher self', 'divine'],
  emf:          ['electromagnetic', 'radiation', 'electronics', 'wifi'],
  grief:        ['loss', 'sadness', 'mourning', 'heartbreak'],
  anger:        ['rage', 'frustration', 'irritation'],
  meditation:   ['meditate', 'mindfulness', 'stillness', 'presence'],
  third eye:    ['intuition', 'psychic', 'clairvoyant', 'perception'],
  crown:        ['divine', 'higher self', 'spiritual', 'enlightenment'],
  root:         ['grounding', 'stability', 'safety', 'security']
};

// ── Notes Persistence ─────────────────────────────────────────
const NOTES_KEY = 'crystal-sage-notes-v1';

function loadNotes() {
  try { STATE.notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }
  catch { STATE.notes = {}; }
}

function saveNote(id, text) {
  STATE.notes[id] = text;
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(STATE.notes)); }
  catch { /* storage full — silent fail, persists for session */ }
}

// ── Search Index ──────────────────────────────────────────────
function buildSearchBlob(c) {
  const parts = [
    c.name,
    ...(c.alt_names || []),
    c.mineral_family,
    c.chemical_formula,
    c.crystal_system,
    c.short_intention,
    c.intention,
    ...(c.chakras || []),
    c.element,
    c.planet,
    c.day_of_week,
    ...(c.zodiac || []),
    c.polarity,
    c.solfeggio_frequency,
    c.energy_type,
    c.color_range,
    ...(c.origins || []),
    c.rarity,
    c.luster,
    ...(c.emotional || []),
    ...(c.mental || []),
    ...(c.spiritual || []),
    ...(c.physical || []),
    c.vedic_tradition,
    c.tcm_use,
    c.five_element_theory,
    c.feng_shui_bagua,
    c.feng_shui_placement,
    c.ancient_lore,
    c.indigenous_traditions,
    c.meditation_guidance,
    c.body_placement,
    c.space_placement,
    c.elixir_notes,
    c.jewelry_recommendations,
    c.ethical_sourcing,
    ...(c.safe_cleansing || []),
    ...(c.unsafe_cleansing || []),
    ...(c.charging_methods || []),
    c.storage_guidance,
    c.cautions,
    c.toxicity,
    c.fragility,
    ...(c.synergies || []).map(s => `${s.crystal} ${s.rationale}`),
    ...(c.conflicts || []).map(x => `${x.crystal} ${x.reason}`),
    ...(c.intention_filter || []),
    c.grid_role
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// ── Query Expansion ───────────────────────────────────────────
function expandQuery(q) {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const expanded = new Set(words);
  words.forEach(w => {
    (SYNONYMS[w] || []).forEach(s => expanded.add(s.toLowerCase()));
  });
  return [...expanded];
}

// ── Filter Logic ──────────────────────────────────────────────
function getFilterValue(c, dim) {
  const map = {
    intention:   c.intention_filter,
    chakra:      c.chakra_filter,
    element:     [c.element_filter],
    energy_type: [c.energy_type_filter],
    polarity:    [c.polarity_filter],
    planet:      [c.planet_filter],
    zodiac:      c.zodiac_filter,
    elixir:      [c.elixir_filter],
    rarity:      [c.rarity_filter]
  };
  return (map[dim] || []).map(v => String(v));
}

function computeFiltered() {
  const terms = expandQuery(STATE.query);

  STATE.filtered = window.CRYSTALS.filter(c => {
    // Text search: all terms must appear in the search blob
    if (terms.length) {
      const blob = c._search || '';
      if (!terms.every(t => blob.includes(t))) return false;
    }

    // Per-dimension AND logic; OR within same dimension
    for (const [dim, values] of Object.entries(STATE.filters)) {
      if (!values.size) continue;
      const cVals = getFilterValue(c, dim);
      if (!cVals.some(v => values.has(v))) return false;
    }

    // Mohs range
    if (c.mohs_hardness < STATE.mohsMin || c.mohs_hardness > STATE.mohsMax) return false;

    return true;
  });
}

// ── Render Grid ───────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('grid');
  const count = document.getElementById('result-count');

  count.textContent =
    `${STATE.filtered.length} crystal${STATE.filtered.length !== 1 ? 's' : ''}`;

  if (!STATE.filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔮</div>
        <p class="empty-state-text">No crystals match your search</p>
      </div>`;
    return;
  }

  if (STATE.viewMode === 'list') {
    grid.innerHTML = STATE.filtered.map((c, i) => `
      <article class="crystal-card"
        style="--card-index:${i}; --card-color:${c.color}; --card-glow:${c.color}33"
        data-id="${c.id}"
        tabindex="0"
        role="button"
        aria-label="Open ${c.name} details">
        <div class="card-emoji">${c.emoji}</div>
        <div class="card-content">
          <h3 class="card-name">${c.name}</h3>
          <p class="card-family">${c.mineral_family}</p>
          <div class="card-tags">
            <span class="tag tag-chakra">${c.chakras[0]}</span>
            <span class="tag tag-element">${c.element}</span>
            <span class="tag tag-energy">${c.energy_type}</span>
          </div>
        </div>
      </article>`).join('');
  } else {
    grid.innerHTML = STATE.filtered.map((c, i) => `
      <article class="crystal-card"
        style="--card-index:${i}; --card-color:${c.color}; --card-glow:${c.color}33"
        data-id="${c.id}"
        tabindex="0"
        role="button"
        aria-label="Open ${c.name} details">
        <div class="card-emoji">${c.emoji}</div>
        <h3 class="card-name">${c.name}</h3>
        <p class="card-family">${c.mineral_family}</p>
        <p class="card-intention">${c.short_intention}</p>
        <div class="card-tags">
          <span class="tag tag-chakra">${c.chakras[0]}</span>
          <span class="tag tag-element">${c.element}</span>
          <span class="tag tag-energy">${c.energy_type}</span>
        </div>
      </article>`).join('');
  }

  grid.querySelectorAll('.crystal-card').forEach(el => {
    const open = () => openModal(el.dataset.id);
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ── Render Active Pills ───────────────────────────────────────
function renderPills() {
  const bar    = document.getElementById('active-pills-bar');
  const wrap   = document.getElementById('active-pills');
  const badge  = document.getElementById('filter-badge');
  let total = 0;
  const pills  = [];

  for (const [dim, values] of Object.entries(STATE.filters)) {
    for (const val of values) {
      pills.push({ dim, val });
      total++;
    }
  }

  // Mohs counts if not default
  const mohsActive = STATE.mohsMin > 1 || STATE.mohsMax < 10;
  if (mohsActive) total++;

  badge.textContent = total || '';
  badge.hidden = total === 0;

  if (!pills.length && !mohsActive) {
    bar.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  bar.hidden = false;
  let html = pills.map(({ dim, val }) => `
    <span class="pill">
      <span>${val}</span>
      <button class="pill-remove" data-dim="${dim}" data-val="${val}" aria-label="Remove ${val} filter">✕</button>
    </span>`).join('');

  if (mohsActive) {
    html += `
      <span class="pill">
        <span>Mohs ${STATE.mohsMin}–${STATE.mohsMax}</span>
        <button class="pill-remove" data-dim="mohs" aria-label="Remove Mohs filter">✕</button>
      </span>`;
  }

  wrap.innerHTML = html;

  wrap.querySelectorAll('.pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.dim;
      if (dim === 'mohs') {
        STATE.mohsMin = 1;
        STATE.mohsMax = 10;
        document.getElementById('mohs-min').value = 1;
        document.getElementById('mohs-max').value = 10;
      } else {
        STATE.filters[dim]?.delete(btn.dataset.val);
        // sync chip UI
        document.querySelectorAll(`.chip[data-dimension="${dim}"][data-value="${btn.dataset.val}"]`)
          .forEach(c => c.classList.remove('active'));
      }
      refresh();
    });
  });
}

// ── Full Refresh ──────────────────────────────────────────────
function refresh() {
  computeFiltered();
  renderGrid();
  renderPills();
}

// ── Modal: Open ───────────────────────────────────────────────
function openModal(id) {
  const c = window.CRYSTALS.find(x => x.id === id);
  if (!c) return;
  STATE.openId    = id;
  STATE.activeTab = 'identity';

  renderModalHeader(c);
  activateTab('identity');

  const modal = document.getElementById('modal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Focus the close button
  setTimeout(() => document.getElementById('modal-close')?.focus(), 50);
}

function closeModal() {
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
  STATE.openId = null;
}

// ── Modal: Header ─────────────────────────────────────────────
function renderModalHeader(c) {
  const elixirCls  = c.elixir_safety.toLowerCase();
  const elixirIcon = { safe: '✓', indirect: '⚠', avoid: '✗' }[elixirCls] || '';
  document.getElementById('modal-header').innerHTML = `
    <div class="modal-header-inner">
      <div class="modal-emoji" style="--crystal-color:${c.color}">${c.emoji}</div>
      <div class="modal-header-text">
        <h2 class="modal-crystal-name" id="modal-crystal-name">${c.name}</h2>
        <p class="modal-family">${c.mineral_family} · ${c.crystal_system}</p>
        <p class="modal-short-intention">${c.short_intention}</p>
        <div class="modal-header-tags">
          ${c.chakras.map(ch => `<span class="header-tag tag-chakra">${ch}</span>`).join('')}
          <span class="header-tag tag-element">${c.element}</span>
          <span class="header-tag tag-energy">${c.energy_type}</span>
          <span class="header-tag ${elixirCls === 'safe' ? 'chip-safe' : elixirCls === 'indirect' ? 'chip-indirect' : 'chip-avoid'}"
            style="padding:0.2rem 0.7rem;border-radius:99px;font-family:var(--font-label);font-size:0.65rem;border:1px solid">
            ${elixirIcon} Elixir: ${c.elixir_safety}
          </span>
        </div>
      </div>
    </div>`;
}

// ── Modal: Tab Activation ─────────────────────────────────────
function activateTab(tab) {
  STATE.activeTab = tab;
  const c = window.CRYSTALS.find(x => x.id === STATE.openId);
  if (!c) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  renderModalTab(c, tab);
}

// ── Modal: Tab Dispatch ───────────────────────────────────────
function renderModalTab(c, tab) {
  const body = document.getElementById('modal-body');
  const renderers = {
    identity:     renderIdentity,
    metaphysical: renderMetaphysical,
    healing:      renderHealing,
    cultural:     renderCultural,
    practical:    renderPractical,
    synergies:    renderSynergies,
    care:         renderCare
  };
  body.innerHTML = (renderers[tab] || (() => ''))(c);

  // Attach notes handler after Care tab is rendered
  if (tab === 'care') attachNotesHandler(c.id);
}

// ── Tab: Identity ─────────────────────────────────────────────
function renderIdentity(c) {
  const origins = (c.origins || []).join(', ') || '—';
  const alts    = (c.alt_names || []).join(', ') || '—';
  return `
    <div class="tab-section">
      <h4 class="section-title">Scientific Identity</h4>
      <div class="prop-grid">
        ${prop('Mineral Family',    c.mineral_family)}
        ${prop('Chemical Formula', `<span class="mono">${c.chemical_formula}</span>`)}
        ${prop('Crystal System',   c.crystal_system)}
        ${prop('Mohs Hardness',    c.mohs_hardness + ' / 10')}
        ${prop('Luster',           c.luster)}
        ${prop('Transparency',     c.transparency)}
        ${prop('Color Range',      c.color_range)}
        ${prop('Rarity',           c.rarity)}
        ${prop('Origins',          origins)}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Names & Identification</h4>
      <div class="prop-grid">
        ${prop('Alternative Names', alts)}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Sourcing & Authenticity</h4>
      <div class="prop-grid" style="grid-template-columns:1fr">
        ${prop('Ethical Sourcing', c.ethical_sourcing || '—')}
        ${prop('Simulant Warnings', c.simulant_warnings || '—')}
      </div>
    </div>`;
}

// ── Tab: Metaphysical ─────────────────────────────────────────
const CHAKRA_COLORS = {
  'Root': '#e53e3e', 'Sacral': '#dd6b20', 'Solar Plexus': '#d69e2e',
  'Heart': '#38a169', 'Throat': '#3182ce', 'Third Eye': '#805ad5', 'Crown': '#b794f4'
};

function renderMetaphysical(c) {
  const zodiacs = (c.zodiac || []).join(', ');
  return `
    <div class="tab-section">
      <h4 class="section-title">Chakra Alignment</h4>
      <div class="chakra-badges">
        ${(c.chakras || []).map(ch => {
          const cc = CHAKRA_COLORS[ch] || 'var(--lavender)';
          return `<span class="chakra-badge" style="--cc:${cc}">
            <span class="chakra-dot"></span>${ch}
          </span>`;
        }).join('')}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Elemental & Planetary</h4>
      <div class="prop-grid">
        ${prop('Element',    c.element)}
        ${prop('Planet',     c.planet)}
        ${prop('Day',        c.day_of_week)}
        ${prop('Polarity',   c.polarity)}
        ${prop('Numerology', c.numerology)}
        ${prop('Solfeggio',  c.solfeggio_frequency)}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Zodiac Associations</h4>
      <div class="meta-tags">
        ${(c.zodiac || []).map(z => `<span class="meta-tag">${z}</span>`).join('')}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Energy Profile</h4>
      <div class="prop-grid" style="grid-template-columns:1fr">
        ${prop('Energy Type', c.energy_type)}
        ${prop('Intention',   c.intention)}
      </div>
    </div>`;
}

// ── Tab: Healing ──────────────────────────────────────────────
function renderHealing(c) {
  return `
    <div class="tab-section">
      <h4 class="section-title">Emotional Healing</h4>
      <ul class="bullet-list">${(c.emotional || []).map(x => `<li>${x}</li>`).join('')}</ul>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Mental Healing</h4>
      <ul class="bullet-list">${(c.mental || []).map(x => `<li>${x}</li>`).join('')}</ul>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Spiritual Healing</h4>
      <ul class="bullet-list">${(c.spiritual || []).map(x => `<li>${x}</li>`).join('')}</ul>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Physical Associations</h4>
      <ul class="bullet-list">${(c.physical || []).map(x => `<li>${x}</li>`).join('')}</ul>
    </div>`;
}

// ── Tab: Cultural ─────────────────────────────────────────────
function renderCultural(c) {
  return `
    <div class="tab-section">
      <h4 class="section-title">Vedic & Jyotish Tradition</h4>
      <p class="prose">${c.vedic_tradition || '—'}</p>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Traditional Chinese Medicine</h4>
      <div class="prop-grid" style="grid-template-columns:1fr">
        ${prop('TCM Use',               c.tcm_use || '—')}
        ${prop('Five Element Theory',   c.five_element_theory || '—')}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Feng Shui</h4>
      <div class="prop-grid">
        ${prop('Bagua Area',       c.feng_shui_bagua || '—')}
        ${prop('Placement',        c.feng_shui_placement || '—')}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Ancient Lore</h4>
      <p class="prose">${c.ancient_lore || '—'}</p>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Indigenous Traditions</h4>
      <p class="prose">${c.indigenous_traditions || '—'}</p>
    </div>`;
}

// ── Tab: Practical ────────────────────────────────────────────
function renderPractical(c) {
  const cls    = c.elixir_safety.toLowerCase();
  const config = {
    safe:     { icon: '✓', label: 'Safe for Direct Elixir' },
    indirect: { icon: '⚠', label: 'Indirect Method Only' },
    avoid:    { icon: '✗', label: 'Do Not Use in Elixir' }
  }[cls] || { icon: '?', label: c.elixir_safety };

  return `
    <div class="tab-section">
      <h4 class="section-title">Meditation Guidance</h4>
      <p class="prose">${c.meditation_guidance || '—'}</p>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Placement</h4>
      <div class="prop-grid" style="grid-template-columns:1fr">
        ${prop('On the Body', c.body_placement || '—')}
        ${prop('In Space',    c.space_placement || '—')}
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Elixir Safety</h4>
      <div class="elixir-box ${cls}">
        <div class="elixir-label">
          <span class="elixir-icon">${config.icon}</span>
          ${config.label}
        </div>
        <p class="elixir-note">${c.elixir_notes || '—'}</p>
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Jewelry Recommendations</h4>
      <p class="prose">${c.jewelry_recommendations || '—'}</p>
    </div>`;
}

// ── Tab: Synergies ────────────────────────────────────────────
function renderSynergies(c) {
  const syns = c.synergies || [];
  const cons = c.conflicts  || [];
  return `
    <div class="tab-section">
      <h4 class="section-title">Compatible Stones</h4>
      ${syns.length
        ? `<div class="synergy-list">${syns.map(s => `
            <div class="synergy-card">
              <div class="synergy-name">${s.crystal}</div>
              <div class="synergy-rationale">${s.rationale}</div>
            </div>`).join('')}</div>`
        : '<p class="prose">No documented synergies yet.</p>'}
    </div>
    <div class="tab-section">
      <h4 class="section-title">Conflicting Stones</h4>
      ${cons.length
        ? `<div class="conflict-list">${cons.map(x => `
            <div class="conflict-card">
              <div class="conflict-name">${x.crystal}</div>
              <div class="conflict-reason">${x.reason}</div>
            </div>`).join('')}</div>`
        : '<p class="prose">No documented conflicts.</p>'}
    </div>
    <div class="tab-section">
      <h4 class="section-title">Grid Role</h4>
      <p class="prose">${c.grid_role || '—'}</p>
    </div>`;
}

// ── Tab: Care ─────────────────────────────────────────────────
function renderCare(c) {
  return `
    <div class="tab-section">
      <h4 class="section-title">Cleansing</h4>
      <div class="two-col">
        <div>
          <p class="prop-label" style="margin-bottom:0.4rem">Safe Methods</p>
          <ul class="bullet-list">${(c.safe_cleansing || []).map(x => `<li>${x}</li>`).join('')}</ul>
        </div>
        <div>
          <p class="prop-label" style="margin-bottom:0.4rem">Avoid</p>
          <ul class="bullet-list">${(c.unsafe_cleansing || []).map(x => `<li>${x}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Charging Methods</h4>
      <ul class="bullet-list">${(c.charging_methods || []).map(x => `<li>${x}</li>`).join('')}</ul>
    </div>
    <div class="tab-section">
      <h4 class="section-title">Storage & Cautions</h4>
      <div class="prop-grid" style="grid-template-columns:1fr">
        ${prop('Storage',    c.storage_guidance || '—')}
        ${prop('Toxicity',   c.toxicity || '—')}
        ${prop('Fragility',  c.fragility || '—')}
        ${prop('Cautions',   c.cautions || '—')}
      </div>
    </div>
    <div class="notes-wrap">
      <span class="notes-label">Personal Notes</span>
      <textarea
        id="crystal-notes"
        class="notes-textarea"
        placeholder="Your personal observations, experiences, and intentions for ${escHtml(c.name)}…"
        rows="5"
      ></textarea>
    </div>`;
}

// ── Notes Handler ─────────────────────────────────────────────
function attachNotesHandler(id) {
  const ta = document.getElementById('crystal-notes');
  if (!ta) return;
  ta.value = STATE.notes[id] || '';
  let debounce;
  ta.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => saveNote(id, ta.value), 400);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function prop(label, value) {
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <span class="prop-value">${value || '—'}</span>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Starfield ─────────────────────────────────────────────────
function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const STARS = Array.from({ length: 280 }, () => ({
    x:       Math.random(),
    y:       Math.random(),
    r:       Math.random() * 1.4 + 0.2,
    opacity: Math.random() * 0.65 + 0.2,
    speed:   Math.random() * 0.0006 + 0.0002
  }));

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    STARS.forEach(s => {
      const flicker = reduced
        ? s.opacity
        : s.opacity * (0.75 + 0.25 * Math.sin(t * s.speed * 1000));
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(215, 200, 255, ${flicker})`;
      ctx.fill();
    });
    if (!reduced) t += 0.016;
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Event Bindings ────────────────────────────────────────────
function bindEvents() {
  // Search
  const searchEl = document.getElementById('search');
  searchEl.addEventListener('input', () => {
    STATE.query = searchEl.value.trim();
    refresh();
  });

  // Filter toggle
  const filterToggle = document.getElementById('filter-toggle');
  const filterPanel  = document.getElementById('filter-panel');
  filterToggle.addEventListener('click', () => {
    const open = !filterPanel.hidden;
    filterPanel.hidden = open;
    filterToggle.setAttribute('aria-expanded', String(!open));
  });

  // Filter chips
  document.querySelectorAll('.chip[data-dimension]').forEach(chip => {
    chip.addEventListener('click', () => {
      const { dimension: dim, value: val } = chip.dataset;
      if (!STATE.filters[dim]) STATE.filters[dim] = new Set();
      if (STATE.filters[dim].has(val)) {
        STATE.filters[dim].delete(val);
        chip.classList.remove('active');
      } else {
        STATE.filters[dim].add(val);
        chip.classList.add('active');
      }
      refresh();
    });
  });

  // Mohs range
  document.getElementById('mohs-min').addEventListener('change', e => {
    STATE.mohsMin = Number(e.target.value);
    if (STATE.mohsMin > STATE.mohsMax) {
      STATE.mohsMax = STATE.mohsMin;
      document.getElementById('mohs-max').value = STATE.mohsMin;
    }
    refresh();
  });
  document.getElementById('mohs-max').addEventListener('change', e => {
    STATE.mohsMax = Number(e.target.value);
    if (STATE.mohsMax < STATE.mohsMin) {
      STATE.mohsMin = STATE.mohsMax;
      document.getElementById('mohs-min').value = STATE.mohsMax;
    }
    refresh();
  });

  // Clear all
  document.getElementById('clear-all').addEventListener('click', () => {
    STATE.filters = {};
    STATE.mohsMin = 1;
    STATE.mohsMax = 10;
    document.getElementById('mohs-min').value = 1;
    document.getElementById('mohs-max').value = 10;
    document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    refresh();
  });

  // View toggle
  const viewToggle = document.getElementById('view-toggle');
  viewToggle.addEventListener('click', () => {
    const isGrid = STATE.viewMode === 'grid';
    STATE.viewMode = isGrid ? 'list' : 'grid';
    document.getElementById('grid').classList.toggle('list-view', STATE.viewMode === 'list');
    document.getElementById('icon-grid').hidden = STATE.viewMode === 'grid';
    document.getElementById('icon-list').hidden = STATE.viewMode !== 'grid';
    renderGrid();
  });

  // Modal tabs
  document.getElementById('modal-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) activateTab(btn.dataset.tab);
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal').hidden) closeModal();
  });
}

// ── Export / Import Notes ────────────────────────────────────
// (Hooked to future toolbar buttons — foundation ready)
function exportNotes() {
  const blob = new Blob([JSON.stringify(STATE.notes, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'crystal-sage-notes.json' });
  a.click();
  URL.revokeObjectURL(url);
}

function importNotes(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.assign(STATE.notes, data);
      localStorage.setItem(NOTES_KEY, JSON.stringify(STATE.notes));
    } catch { alert('Invalid notes file.'); }
  };
  reader.readAsText(file);
}

// Expose for potential future toolbar use
window.CrystalSage = { exportNotes, importNotes };

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build search index for each crystal
  window.CRYSTALS.forEach(c => { c._search = buildSearchBlob(c); });

  loadNotes();
  initStarfield();
  computeFiltered();
  renderGrid();
  bindEvents();
});
