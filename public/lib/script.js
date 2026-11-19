import { state, uid } from './store.js';
import { viralScore, viewsPerDay, engagement } from './metrics.js';

export const KINDS = [
  { id: 'hook', label: 'Hook', short: 'Hook' },
  { id: 'contexto', label: 'Contexto', short: 'Contexto' },
  { id: 'prova', label: 'Prova', short: 'Prova' },
  { id: 'desenvolvimento', label: 'Desenvolvimento', short: 'Desenv.' },
  { id: 'virada', label: 'Virada', short: 'Virada' },
  { id: 'cta', label: 'CTA', short: 'CTA' },
];

export const kindById = (id) => KINDS.find((k) => k.id === id) || { id, label: id, short: id };

export const ANGLES = [
  { id: 'curiosidade', name: 'Curiosidade / detalhe escondido' },
  { id: 'noticia', name: 'Notícia / urgência' },
  { id: 'comparacao', name: 'Comparação / nostalgia' },
  { id: 'teoria', name: 'Teoria / especulação' },
  { id: 'polemica', name: 'Polêmica / opinião forte' },
  { id: 'lista', name: 'Lista / ranking' },
  { id: 'analise', name: 'Análise técnica' },
  { id: 'reacao', name: 'Reação / comentário' },
  { id: 'preco', name: 'Consumidor / preço' },
  { id: 'mescla', name: 'Mescla de referências' },
];

const WEIGHTS = { hook: 1.2, contexto: 2.2, prova: 1.9, desenvolvimento: 4, virada: 2, cta: 1.4, transicao: 0.8 };

const FALLBACK = {
  hook: '“{tema}” — e o detalhe que quase ninguém reparou muda a leitura.',
  contexto: 'O básico primeiro: o que foi mostrado, de onde veio e por que importa agora.',
  prova: 'Olha a imagem. Sem zoom, sem corte: é exatamente isso que está na tela.',
  desenvolvimento: 'Agora conecta com o que já sabemos: o detalhe faz parte de um padrão.',
  virada: 'E aqui está a virada: o que parecia detalhe é a pista principal.',
  cta: 'Se você viu outra coisa nesse trecho, escreve nos comentários.',
};

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

const compact = (n) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

const fill = (text, vars) => String(text || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

export const clip = (text, max = 70) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
};

const nicheName = () => (state.niches.find((n) => n.id === state.activeNiche)?.name || '').trim();

const brandKey = () => nicheName().split(/\s+/)[0].toLowerCase();

