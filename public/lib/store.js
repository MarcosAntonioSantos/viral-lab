import { DEFAULTS } from './seed.js';

const KEY = 'viral-lab-v2';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function hydrate(saved) {
  const base = structuredClone(DEFAULTS);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    niches: Array.isArray(saved.niches) && saved.niches.length ? saved.niches : base.niches,
    formats: Array.isArray(saved.formats) ? saved.formats : base.formats,
    blocks: Array.isArray(saved.blocks) ? saved.blocks : base.blocks,
    platforms: Array.isArray(saved.platforms) && saved.platforms.length ? saved.platforms : base.platforms,
    languages: Array.isArray(saved.languages) && saved.languages.length ? saved.languages : base.languages,
    channels: Array.isArray(saved.channels) ? saved.channels : [],
    pipeline: Array.isArray(saved.pipeline) ? saved.pipeline : [],
    feeds: saved.feeds && typeof saved.feeds === 'object' ? saved.feeds : {},
  };
}

export const state = hydrate(read());

export const flags = { serverKey: false };

export const hasApiKey = () => Boolean(state.apiKey || flags.serverKey);

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    console.warn('Não foi possível salvar o estado local.');
  }
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
}

export function activeNiche() {
  return state.niches.find((n) => n.id === state.activeNiche) || state.niches[0];
}

export function nicheFormats() {
  const id = activeNiche()?.id;
  return state.formats.filter((f) => !f.nicheId || f.nicheId === id);
}

export function nicheBlocks() {
  const id = activeNiche()?.id;
  const own = state.blocks.filter((b) => !b.nicheId || b.nicheId === id);
  return own.length ? own : state.blocks;
}

export function platformById(id) {
  return state.platforms.find((p) => p.id === id);
}

export function feedItems() {
  const niche = activeNiche();
  const feed = niche ? state.feeds[niche.id] : null;
  return Array.isArray(feed?.items) ? feed.items : [];
}

export function setFeed(items, source = 'api') {
  const niche = activeNiche();
  if (!niche) return;
  state.feeds[niche.id] = { source, fetchedAt: new Date().toISOString(), items };
  save();
}
