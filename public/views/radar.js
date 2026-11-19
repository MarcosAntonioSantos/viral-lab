import { state, save, setFeed, hasApiKey } from '../lib/store.js';
import { viralScore, viewsPerDay, engagement, daysSince, median } from '../lib/metrics.js';
import { searchVideos, videosByIds, channelsByIds } from '../lib/api.js';
import { DEMO_VIDEOS } from '../lib/seed.js';
import {
  buildScript, inferAngle, topicOf, clip, sourceFromVideo, suggestFor, stats,
  ANGLES, durationLabel, scriptText, clipSegment,
} from '../lib/script.js';
import { beatsPreview, openMergeDialog } from '../lib/script-ui.js';
import { createItemsFromVideos, createItemFromScript } from '../lib/autopilot.js';
import * as ui from '../lib/ui.js';

const PERIODS = [
  [7, '7 d'],
  [30, '30 d'],
  [90, '90 d'],
  [365, '1 ano'],
];

const picked = new Set();

function filteredItems(ctx) {
  const niche = ctx.niche;
  const feed = niche ? state.feeds[niche.id] : null;
  const period = state.settings.period || 30;
  const term = (ctx.search || '').toLowerCase();
  let items = (feed?.items || []).filter((v) => daysSince(v.publishedAt) <= period + 0.5);
  if (term) {
    items = items.filter((v) =>
      `${v.title} ${v.channelTitle} ${v.tags || ''}`.toLowerCase().includes(term));
  }
  const sort = state.settings.sort || 'score';
  const sorters = {
    score: (a, b) => viralScore(b) - viralScore(a),
    views: (a, b) => b.views - a.views,
    vpd: (a, b) => viewsPerDay(b) - viewsPerDay(a),
    engagement: (a, b) => engagement(b) - engagement(a),
  };
  return items.sort(sorters[sort] || sorters.score);
}

function kpis(items) {
  const totalViews = items.reduce((sum, v) => sum + v.views, 0);
  const medVpd = median(items.map(viewsPerDay));
  const hot = items.filter((v) => viralScore(v) >= 70).length;
  return `
    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Vídeos no recorte</span><div class="kpi-value">${items.length}</div><span class="kpi-note">após filtro de período</span></div>
      <div class="kpi"><span class="kpi-label">Views somadas</span><div class="kpi-value">${ui.num(totalViews)}</div><span class="kpi-note">potencial do tema no período</span></div>
      <div class="kpi"><span class="kpi-label">Mediana de views/dia</span><div class="kpi-value">${ui.num(medVpd)}</div><span class="kpi-note">velocidade típica da amostra</span></div>
      <div class="kpi"><span class="kpi-label">Virais (score ≥ 70)</span><div class="kpi-value">${hot} <small>/ ${items.length}</small></div><span class="kpi-note">candidatos a replicação</span></div>
    </div>`;
}

function row(v, i) {
  return `<tr data-video="${ui.esc(v.id)}">
    <td class="rank"><label class="pickbox"><input type="checkbox" class="pick" data-pick="${ui.esc(v.id)}" ${picked.has(v.id) ? 'checked' : ''} aria-label="Selecionar vídeo"><span>${String(i + 1).padStart(2, '0')}</span></label></td>
    <td>
      <div class="vid">
        ${ui.thumb(v, 86)}
        <div class="vid-meta">
          <div class="vid-title">${ui.esc(v.title)}</div>
          <div class="vid-channel"><b>${ui.esc(v.channelTitle)}</b>${v.channelSubs ? `· ${ui.num(v.channelSubs)} inscritos` : ''}${v.demo ? ' · demo' : ''}</div>
        </div>
      </div>
    </td>
    <td class="num muted">${ui.ago(v.publishedAt)}</td>
    <td class="num">${ui.num(v.views)}</td>
    <td class="num">${ui.num(viewsPerDay(v))}</td>
    <td class="num">${ui.pct(engagement(v))}</td>
    <td>${ui.scoreBar(viralScore(v))}</td>
    <td class="nowrap">
      <button class="btn-icon" data-open="${ui.esc(v.id)}" title="Ficha de replicação"><svg class="ico"><use href="#i-target"/></svg></button>
      <button class="btn-icon" data-pipe="${ui.esc(v.id)}" title="Criar roteiro no pipeline"><svg class="ico"><use href="#i-plus"/></svg></button>
    </td>
  </tr>`;
}