export function topicOf(title = '') {
  const raw = String(title)
    .replace(/\s*[|•]\s.*$/, ' ')
    .replace(/[#@]\S+/g, ' ')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^(joguei|testei|reagi a|analisei|olhei|vi)\s+/i, '')
    .trim();
  const parts = raw.split(/\s*[:–—]\s*/).filter(Boolean);
  const brand = brandKey();
  if (parts.length > 1) {
    const first = parts[0];
    const rest = parts.slice(1).join(': ');
    if (!(brand && first.toLowerCase().includes(brand)) && first.length <= 28) {
      return rest.replace(/[.!?]+$/, '').trim() || 'GTA VI';
    }
  }
  return raw.replace(/[.!?]+$/, '').trim() || 'GTA VI';
}

function withBrand(topic) {
  const brand = nicheName();
  if (!brand) return topic;
  return topic.toLowerCase().includes(brandKey()) ? topic : `${brand} — ${topic}`;
}

const channelOf = (v = {}) => v.channelTitle || v.channel || 'o canal de referência';

export function inferAngle(src = {}) {
  const text = `${src.title || ''} ${src.name || ''} ${Array.isArray(src.tags) ? src.tags.join(' ') : src.tags || ''}`;
  const rules = [
    ['preco', /pre[çc]o|quanto custa|\bcusta\b|caro|barato|vale a pena|vers[õo]es|edi[çc][ãa]o|r\$|us\$/i],
    ['comparacao', /\bvs\b|versus|compara|diferen[çc]a|antes e depois|melhor que|nostalgia/i],
    ['reacao', /reagi|rea[çc][ãa]o|impress[õo]es|opini[ãa]o|joguei|testei|review/i],
    ['lista', /^\s*\d+|ranking|\btop\s*\d|\d+\s+(coisas|dicas|motivos|erros|segredos)|contagem/i],
    ['teoria', /teoria|ser[áa]|pode ser|talvez|poss[íi]vel|especula|vazamento|rumor|plaus[íi]vel/i],
    ['polemica', /pol[êe]mica|controv[ée]rsia|ningu[ée]m|errado|verdade sobre/i],
    ['analise', /an[áa]lise|analisei|frame|detalhe|explicad|mapa|entenda|por que|segredo|escondid/i],
    ['noticia', /not[íi]cia|saiu|nov[oa]|confirma|anuncia|data|trailer|vaza|atualiza|oficial|lan[çc]a|agora/i],
  ];
  for (const [id, re] of rules) if (re.test(text)) return id;
  return 'curiosidade';
}

export function targetSeconds(video, format) {
  if (video?.duration) return Math.max(15, Math.round(video.duration));
  const raw = format?.duration || '';
  const nums = (raw.match(/\d+/g) || []).map(Number);
  if (!nums.length) return 480;
  const base = Math.max(...nums);
  return Math.max(15, /min/i.test(raw) ? base * 60 : base);
}

export const durationLabel = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
};

export function sourceFromVideo(v = {}) {
  return {
    id: v.id,
    videoId: v.id,
    title: v.title || '',
    channel: channelOf(v),
    views: v.views || 0,
    likes: v.likes || 0,
    comments: v.comments || 0,
    publishedAt: v.publishedAt || '',
    duration: v.duration || 0,
    tags: v.tags || '',
    demo: Boolean(v.demo),
    score: v.views && v.publishedAt ? viralScore(v) : 0,
    url: v.demo ? '' : `https://youtu.be/${v.id}`,
  };
}

export function titleVariants(topic, angle = 'curiosidade') {
  const t = withBrand(topicOf(topic));
  const sets = {
    noticia: [`${t} — o que muda agora`, `Saiu: ${t}. Entenda em 1 minuto`, `${t} — confirmado ou não?`],
    curiosidade: [`O detalhe em ${t} que ninguém viu`, `${t} — o que está escondido na tela`, `Olhei ${t} de novo e achei isso`],
    analise: [`${t} explicado frame a frame`, `O que ${t} realmente mostra`, `${t} — a leitura que quase ninguém fez`],
    comparacao: [`${t} — a diferença que muda tudo`, `${t} lado a lado`, `Antes e depois: ${t}`],
    lista: [`${t} — os pontos que importam`, `${t} em ordem de importância`, `${t} — do pior ao melhor`],
    teoria: [`${t} — teoria plausível ou viagem?`, `O que ${t} pode revelar`, `${t} — a pista que ninguém ligou`],
    polemica: [`${t} — a opinião que ninguém quer ouvir`, `${t} — eu discordo`, `A verdade incômoda sobre ${t}`],
    reacao: [`Reagindo: ${t}`, `Minha reação sem filtro: ${t}`, `O que eu achei de ${t}`],
    preco: [`${t} — vale a pena?`, `A conta real de ${t}`, `${t} — o que você paga de verdade`],
    mescla: [`${t} — a conexão que ninguém fez`, `${t} — o que isso muda`, `Juntei as pistas de ${t}`],
  };
  return [...new Set((sets[angle] || sets.curiosidade).map((s) => clip(s, 72)))].slice(0, 3);
}

export function tagsFor(angle, topic) {
  const angleTags = {
    noticia: ['notícia', 'urgência'],
    curiosidade: ['curiosidade', 'detalhe'],
    analise: ['análise', 'frame a frame'],
    comparacao: ['comparação', 'nostalgia'],
    lista: ['lista', 'ranking'],
    teoria: ['teoria', 'especulação'],
    polemica: ['opinião', 'polêmica'],
    reacao: ['reação', 'review'],
    preco: ['preço', 'consumidor'],
    mescla: ['mescla', 'conexão'],
  };
  const niche = state.niches.find((n) => n.id === state.activeNiche);
  const nicheTag = (niche?.name || 'viral').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const words = topicOf(topic).toLowerCase().split(/\s+/).filter((w) => w.length > 4).slice(0, 2);
  return [...new Set([...(angleTags[angle] || []), nicheTag, ...words])].slice(0, 9);
}

export function thumbnailFor(topic) {
  const brand = nicheName().toUpperCase().split(/\s+/)[0];
  const words = topicOf(topic)
    .replace(/[^\wÀ-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return [...new Set([brand, ...words])].filter(Boolean).slice(0, 3).join(' ').toUpperCase();
}

function descriptionFor({ hook, title, angle, topic, sources = [], beats = [] }) {
  const niche = state.niches.find((n) => n.id === state.activeNiche);
  const chapters = beats.map((b) => `${b.time || '00:00'} ${kindById(b.kind).label}`).join('\n');
  const refs = sources.filter((s) => s.url).map((s) => `• ${s.title} — ${s.url}`).join('\n');
  return [
    hook,
    '',
    `${title || topic}. ${angle === 'noticia' ? 'O que foi confirmado, o que ainda é expectativa e o que muda na prática.' : 'A leitura ponto a ponto, com prova na tela e sem repetir o que todo mundo já falou.'}`,
    '',
    'Capítulos:',
    chapters,
    refs ? `\nReferências:\n${refs}` : '',
    '',
    (niche?.queries || []).slice(0, 4).map((q) => `#${q.replace(/[^a-zA-Z0-9]/g, '')}`).join(' '),
  ].filter((line) => line !== undefined && line !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function blockPool(kindId, angle) {
  const id = state.activeNiche;
  const scoped = state.blocks.filter((b) => !b.nicheId || b.nicheId === id);
  return (scoped.length ? scoped : state.blocks).filter((b) =>
    b.kind === kindId
    && (!b.tags?.length || b.tags.includes('geral') || b.tags.includes(angle)));
}

export function reschedule(beats = [], totalSeconds = 480) {
  const total = Math.max(15, Math.round(Number(totalSeconds) || 480));
  const sum = beats.reduce((s, b) => s + (Number(b.weight) || WEIGHTS[b.kind] || 2), 0) || 1;
  let cursor = 0;
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  return beats.map((b, i) => {
    const weight = Number(b.weight) || WEIGHTS[b.kind] || 2;
    const start = cursor;
    let end = i === beats.length - 1 ? total : Math.max(start + 2, Math.round(cursor + (total * weight) / sum));
    end = Math.min(end, total);
    cursor = end;
    return { ...b, start, end, time: `${mmss(start)}–${mmss(end)}` };
  });
}

export function buildScript({ video = null, format = null, angle, title, duration } = {}) {
  const a = angle || inferAngle(video || format || {});
  const total = Math.round(duration || targetSeconds(video, format));
  const rawTitle = title || video?.title || format?.name || 'GTA VI';
  const topic = topicOf(rawTitle);
  const vars = {
    tema: topic,
    canal: channelOf(video || {}),
    numero: video?.views ? compact(video.views) : 'o dado que aparece na tela',
    praca: 'Leonida',
  };
  const seed = `${rawTitle}${a}`;
  const usedBlocks = new Set();

  const blockBeat = (kindId, salt = '') => {
    const pool = blockPool(kindId, a);
    let block = null;
    if (pool.length) {
      const start = hash(`${seed}${salt}${kindId}`) % pool.length;
      block = pool[(start + [...usedBlocks].length) % pool.length];
      if (usedBlocks.has(block.id)) block = pool.find((b) => !usedBlocks.has(b.id)) || block;
      usedBlocks.add(block.id);
    }
    return {
      id: uid('b'),
      kind: kindId,
      text: fill(block?.text || FALLBACK[kindId], vars),
      cue: block?.cue || '',
      weight: block?.weight || WEIGHTS[kindId] || 2,
    };
  };

  const beats = [blockBeat('hook'), blockBeat('contexto'), blockBeat('prova')];
  const steps = format?.steps?.length ? format.steps : [];
  if (steps.length) {
    steps.slice(0, total < 120 ? 2 : 5).forEach((step) => {
      beats.push({ id: uid('b'), kind: 'desenvolvimento', text: fill(step, vars), cue: 'Executar na tela', weight: 3 });
    });
  } else {
    const pool = blockPool('desenvolvimento', a).length || 3;
    const count = Math.min(pool, 6, Math.max(1, Math.round(total / 90)));
    for (let i = 0; i < count; i += 1) beats.push(blockBeat('desenvolvimento', `dev${i}`));
  }
  beats.push(blockBeat('virada', 'turn'), blockBeat('cta', 'cta'));

  const timed = reschedule(beats, total);
  const hook = timed.find((b) => b.kind === 'hook')?.text || '';
  const titles = titleVariants(topic, a);
  const sources = video ? [sourceFromVideo(video)] : [];

  return {
    beats: timed,
    hook,
    title: titles[0],
    titleOptions: titles,
    description: descriptionFor({ hook, title: titles[0], angle: a, topic, sources, beats: timed }),
    tags: tagsFor(a, topic),
    thumbnail: thumbnailFor(topic),
    angle: a,
    duration: total,
    sources,
    platform: undefined,
  };
}

export function fillBlock(text, item = {}) {
  return fill(text, {
    tema: topicOf(item.title || 'GTA VI'),
    canal: channelOf(item),
    numero: item.views ? compact(item.views) : 'o dado que aparece na tela',
    praca: 'Leonida',
  });
}

export function scriptToBeats(text = '') {
  const lines = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const match = line.match(/^\[([^\]]+)\]\s*[^:]+:\s*(.*)$/);
    return {
      id: uid('b'),
      kind: i === 0 ? 'hook' : i === lines.length - 1 ? 'cta' : 'desenvolvimento',
      text: match ? match[2] : line,
      cue: '',
    };
  });
}

export function scriptText(beats = []) {
  return beats.map((b) => {
    const label = kindById(b.kind).label;
    return `${b.time ? `[${b.time}] ` : ''}${label}: ${b.text}${b.cue ? `\n→ ${b.cue}` : ''}`;
  }).join('\n\n');
}

export function stats(beats = []) {
  const words = beats.reduce((sum, b) => sum + String(b.text || '').split(/\s+/).filter(Boolean).length, 0);
  const kinds = new Set(beats.map((b) => b.kind));
  return {
    count: beats.length,
    words,
    seconds: Math.round(words / 2.6),
    missing: ['hook', 'prova', 'cta'].filter((k) => !kinds.has(k)),
    coverage: Math.round((KINDS.filter((k) => kinds.has(k.id)).length / KINDS.length) * 100),
  };
}

// Word boundary Unicode: \b não reconhece letras acentuadas em JS.
// \p{L} = letra Unicode, \p{N} = número Unicode. Flag u obrigatória.
const WB = '(?<![\\p{L}\\p{N}_])';
const WA = '(?![\\p{L}\\p{N}_])';

const AI_TELLS = [
  [/(é importante (?:ressaltar|destacar|notar)|vale (?:ressaltar|destacar|notar|lembrar)) que\s*(isso\s+)?/gi, ''],
  [new RegExp(`${WB}(não é (?:apenas|só|somente)) ([^,.!?]+), (?:é|mas sim) ([^.!?]+)`, 'gi'), '$2 importa, mas o ponto é $3'],
  [new RegExp(`${WB}(além disso|ademais|outrossim|dessa forma|desse modo|por conseguinte),?\\s*`, 'gi'), 'E '],
  [/\b(no entanto|entretanto|contudo),?\s*/gi, 'Mas '],
  [/\b(portanto|assim sendo|logo),?\s*/gi, 'Então '],
  [/\b(em suma|em conclusão|por fim|para concluir|por último),?\s*/gi, ''],
  [/\b(no vídeo de hoje|neste vídeo|hoje eu vou|hoje vamos|vamos mergulhar)\b[,:]?\s*/gi, ''],
  [/\b(incrivelmente|extremamente|absolutamente|simplesmente|realmente|literalmente)\s+/gi, ''],
  [/\b(revolucion[áa]rio|divisor de [áa]guas|game ?changer)\b/gi, 'diferente'],
  [/\b(de forma|de maneira) geral\b,?\s*/gi, ''],
  [/(é fundamental|é essencial|é crucial)\b/gi, 'importa'],
  [/\s*—\s*/g, ', '],
  [/\s*–\s*/g, ', '],
  [/\s{2,}/g, ' '],
];

export function humanize(text = '') {
  let out = String(text);
  for (const [re, replacement] of AI_TELLS) out = out.replace(re, replacement);
  out = out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s])/g, '$1 ')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (m, prefix, letter) => prefix + letter.toUpperCase());
  return out.trim();
}

