import { state, save, uid } from './store.js';
import { buildScript, scriptText, sourceFromVideo, inferAngle } from './script.js';

function platformsFor(angle, duration) {
  const list = new Set(['youtube', 'shorts', 'tiktok']);
  if (duration <= 120) {
    list.delete('youtube');
    list.add('reels');
  }
  if (['noticia', 'preco', 'comparacao', 'polemica'].includes(angle)) list.add('facebook');
  return [...list].slice(0, 4);
}

function activeLanguages() {
  return state.languages.filter((l) => l.active).slice(0, 3).map((l) => l.code);
}

export function createItemFromScript(ctx, script, { title, stage = 'ideia', sources, platforms, languages, notes } = {}) {
  if (!script?.beats?.length) return null;
  const tags = Array.isArray(script.tags) ? script.tags.join(', ') : script.tags || '';
  const item = {
    id: uid('pl'),
    nicheId: ctx.niche.id,
    title: title || script.titleOptions?.[0] || script.title || 'Novo roteiro',
    formatId: '',
    stage,
    platforms: platforms || script.platforms || platformsFor(script.angle, script.duration),
    languages: languages || activeLanguages(),
    hook: script.hook || '',
    script: scriptText(script.beats),
    beats: script.beats,
    titleOptions: script.titleOptions || [],
    description: script.description || '',
    tags,
    thumbnail: script.thumbnail || '',
    angle: script.angle || 'curiosidade',
    duration: script.duration || 0,
    sources: sources || script.sources || [],
    checks: [],
    due: '',
    publishAt: '',
    notes: notes ?? (sources?.length ? `Mescla de ${sources.length} referências.` : ''),
    createdAt: new Date().toISOString(),
  };
  state.pipeline.push(item);
  save();
  return item;
}

export function createItemsFromVideos(ctx, videos = []) {
  const existing = new Set(
    state.pipeline.filter((p) => p.nicheId === ctx.niche.id && p.sourceVideoId).map((p) => p.sourceVideoId),
  );
  let created = 0;
  videos.forEach((video) => {
    if (!video?.id || existing.has(video.id)) return;
    const angle = inferAngle(video);
    const script = buildScript({ video, angle });
    const item = createItemFromScript(ctx, script, { sources: [sourceFromVideo(video)], notes: '' });
    if (!item) return;
    item.sourceVideoId = video.id;
    existing.add(video.id);
    created += 1;
  });
  if (created) save();
  return created;
}