function suggestionsFor(v, script) {
  return suggestFor({
    item: {
      beats: script.beats,
      duration: script.duration,
      platforms: ['youtube', 'shorts', 'tiktok'],
      languages: state.languages.filter((l) => l.active).map((l) => l.code),
    },
    ref: sourceFromVideo(v),
  }).slice(0, 4);
}

function previewHtml(script, v) {
  const st = stats(script.beats);
  return `
    <div class="script-stats" style="margin-bottom:11px">
      <span><b>${st.count}</b> blocos</span>
      <span><b>${durationLabel(st.seconds)}</b> falados</span>
      <span><b>${durationLabel(script.duration)}</b> alvo</span>
      <span><b>${ANGLES.find((a) => a.id === script.angle)?.name || script.angle}</b> ângulo</span>
    </div>
    ${beatsPreview(script.beats, { limit: 6 })}
    <div class="field" style="margin-top:14px"><label>Títulos sugeridos</label>
      <div class="source-list">${script.titleOptions.map((t) => `<span class="source-chip">${ui.esc(t)}</span>`).join('')}</div>
    </div>
    <div class="field" style="margin-top:14px"><label>O que aplicar</label>
      <div class="prose" style="font-size:12px"><ul>${suggestionsFor(v, script).map((s) => `<li><strong>${ui.esc(s.label)}:</strong> ${ui.esc(s.detail)}</li>`).join('')}</ul></div>
    </div>`;
}