export function humanizeBeats(beats = []) {
  let changed = 0;
  const next = beats.map((b) => {
    const text = humanize(b.text);
    if (text !== b.text) changed += 1;
    return { ...b, text };
  });
  return { beats: next, changed };
}

export function suggestFor({ item = {}, ref = null } = {}) {
  const out = [];
  const add = (id, label, detail, priority = 'media') => out.push({ id, label, detail, priority });
  const beats = item.beats || [];
  const st = stats(beats);
  const has = (kind) => beats.some((b) => b.kind === kind);
  const platforms = item.platforms || [];

  if (ref?.views && ref?.publishedAt) {
    const score = ref.score || viralScore(ref);
    if (score >= 70) add('outlier', 'Outlier confirmado', `Score ${score}: o formato venceu, não só o tema. Replique o esqueleto e troque o assunto.`, 'alta');
    if (engagement(ref) >= 8) add('engajamento', 'Engajamento acima de 8%', 'Responda os primeiros comentários em até 2h e fixe uma pergunta no topo.', 'alta');
    if (viewsPerDay(ref) >= 200_000) add('janela', 'Janela quente', 'Publique em até 48h: a velocidade de views cai rápido nesse tipo de pauta.', 'alta');
  }
  if (!beats.length) add('sem-roteiro', 'Roteiro vazio', 'Gere pelo Estúdio para partir de hook, prova, desenvolvimento e CTA.', 'alta');
  if (beats.length && !has('hook')) add('hook', 'Falta hook', 'Os 3 primeiros segundos decidem a retenção. Abra no detalhe, sem intro.', 'alta');
  if (beats.length && !has('prova')) add('prova', 'Falta prova visual', 'Mostre o frame, print ou fonte antes dos 15% do vídeo.', 'alta');
  if (item.duration && st.seconds < item.duration * 0.5) add('duracao', 'Roteiro curto para a duração alvo', `${durationLabel(st.seconds)} falados para ${durationLabel(item.duration)} de vídeo. Acrescente um bloco de desenvolvimento.`);
  if (!platforms.some((p) => ['shorts', 'tiktok', 'reels'].includes(p))) add('vertical', 'Sem corte vertical', 'Gere um derivado 9:16 com hook próprio para Shorts, TikTok e Reels.', 'media');
  if ((item.languages || []).length < 2) add('idiomas', 'Só um idioma', 'Ative pelo menos inglês e espanhol para multiplicar o alcance.', 'baixa');
  add('thumb', 'Thumbnail de 3 palavras', 'Máximo 3 palavras, contraste alto e um objeto grande. Sem texto miúdo.', 'baixa');
  add('cta', 'CTA em 80% do vídeo', 'Chame a ação antes do fim, não no último segundo. O fecho deve gerar loop.', 'baixa');
  add('loop', 'Loop no fecho', 'A última frase deve puxar de volta para o hook e reiniciar a retenção.', 'baixa');
  return out;
}

