import { median, average, viralScore } from './metrics.js';

const FRIENDLY = {
  quotaExceeded: 'Quota diária da API esgotada. Use outra chave/projeto ou aguarde a renovação (meia-noite no Pacífico).',
  dailyLimitExceeded: 'Limite diário da API atingido. Tente novamente amanhã ou use outro projeto no Google Cloud.',
  keyInvalid: 'Chave inválida ou restrita. Confira a chave em Configurações e as restrições no Google Cloud.',
  ipRefererBlocked: 'A chave bloqueia este domínio. Libere o acesso em Google Cloud → Credenciais → Restrições.',
  accessNotConfigured: 'Ative a YouTube Data API v3 no projeto do Google Cloud.',
  forbidden: 'Acesso negado pela API. Verifique a chave e as permissões do projeto.',
};

export class ApiError extends Error {
  constructor(message, { status = 0, reason = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reason = reason;
  }
}

async function call(endpoint, params, key) {
  const qs = new URLSearchParams(params);
  let res;
  try {
    res = await fetch(`/api/yt/${endpoint}?${qs}`, {
      headers: key ? { 'x-yt-key': key } : {},
    });
  } catch {
    throw new ApiError('Servidor local indisponível. Rode "npm start" na pasta viral-lab.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || (res.status === 401 ? 'missingKey' : '');
    throw new ApiError(FRIENDLY[reason] || data?.error?.message || `Erro ${res.status}`, {
      status: res.status,
      reason,
    });
  }
  return data;
}

export function parseDuration(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (+(d || 0) * 86_400) + (+(h || 0) * 3_600) + (+(min || 0) * 60) + +(s || 0);
}

export function normalizeVideo(item) {
  const s = item.snippet || {};
  const st = item.statistics || {};
  const thumbs = s.thumbnails || {};
  return {
    id: item.id,
    title: s.title || '',
    channelId: s.channelId || '',
    channelTitle: s.channelTitle || '',
    publishedAt: s.publishedAt || new Date().toISOString(),
    views: +(st.viewCount || 0),
    likes: +(st.likeCount || 0),
    comments: +(st.commentCount || 0),
    duration: parseDuration(item.contentDetails?.duration),
    thumb: thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || '',
    tags: Array.isArray(s.tags) ? s.tags.slice(0, 5).join(', ') : '',
    demo: false,
  };
}

export async function searchVideos({ q, publishedAfter, order = 'viewCount', max = 25, duration = 'any', region } = {}, key) {
  const data = await call('search', {
    part: 'snippet',
    type: 'video',
    q,
    order,
    maxResults: String(max),
    videoDuration: duration,
    ...(publishedAfter ? { publishedAfter } : {}),
    ...(region ? { regionCode: region } : {}),
  }, key);
  return (data.items || []).map((i) => i.id?.videoId).filter(Boolean);
}

export async function videosByIds(ids, key) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await call('videos', {
      part: 'snippet,statistics,contentDetails',
      id: chunk.join(','),
      maxResults: '50',
    }, key);
    out.push(...(data.items || []).map(normalizeVideo));
  }
  return out;
}

export async function channelsByIds(ids, key) {
  const out = [];
  const unique = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 50) {
    const data = await call('channels', {
      part: 'snippet,statistics,contentDetails',
      id: unique.slice(i, i + 50).join(','),
    }, key);
    out.push(...(data.items || []).map(normalizeChannel));
  }
  return out;
}

function normalizeChannel(c) {
  return {
    id: c.id,
    title: c.snippet?.title || '',
    avatar: c.snippet?.thumbnails?.default?.url || c.snippet?.thumbnails?.medium?.url || '',
    handle: c.snippet?.customUrl || '',
    subs: +(c.statistics?.subscriberCount || 0),
    views: +(c.statistics?.viewCount || 0),
    count: +(c.statistics?.videoCount || 0),
    uploads: c.contentDetails?.relatedPlaylists?.uploads || '',
  };
}

export function parseChannelRef(input) {
  const raw = input.trim();
  if (!raw) return null;
  const idMatch = raw.match(/(?:channel\/)?(UC[\w-]{20,})/);
  if (idMatch) return { id: idMatch[1] };
  const handle = raw.match(/@([\w.\-]+)/);
  if (handle) return { handle: `@${handle[1]}` };
  const legacy = raw.match(/\/(?:c|user)\/([\w.\-]+)/);
  if (legacy) return { username: legacy[1] };
  if (/^[\w.\-]+$/.test(raw)) return { handle: `@${raw}` };
  return { handle: raw };
}

async function fetchChannel(ref, key) {
  const params = { part: 'snippet,statistics,contentDetails' };
  if (ref.id) params.id = ref.id;
  else if (ref.handle) params.forHandle = ref.handle;
  else params.forUsername = ref.username;
  const data = await call('channels', params, key);
  const c = data.items?.[0];
  if (!c) throw new ApiError('Canal não encontrado. Cole a URL completa, o @handle ou o ID UC…');
  return normalizeChannel(c);
}

async function resolveChannel(input, key) {
  const ref = parseChannelRef(input);
  if (!ref) throw new ApiError('Informe o canal.');
  try {
    return await fetchChannel(ref, key);
  } catch (err) {
    if (err instanceof ApiError && /não encontrado/i.test(err.message) && !ref.id) {
      const data = await call('search', { part: 'snippet', type: 'channel', q: input, maxResults: '1' }, key);
      const found = data.items?.[0]?.id?.channelId;
      if (found) return fetchChannel({ id: found }, key);
    }
    throw err;
  }
}

export async function analyzeChannel(input, key) {
  const channel = await resolveChannel(input, key);
  const pl = await call('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: channel.uploads,
    maxResults: '50',
  }, key);
  const ids = (pl.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
  const videos = await videosByIds(ids, key);
  const med = median(videos.map((v) => v.views));
  const withRatio = videos
    .map((v) => ({ ...v, outlierRatio: med ? v.views / med : 0 }))
    .sort((a, b) => viralScore(b) - viralScore(a));
  const outliers = withRatio.filter((v) => v.outlierRatio >= 2).slice(0, 12);
  return {
    ...channel,
    median: med,
    avg: average(videos.map((v) => v.views)),
    analyzed: videos.length,
    videos: withRatio,
    outliers,
    analyzedAt: new Date().toISOString(),
  };
}

export const QUOTA = { search: 100, videos: 1, channels: 1, playlistItems: 1 };
