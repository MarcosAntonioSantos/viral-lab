import { state, save, activeNiche, flags, hasApiKey } from './lib/store.js';
import * as ui from './lib/ui.js';
import { radar } from './views/radar.js';
import { channels } from './views/channels.js';
import { formats } from './views/formats.js';
import { roteiros } from './views/roteiros.js';
import { pipeline, openItemEditor } from './views/pipeline.js';
import { calendar } from './views/calendar.js';
import { platforms } from './views/platforms.js';
import { languages } from './views/languages.js';
import { method } from './views/method.js';
import { config } from './views/config.js';

const ROUTES = {
  radar: { view: radar, label: 'Radar de virais' },
  canais: { view: channels, label: 'Canais' },
  formatos: { view: formats, label: 'Formatos' },
  roteiros: { view: roteiros, label: 'Estúdio de roteiro' },
  pipeline: { view: pipeline, label: 'Pipeline' },
  calendario: { view: calendar, label: 'Calendário' },
  plataformas: { view: platforms, label: 'Plataformas' },
  idiomas: { view: languages, label: 'Idiomas' },
  metodo: { view: method, label: 'Método' },
  config: { view: config, label: 'Configurações' },
};

const viewEl = document.getElementById('view');
const searchEl = document.getElementById('globalSearch');
const nicheEl = document.getElementById('nichePick');
const connEl = document.getElementById('connStatus');
const navToggle = document.getElementById('navToggle');
const scrim = document.getElementById('scrim');

let searchTerm = '';
let current = 'radar';

const routeName = () => {
  const name = location.hash.replace(/^#\/?/, '').split('?')[0] || 'radar';
  return ROUTES[name] ? name : 'radar';
};

function buildContext() {
  return {
    state,
    niche: activeNiche(),
    search: searchTerm,
    refresh: render,
    go: (route) => { location.hash = `#/${route}`; },
  };
}

function render() {
  current = routeName();
  const { view, label } = ROUTES[current];
  const ctx = buildContext();

  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === current);
  });
  document.title = `Viral Lab · ${label}`;

  viewEl.innerHTML = view.render(ctx);
  view.mount?.(viewEl, ctx);

  document.getElementById('sideQuota').textContent = `${(ctx.niche?.queries?.length || 0) * 100}`;

  if (searchEl.value !== searchTerm) searchEl.value = searchTerm;
  document.body.classList.remove('nav-open');
}

function syncConnection() {
  const ok = hasApiKey();
  connEl.classList.toggle('ok', ok);
  connEl.querySelector('span').textContent = ok ? 'YouTube conectado' : 'sem chave';
}

function syncNiches() {
  nicheEl.innerHTML = state.niches
    .map((n) => `<option value="${ui.esc(n.id)}" ${n.id === state.activeNiche ? 'selected' : ''}>${ui.esc(n.name)}</option>`)
    .join('');
}

nicheEl.addEventListener('change', () => {
  state.activeNiche = nicheEl.value;
  save();
  searchTerm = '';
  render();
});

let searchTimer;
searchEl.addEventListener('input', () => {
  const value = searchEl.value;
  const caret = searchEl.selectionStart;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = value.trim();
    render();
    searchEl.focus();
    searchEl.setSelectionRange(caret, caret);
  }, 160);
});

navToggle.addEventListener('click', () => document.body.classList.toggle('nav-open'));
scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));

document.getElementById('newItem').addEventListener('click', () => {
  openItemEditor(buildContext(), null, {});
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.body.classList.remove('nav-open');
});

window.addEventListener('hashchange', () => {
  if (location.hash === '#/' || location.hash === '') location.hash = '#/radar';
  render();
});

syncNiches();
syncConnection();
if (!location.hash) location.hash = '#/radar';
render();

fetch('/api/health')
  .then((r) => r.json())
  .then((data) => {
    if (data.envKey) {
      flags.serverKey = true;
      syncConnection();
      if (current === 'config') render();
    }
  })
  .catch(() => {});

// Mantém o status da conexão sincronizado quando a chave é alterada em Configurações.
document.addEventListener('click', (e) => {
  if (e.target.closest('#cfgSave')) setTimeout(syncConnection, 60);
});