// ── Regras de empacotamento (yt-package + yt-viral) ────────────────────────
// Título e thumbnail são uma unidade. Truncamento: 60 (desktop) / 40 (mobile).
// Máx 2 palavras ALL-CAPS. Thumbnail: até 3 palavras, nunca repete o título.
// Número, nome ou data batem qualquer adjetivo.
const YT_PACK = {
  desktop: 60,
  mobile: 40,
  maxAllCaps: 2,
  maxThumbWords: 3,
  outlierMultiple: 2.0,
};

function truncateTitle(t, n) {
  t = String(t || '').trim();
  return t.length > n ? t.slice(0, n - 1).trim() + '…' : t;
}

function allCapsCount(t) {
  return (String(t).match(/\b[A-ZÀ-Ú]{3,}\b/g) || []).length;
}

function thumbWords(topic, limit = YT_PACK.maxThumbWords) {
  return String(topic || '')
    .replace(/[^A-Za-zÀ-ÿ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, limit)
    .join(' ')
    .toUpperCase();
}

function viralTitleRank(titles = []) {
  return titles.map((t) => {
    const t60 = truncateTitle(t, YT_PACK.desktop);
    const t40 = truncateTitle(t, YT_PACK.mobile);
    const caps = allCapsCount(t);
    const score = 100
      - Math.max(0, caps - YT_PACK.maxAllCaps) * 20
      - (t.length > YT_PACK.desktop ? 15 : 0)
      - (t.length > YT_PACK.mobile && t.length <= YT_PACK.desktop ? 8 : 0)
      + (/\d/.test(t) ? 10 : 0)
      + (/[!?:]/.test(t) ? 5 : 0);
    return { title: t, desktop: t60, mobile: t40, caps, score };
  }).sort((a, b) => b.score - a.score);
}

export function viralPack(item = {}) {
  const titles = item.titleOptions?.length ? item.titleOptions : [item.title].filter(Boolean);
  const topic = item.topic || topicOf(item.title || '');
  const ranked = viralTitleRank(titles);
  const winner = ranked[0] || { title: item.title || '', desktop: '', mobile: '', caps: 0, score: 0 };
  const thumb = thumbWords(topic || winner.title);
  const hasNumber = /\d/.test(winner.title || item.title || '');
  return {
    ranked,
    winner,
    thumbnail: thumb || '—',
    thumbnailBrief: [
      `Expressão: surpresa ou ponto de exclamação no frame congelado.`,
      `Framing: close-up no detalhe com destaque visual (caixa ou seta).`,
      `3 palavras: "${thumb || '—'}".`,
      `Fundo: contraste alto, área do detalhe em destaque.`,
      hasNumber ? 'Mantém o número do título — números clicam mais que adjetivos.' : '',
    ].filter(Boolean).join(' '),
  };
}

// ── Detecção de outlier por canal (yt-viral) ────────────────────────────────
// Ranqueia por múltiplo sobre a mediana do próprio canal, não por views brutas.
// Requer >=3 vídeos por canal para mediana própria; senão usa mediana do nicho.
function medianOf(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// ── Segmento de corte (clipe vertical) ─────────────────────────────────────
// Gera o EDL (edit decision list) que o gtavi-claudecode / ffmpeg consome.
// Não executa corte no navegador: apenas registra o que deve ser cortado.
export function clipSegment(video, startSec, endSec, { title, angle, sourceTitle } = {}) {
  const start = Math.max(0, Math.floor(Number(startSec || 0)));
  const end = Math.max(start + 1, Math.floor(Number(endSec || start + 60)));
  return {
    id: uid('clip'),
    sourceId: video.id || video.videoId || '',
    sourceTitle: sourceTitle || video.title || video.name || '',
    sourceChannel: video.channel || video.channelTitle || '',
    start,
    end,
    duration: end - start,
    title: title || clipTitle(video, start, end),
    angle: angle || inferAngle(video),
    status: 'planejado', // planejado | cortado | revisando | publicado
    createdAt: Date.now(),
  };
}

function clipTitle(video, start, end) {
  const t = topicOf(video.title || '');
  const m = Math.floor(start / 60);
  const s = start % 60;
  return `${t} — corte ${m}:${String(s).padStart(2, '0')}`;
}

export function findOutliers(videos = [], multiple = YT_PACK.outlierMultiple) {
  const byChannel = {};
  videos.forEach((v) => {
    byChannel[v.channel] = byChannel[v.channel] || [];
    byChannel[v.channel].push(v.views || 0);
  });
  const allViews = videos.map((v) => v.views || 0);
  const nicheMedian = medianOf(allViews);

  return videos
    .map((v) => {
      const chViews = byChannel[v.channel] || [];
      const ref = chViews.length >= 3 ? medianOf(chViews) : nicheMedian;
      const mult = ref > 0 ? (v.views || 0) / ref : 0;
      return { ...v, ref, mult, isOutlier: mult >= multiple };
    })
    .filter((v) => v.isOutlier)
    .sort((a, b) => b.mult - a.mult);
}

export function packageFor(item = {}) {
  const beats = item.beats?.length ? item.beats : scriptToBeats(item.script);
  const sources = item.sources || [];
  const titles = item.titleOptions?.length ? item.titleOptions : [item.title].filter(Boolean);
  const checks = (item.checks || []).map((id) => {
    const suggestion = suggestFor({ item }).find((s) => s.id === id);
    return `- [x] ${suggestion?.label || id}`;
  });
  const tags = Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '—');
  const pack = viralPack(item);
  return [
    `# ${item.title || 'Roteiro sem título'}`,
    '',
    `**Ângulo:** ${ANGLES.find((a) => a.id === item.angle)?.name || item.angle || '—'}`,
    `**Duração alvo:** ${durationLabel(item.duration)}`,
    `**Plataformas:** ${(item.platforms || []).join(', ') || '—'}`,
    `**Idiomas:** ${(item.languages || []).join(', ') || '—'}`,
    '',
    '## Títulos',
    ...pack.ranked.map((t) => `- ${t.desktop}  (mobile: ${t.mobile} · score ${t.score})`),
    '',
    '## Thumbnail',
    pack.thumbnail,
    pack.thumbnailBrief ? `> ${pack.thumbnailBrief}` : '',
    '',
    '## Roteiro',
    '',
    ...beats.flatMap((b) => [
      `### ${b.time ? `${b.time} · ` : ''}${kindById(b.kind).label}`,
      b.text,
      b.cue ? `> ${b.cue}` : '',
      '',
    ]),
    '## Descrição',
    item.description || '—',
    '',
    '## Tags',
    tags,
    '',
    '## Referências',
    ...(sources.length ? sources.map((s) => `- ${s.title}${s.url ? ` — ${s.url}` : ''}`) : ['- Nenhuma referência registrada.']),
    '',
    '## Checklist',
    ...(checks.length ? checks : ['- [ ] Gerar checklist no Estúdio']),
    '',
    '---',
    'Replicação de formato e estrutura. Não reutilize arquivo, áudio ou vídeo de terceiros.',
  ].filter((line) => line !== undefined).join('\n');
}

export function mergeScripts(entries = []) {
  const list = entries.filter(Boolean).map((entry) => {
    const beats = entry.beats?.length
      ? entry.beats
      : buildScript({ video: entry.video || entry, title: entry.title, angle: entry.angle }).beats;
    return {
      ...entry,
      beats,
      views: entry.views || entry.sources?.[0]?.views || 0,
      duration: entry.duration || targetSeconds(entry.video || entry, null),
      angle: entry.angle || inferAngle(entry),
    };
  }).filter((entry) => entry.beats.length);

  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => b.views - a.views);
  const topics = [...new Set(list.map((entry) => topicOf(entry.sources?.[0]?.title || entry.title)))];
  const label = (t) => (nicheName() && !t.toLowerCase().includes(brandKey()) ? `${nicheName()}: ${t}` : t);
  const bare = (t) => (nicheName() ? t.replace(new RegExp(`^${nicheName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:–—-]\\s*`, 'i'), '') : t);
  const dedupe = (beats) => {
    const seen = new Set();
    return beats.filter((b) => {
      const key = String(b.text || '').toLowerCase().replace(/[^\wà-ÿ]+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const from = (kind) => sorted.map((entry) => entry.beats.find((b) => b.kind === kind)).filter(Boolean);
  const developments = [];
  list.forEach((entry) => entry.beats.filter((b) => b.kind === 'desenvolvimento').slice(0, 2).forEach((b) => developments.push(b)));

  const beats = dedupe([
    ...from('hook').slice(0, 1),
    ...from('contexto').slice(0, 1),
    ...from('prova').slice(0, 3),
    ...developments.slice(0, 4),
    ...from('virada').slice(0, 1),
    ...from('cta').slice(0, 1),
  ]).map((b) => ({ ...b, id: uid('b') }));

  const durations = list.map((entry) => entry.duration || 60);
  const total = Math.round(Math.max(60, durations.reduce((sum, d) => sum + d, 0) / durations.length) * 1.05);
  const timed = reschedule(beats, total);
  const baseTopics = topics.map(bare);
  const head = label(baseTopics[0]);
  const titleOptions = [
    `${head} — a conexão que ninguém fez`,
    `${head} e mais ${Math.max(list.length - 1, 1)} — o que isso muda`,
    `${list.length} referências, uma leitura: ${clip(baseTopics[0], 40)}`,
  ].map((t) => clip(t, 74));
  const sources = list.flatMap((entry) => entry.sources || (entry.video ? [sourceFromVideo(entry.video)] : []));
  const uniqueSources = sources.filter((s, i, arr) => s.videoId && arr.findIndex((x) => x.videoId === s.videoId) === i);
  const hook = timed.find((b) => b.kind === 'hook')?.text || '';

  return {
    beats: timed,
    hook,
    title: titleOptions[0],
    titleOptions,
    angle: 'mescla',
    duration: total,
    description: descriptionFor({ hook, title: titleOptions[0], angle: 'mescla', topic: topics[0], sources: uniqueSources, beats: timed }),
    tags: [...new Set(list.flatMap((entry) => tagsFor(entry.angle, entry.title)))].slice(0, 10),
    thumbnail: thumbnailFor(topics[0]),
    sources: uniqueSources,
    mergedFrom: topics,
  };
}