export function openVideo(v, ctx) {
  const niche = ctx.niche;
  const activeLangs = state.languages.filter((l) => l.active);
  const platforms = state.platforms.filter((p) => p.status !== 'off');
  const demoNote = v.demo
    ? '<p class="muted" style="font-size:11px;margin-top:8px">Item de demonstração — números fictícios.</p>'
    : `<p class="muted" style="font-size:11px;margin-top:8px"><a href="https://youtu.be/${ui.esc(v.id)}" target="_blank" rel="noopener" style="color:var(--pink)">Abrir no YouTube ↗</a></p>`;

  let angle = inferAngle(v);
  let minutes = Math.max(1, Math.round((v.duration || 480) / 60));
  let current = buildScript({ video: v, angle, duration: minutes * 60 });

  const body = `
    <div class="video-hero">
      ${ui.thumb(v, 168)}
      <div>
        <h3>${ui.esc(v.title)}</h3>
        <p>${ui.esc(v.channelTitle)} · ${ui.ago(v.publishedAt)}</p>
        ${demoNote}
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat"><span>Views</span><b>${ui.num(v.views)}</b></div>
      <div class="stat"><span>Views / dia</span><b>${ui.num(viewsPerDay(v))}</b></div>
      <div class="stat"><span>Engajamento</span><b>${ui.pct(engagement(v))}</b></div>
      <div class="stat"><span>Score</span><b>${viralScore(v)}</b></div>
    </div>

    <form class="form" id="vf">
      <div class="form-row">
        <div class="field"><label for="vf_name">Nome do formato</label>
          <input class="input" id="vf_name" value="${ui.esc(`Replicar: ${clip(topicOf(v.title), 52)}`)}">
        </div>
        <div class="field"><label for="vf_dur">Duração alvo (min)</label>
          <input class="input" id="vf_dur" type="number" min="0.5" step="0.5" value="${minutes}">
        </div>
      </div>
      <div class="field"><label for="vf_angle">Ângulo / gatilho</label>
        <select class="select" id="vf_angle">
          ${ANGLES.filter((a) => a.id !== 'mescla').map((a) => `<option value="${a.id}" ${angle === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
      </div>

      <div class="field"><label>Roteiro inferido</label>
        <div class="callout" style="margin-bottom:11px">Gerado a partir do título, da duração e do ângulo. É uma estrutura para editar — não uma cópia do vídeo original.</div>
        <div id="vf_preview">${previewHtml(current, v)}</div>
      </div>

      <div class="field"><label>Plataformas de destino</label>
        <div class="check-grid">
          ${platforms.map((p) => `<label class="check"><input type="checkbox" name="vf_plat" value="${p.id}" ${['youtube', 'shorts', 'tiktok'].includes(p.id) ? 'checked' : ''}>${ui.esc(p.name)}</label>`).join('')}
        </div>
      </div>
      <div class="field"><label>Idiomas</label>
        <div class="check-grid">
          ${activeLangs.map((l) => `<label class="check"><input type="checkbox" name="vf_lang" value="${l.code}" checked>${l.flag} ${ui.esc(l.name)}</label>`).join('')}
        </div>
      </div>
      <div class="field"><label for="vf_notes">Observações de produção</label>
        <textarea class="textarea" id="vf_notes" style="min-height:64px" placeholder="Materiais, fontes, cuidados com direitos…"></textarea>
      </div>
      <div class="field"><label>Corte vertical (clipe)</label>
        <div class="form-row">
          <div class="field"><label for="vf_clipStart">Início (s)</label>
            <input class="input" id="vf_clipStart" type="number" min="0" step="1" value="0">
          </div>
          <div class="field"><label for="vf_clipEnd">Fim (s)</label>
            <input class="input" id="vf_clipEnd" type="number" min="1" step="1" value="${Math.min(60, v.duration || 60)}">
          </div>
        </div>
        <div class="field"><label for="vf_clipTitle">Título do clipe</label>
          <input class="input" id="vf_clipTitle" value="${ui.esc(topicOf(v.title))}">
        </div>
        <div class="check-grid" style="margin-top:8px">
          ${platforms.filter((p) => ['shorts','tiktok','reels'].includes(p.id)).map((p) => `<label class="check"><input type="checkbox" name="vf_clipPlat" value="${p.id}" checked>${ui.esc(p.name)}</label>`).join('')}
        </div>
        <div id="vf_clipList" style="margin-top:10px"></div>
        <button type="button" class="btn btn-sm" id="vf_exportEdl" style="margin-top:8px"><svg class="ico"><use href="#i-download"/></svg>Exportar cortes (EDL)</button>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" id="vf_copy"><svg class="ico"><use href="#i-copy"/></svg>Copiar roteiro</button>
        <button type="button" class="btn" id="vf_saveFormat">Salvar como formato</button>
        <button type="button" class="btn btn-primary" id="vf_savePipe">Criar no pipeline</button>
        <button type="button" class="btn" id="vf_markClip"><svg class="ico"><use href="#i-spark"/></svg>Marcar clipe</button>
      </div>
    </form>`;

  const d = ui.openSheet({ kicker: 'Ficha de replicação', title: 'Transformar em produção', body, wide: true, onMount: (dialog) => {
    const read = () => ({
      name: dialog.querySelector('#vf_name').value.trim() || `Replicar: ${v.title.slice(0, 54)}`,
      minutes: Number(dialog.querySelector('#vf_dur').value) || minutes,
      angle: dialog.querySelector('#vf_angle').value,
      notes: dialog.querySelector('#vf_notes').value.trim(),
      platforms: [...dialog.querySelectorAll('input[name="vf_plat"]:checked')].map((i) => i.value),
      langs: [...dialog.querySelectorAll('input[name="vf_lang"]:checked')].map((i) => i.value),
    });

    const rebuild = () => {
      const data = read();
      angle = data.angle;
      minutes = data.minutes;
      current = buildScript({ video: v, angle, duration: minutes * 60 });
      dialog.querySelector('#vf_preview').innerHTML = previewHtml(current, v);
    };

    dialog.querySelector('#vf_angle').addEventListener('change', rebuild);
    dialog.querySelector('#vf_dur').addEventListener('change', rebuild);

    dialog.querySelector('#vf_copy').addEventListener('click', () => {
      ui.copyText(scriptText(current.beats), 'Roteiro copiado');
    });

    dialog.querySelector('#vf_saveFormat').addEventListener('click', () => {
      const data = read();
      state.formats.push({
        id: `fmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        nicheId: niche.id,
        name: data.name,
        duration: `${data.minutes} min`,
        tags: [data.angle],
        hook: current.hook,
        steps: current.beats.map((b) => b.text),
        platforms: data.platforms,
        notes: data.notes || 'Estrutura inferida a partir da referência. Ajuste antes de produzir.',
        sourceVideoId: v.id,
        createdAt: new Date().toISOString(),
      });
      save();
      dialog.close();
      ui.toast('Formato salvo na biblioteca');
      ctx.refresh();
    });

    dialog.querySelector('#vf_savePipe').addEventListener('click', () => {
      const data = read();
      const item = createItemFromScript(ctx, current, {
        sources: [sourceFromVideo(v)],
        platforms: data.platforms,
        languages: data.langs,
        notes: data.notes,
      });
      if (!item) return ui.toast('Não foi possível criar o item.', 'error');
      item.sourceVideoId = v.id;
      save();
      dialog.close();
      ui.toast('Roteiro criado no pipeline');
      ctx.refresh();
    });

    const renderClipList = () => {
      const mine = state.clips.filter((c) => c.sourceId === v.id);
      const list = dialog.querySelector('#vf_clipList');
      if (!list) return;
      list.innerHTML = mine.map((c) => `
        <div class="source-chip" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin:4px 0;padding:6px 8px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px">
          <span title="${ui.esc(c.title)}">${ui.esc(c.title)}</span>
          <span style="color:var(--dim)">${c.start}s → ${c.end}s (${c.duration}s) · ${c.status}</span>
          <button class="btn-icon" data-clip-del="${c.id}" title="Remover"><svg class="ico"><use href="#i-x"/></svg></button>
        </div>`).join('');
      list.querySelectorAll('[data-clip-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.clips = state.clips.filter((c) => c.id !== btn.dataset.clipDel);
          save();
          renderClipList();
          ui.toast('Clipe removido');
        });
      });
    };

    dialog.querySelector('#vf_markClip').addEventListener('click', () => {
      const start = Number(dialog.querySelector('#vf_clipStart').value) || 0;
      const end = Number(dialog.querySelector('#vf_clipEnd').value) || start + 60;
      if (end <= start) return ui.toast('O fim deve ser maior que o início.', 'error');
      const title = dialog.querySelector('#vf_clipTitle').value.trim() || topicOf(v.title);
      const platChecked = [...dialog.querySelectorAll('input[name="vf_clipPlat"]:checked')].map((i) => i.value);
      const clip = clipSegment(v, start, end, {
        title,
        angle: dialog.querySelector('#vf_angle').value,
        sourceTitle: v.title,
      });
      clip.platforms = platChecked;
      state.clips.push(clip);
      save();
      renderClipList();
      dialog.querySelector('#vf_clipTitle').value = '';
      ui.toast('Clipe marcado para corte');
    });

    dialog.querySelector('#vf_exportEdl').addEventListener('click', () => {
      const mine = state.clips.filter((c) => c.sourceId === v.id);
      if (!mine.length) return ui.toast('Nenhum clipe marcado para este vídeo.', 'error');
      const edl = mine.map((c) => ({
        source: c.sourceTitle,
        channel: c.sourceChannel,
        start: c.start,
        end: c.end,
        title: c.title,
        angle: c.angle,
        platforms: c.platforms || [],
      }));
      const blob = new Blob([JSON.stringify(edl, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cortes_${v.id}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ui.toast(`${mine.length} corte(s) exportado(s) para EDL`);
    });

    renderClipList();
  } });
  return d;
}

async function syncFeed(ctx, btn) {
  const niche = ctx.niche;
  if (!hasApiKey()) {
    ui.toast('Salve sua chave da API primeiro.', 'error');
    location.hash = '#/config';
    return;
  }
  const queries = niche.queries.slice(0, 7);
  if (!queries.length) {
    ui.toast('Adicione termos de busca ao nicho em Configurações.', 'error');
    return;
  }

  const original = btn.innerHTML;
  btn.disabled = true;
  const period = Math.max(state.settings.period || 30, 90);
  const publishedAfter = new Date(Date.now() - period * 86_400_000).toISOString();
  const ids = new Set();
  let lastError = null;

  try {
    for (const [i, q] of queries.entries()) {
      btn.innerHTML = `<svg class="ico"><use href="#i-refresh"/></svg>Buscando ${i + 1}/${queries.length}…`;
      try {
        const found = await searchVideos({ q, publishedAfter, order: 'viewCount', max: 25 }, state.apiKey);
        found.forEach((id) => ids.add(id));
      } catch (err) {
        lastError = err;
        if (['quotaExceeded', 'dailyLimitExceeded', 'keyInvalid', 'accessNotConfigured', 'forbidden'].includes(err.reason)) break;
      }
    }

    if (!ids.size) throw lastError || new Error('Nenhum vídeo encontrado para as buscas do nicho.');

    btn.innerHTML = `<svg class="ico"><use href="#i-refresh"/></svg>Enriquecendo…`;
    const videos = await videosByIds([...ids].slice(0, 150), state.apiKey);
    const channels = await channelsByIds(videos.map((v) => v.channelId), state.apiKey);
    const byChannel = new Map(channels.map((c) => [c.id, c]));
    const merged = videos.map((v) => ({
      ...v,
      channelSubs: byChannel.get(v.channelId)?.subs || 0,
    }));
    setFeed(merged, 'api');
    ui.toast(`${merged.length} vídeos atualizados · ~${queries.length * 100} unidades de quota`);
    ctx.refresh();
  } catch (err) {
    ui.toast(err.message || 'Falha ao atualizar o radar.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function loadDemo(ctx) {
  setFeed(structuredClone(DEMO_VIDEOS), 'demo');
  state.settings.demo = true;
  save();
  ui.toast('Demonstração carregada — números fictícios');
  ctx.refresh();
}

export const radar = {
  render(ctx) {
    const niche = ctx.niche;
    const feed = niche ? state.feeds[niche.id] : null;
    const items = filteredItems(ctx);
    [...picked].forEach((id) => { if (!items.some((v) => v.id === id)) picked.delete(id); });
    const source = feed?.source;
    const fetched = feed?.fetchedAt ? `Atualizado ${ui.ago(feed.fetchedAt)}` : 'Nunca atualizado';

    const header = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Inteligência · ${ui.esc(niche?.name || 'nicho')}</span>
          <h1 class="page-title">Radar de virais</h1>
          <p class="page-sub">O que está crescendo no nicho, ranqueado por velocidade, engajamento e força contra a média do canal. Replique o formato — nunca o arquivo.</p>
        </div>
        <div class="head-actions">
          ${source === 'demo' ? '<button class="btn" id="radarClear">Limpar demo</button>' : '<button class="btn" id="radarDemo">Carregar demo</button>'}
          <button class="btn btn-primary" id="radarSync"><svg class="ico"><use href="#i-refresh"/></svg>Atualizar do YouTube</button>
        </div>
      </div>`;

    if (!feed || !feed.items?.length) {
      return `${header}
        <div class="empty">
          <div class="empty-art"><svg class="ico"><use href="#i-radar"/></svg></div>
          <h3>Radar vazio</h3>
          <p>Conecte a YouTube Data API para puxar os vídeos mais vistos do nicho. Cada atualização usa aproximadamente <b>100 unidades por busca</b> (6 buscas ≈ 600 de 10.000 diárias).</p>
          <div class="head-actions">
            <button class="btn btn-primary" id="radarSync2"><svg class="ico"><use href="#i-refresh"/></svg>Atualizar agora</button>
            <button class="btn" id="radarDemo2">Ver com dados de demonstração</button>
          </div>
        </div>`;
    }

    return `${header}
      ${source === 'demo' ? `<div class="demo-banner"><span class="badge demo">Demonstração</span> Números fictícios para validar o layout. Limpe e conecte a API para dados reais.<button class="btn btn-sm" id="radarClear">Limpar demo</button></div>` : ''}
      ${kpis(items)}
      <div class="toolbar">
        <div class="seg">${PERIODS.map(([d, label]) => `<button data-period="${d}" class="${(state.settings.period || 30) === d ? 'active' : ''}">${label}</button>`).join('')}</div>
        <select class="select" id="radarSort" style="width:190px;height:32px;font-size:12px">
          <option value="score" ${state.settings.sort === 'score' ? 'selected' : ''}>Ordenar por score</option>
          <option value="views" ${state.settings.sort === 'views' ? 'selected' : ''}>Mais views</option>
          <option value="vpd" ${state.settings.sort === 'vpd' || !state.settings.sort ? 'selected' : ''}>Mais views/dia</option>
          <option value="engagement" ${state.settings.sort === 'engagement' ? 'selected' : ''}>Mais engajamento</option>
        </select>
        <span class="spacer"></span>
        <button class="btn btn-sm" id="radarAuto"><svg class="ico"><use href="#i-bolt"/></svg>Automatizar top 5</button>
        <button class="btn btn-sm" id="radarMerge"><svg class="ico"><use href="#i-merge"/></svg>Mesclar <span id="pickCount">${picked.size}</span></button>
      </div>

      <div class="toolbar" style="margin-top:-4px">
        <span class="label">Buscas do nicho</span>
        ${niche.queries.map((q) => `<span class="chip">${ui.esc(q)}</span>`).join('')}
        <span class="spacer"></span>
        <span class="panel-sub">${fetched} · ${items.length} de ${feed.items.length} vídeos</span>
      </div>

      <div class="panel">
        <div class="table-scroll">
        <table class="vtable">
          <thead><tr>
            <th></th><th>Vídeo</th><th>Publicado</th><th>Views</th><th>Views/dia</th><th>Engaj.</th><th>Score</th><th></th>
          </tr></thead>
          <tbody>${items.length ? items.map((v, i) => row(v, i)).join('') : '<tr><td colspan="8" style="text-align:center;padding:34px;color:var(--dim)">Nenhum vídeo no recorte. Ajuste o período ou a busca.</td></tr>'}</tbody>
        </table>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const refresh = () => ctx.refresh();
    const wire = (id, fn) => {
      const el = root.querySelector(id);
      if (el) el.addEventListener('click', fn);
    };

    const sync = (btn) => syncFeed(ctx, btn);
    wire('#radarSync', (e) => sync(e.currentTarget));
    wire('#radarSync2', (e) => sync(e.currentTarget));
    wire('#radarDemo', () => loadDemo(ctx));
    wire('#radarDemo2', () => loadDemo(ctx));
    wire('#radarClear', () => {
      state.feeds[ctx.niche.id] = { source: 'api', fetchedAt: null, items: [] };
      picked.clear();
      save();
      refresh();
    });

    root.querySelectorAll('[data-period]').forEach((b) => {
      b.addEventListener('click', () => {
        state.settings.period = Number(b.dataset.period);
        save();
        refresh();
      });
    });

    const sort = root.querySelector('#radarSort');
    if (sort) sort.addEventListener('change', () => {
      state.settings.sort = sort.value;
      save();
      refresh();
    });

    const items = filteredItems(ctx);
    const find = (id) => items.find((v) => v.id === id);

    root.querySelectorAll('[data-pick]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) picked.add(input.dataset.pick);
        else picked.delete(input.dataset.pick);
        const counter = root.querySelector('#pickCount');
        if (counter) counter.textContent = picked.size;
      });
    });

    root.querySelector('#radarAuto')?.addEventListener('click', () => {
      const top = items.slice(0, 5);
      const created = createItemsFromVideos(ctx, top);
      ui.toast(created ? `${created} roteiro(s) criado(s) no pipeline` : 'As referências do top já estão no pipeline.');
    });

    root.querySelector('#radarMerge')?.addEventListener('click', () => {
      const chosen = items.filter((v) => picked.has(v.id));
      if (chosen.length < 2) return ui.toast('Marque pelo menos dois vídeos para mesclar.', 'error');
      openMergeDialog({
        entries: chosen.map((v) => buildScript({ video: v })),
        kicker: 'Mesclar referências',
        title: 'Roteiro híbrido',
        onApply: (merged) => {
          const item = createItemFromScript(ctx, merged, {
            sources: chosen.map(sourceFromVideo),
            notes: `Mescla de ${chosen.length} referências do Radar.`,
          });
          if (!item) return ui.toast('Não foi possível criar o híbrido.', 'error');
          picked.clear();
          ui.toast('Roteiro híbrido criado no pipeline');
          refresh();
        },
      });
    });

    root.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = find(btn.dataset.open);
        if (v) openVideo(v, ctx);
      });
    });

    root.querySelectorAll('[data-pipe]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = find(btn.dataset.pipe);
        if (!v) return;
        const created = createItemsFromVideos(ctx, [v]);
        ui.toast(created ? 'Roteiro criado no pipeline' : 'Este vídeo já está no pipeline.');
      });
    });

    root.querySelectorAll('tr[data-video]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('input, button, label')) return;
        const v = find(tr.dataset.video);
        if (v) openVideo(v, ctx);
      });
    });
  },
};
