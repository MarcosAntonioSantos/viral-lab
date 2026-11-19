import { state, save, activeNiche, uid, nicheFormats, platformById, feedItems } from '../lib/store.js';
import * as ui from '../lib/ui.js';
import {
  KINDS, ANGLES, buildScript, scriptToBeats, scriptText, reschedule,
  humanize, humanizeBeats, suggestFor, stats, packageFor, fillBlock, topicOf,
  titleVariants, durationLabel, mergeScripts, targetSeconds,
} from '../lib/script.js';

export const STAGES = [
  { id: 'ideia', name: 'Ideia' },
  { id: 'roteiro', name: 'Roteiro' },
  { id: 'producao', name: 'Produção' },
  { id: 'localizacao', name: 'Localização' },
  { id: 'pronto', name: 'Pronto' },
  { id: 'publicado', name: 'Publicado' },
];

const stageName = (id) => STAGES.find((s) => s.id === id)?.name || id;

function itemCard(item) {
  const plat = (item.platforms || []).slice(0, 4).map((id) => {
    const p = platformById(id);
    return `<span class="pdot" title="${ui.esc(p?.name || id)}">${ui.esc((p?.name || id).slice(0, 3))}</span>`;
  }).join('');
  const when = item.publishAt
    ? `<span class="badge">${ui.dateShort(item.publishAt)}</span>`
    : item.due
      ? `<span class="badge warn">prazo ${ui.dateShort(item.due)}</span>`
      : '';
  const st = stats(item.beats?.length ? item.beats : scriptToBeats(item.script));
  const scriptBadge = st.count
    ? `<span class="badge ${st.missing.length ? '' : 'ok'}">${st.count} blocos</span>`
    : '<span class="badge warn">sem roteiro</span>';
  return `<article class="kcard" draggable="true" data-id="${ui.esc(item.id)}">
    <div class="kcard-title">${ui.esc(item.title)}</div>
    <div class="kcard-foot">
      ${plat}
      ${scriptBadge}
      ${item.sources?.length > 1 ? `<span class="badge">${item.sources.length} fontes</span>` : ''}
      ${item.languages?.length ? `<span class="badge">${item.languages.length} idiomas</span>` : ''}
      ${when}
    </div>
  </article>`;
}

function beatsOf(item) {
  if (Array.isArray(item.beats) && item.beats.length) return item.beats.map((b) => ({ ...b }));
  if (item.script) return scriptToBeats(item.script);
  return [];
}

function sourcesOf(item) {
  if (Array.isArray(item.sources) && item.sources.length) return item.sources.map((s) => ({ ...s }));
  if (item.sourceVideoId) {
    return [{ id: item.sourceVideoId, videoId: item.sourceVideoId, title: item.title || '', channel: '', views: 0 }];
  }
  return [];
}

const minutesOf = (seconds) => (seconds ? Number((seconds / 60).toFixed(1)) : '');

export function openItemEditor(ctx, item = null, prefill = {}) {
  const niche = ctx.niche || activeNiche();
  const formatList = nicheFormats();
  const base = item
    ? structuredClone(item)
    : {
      id: uid('pl'),
      nicheId: niche?.id,
      title: '',
      formatId: '',
      stage: 'ideia',
      platforms: ['youtube', 'shorts', 'tiktok'],
      languages: state.languages.filter((l) => l.active).map((l) => l.code),
      hook: '',
      script: '',
      clipFile: '',
      clipStatus: 'planejado',
      due: '',
      publishAt: '',
      notes: '',
      ...prefill,
    };

  let beats = beatsOf(base);
  let sources = sourcesOf(base);
  let titleOptions = base.titleOptions?.length ? [...base.titleOptions] : [];
  let checks = new Set(base.checks || []);
  let versions = base.versions || [];
  let activeTab = 'roteiro';

  const initialFormat = formatList.find((f) => f.id === base.formatId);
  let targetSec = Math.round(base.duration || sources[0]?.duration || targetSeconds(sources[0], initialFormat) || 480);
  if (beats.length) beats = reschedule(beats, targetSec);

  const selectedPlatforms = new Set(base.platforms || []);
  const selectedLangs = new Set(base.languages || []);
  const visibleLangs = state.languages.filter((l) => l.active || selectedLangs.has(l.code));

  const durationSeconds = () => {
    const input = document.querySelector('#it_duration');
    const minutes = Number(input?.value || 0);
    return minutes > 0 ? Math.round(minutes * 60) : targetSec;
  };

  const sourceOptions = () => feedItems()
    .filter((v) => !sources.some((s) => s.videoId === v.id))
    .slice(0, 20);

  const statsHtml = () => {
    const st = stats(beats);
    return `<span><b>${st.count}</b> blocos</span><span><b>${st.words}</b> palavras</span><span><b>${durationLabel(st.seconds)}</b> falados</span><span><b>${durationLabel(targetSec)}</b> alvo</span>${st.missing.length ? `<span class="badge warn">falta ${st.missing.join(', ')}</span>` : '<span class="badge ok">estrutura completa</span>'}`;
  };

  const beatsHtml = () => (beats.length ? beats.map((b, i) => `<div class="beat-row" data-beat="${ui.esc(b.id)}">
    <div class="beat-row-head">
      <span class="beat-num">${String(i + 1).padStart(2, '0')}</span>
      <select class="select beat-kind" data-field="kind" aria-label="Tipo de bloco">
        ${KINDS.map((k) => `<option value="${k.id}" ${b.kind === k.id ? 'selected' : ''}>${k.label}</option>`).join('')}
      </select>
      <span class="beat-time mono">${ui.esc(b.time || '—')}</span>
      <div class="beat-tools">
        <button type="button" class="btn-icon" data-act="up" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn-icon" data-act="down" title="Descer" ${i === beats.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn-icon" data-act="dup" title="Duplicar"><svg class="ico"><use href="#i-copy"/></svg></button>
        <button type="button" class="btn-icon" data-act="del" title="Remover"><svg class="ico"><use href="#i-trash"/></svg></button>
      </div>
    </div>
    <textarea class="textarea" data-field="text" placeholder="Fala ou direção do bloco">${ui.esc(b.text)}</textarea>
    <input class="input" data-field="cue" value="${ui.esc(b.cue || '')}" placeholder="Direção de cena / prova visual">
  </div>`).join('') : '<div class="kempty">Sem blocos. Clique em <b>Gerar roteiro</b>, insira um bloco da biblioteca ou adicione um bloco manual.</div>');

  const sourceChips = () => (sources.length ? sources.map((s) => `<span class="source-chip" data-source="${ui.esc(s.videoId || s.id)}">${ui.esc((s.title || 'Referência').slice(0, 46))}<button type="button" data-remove-source="${ui.esc(s.videoId || s.id)}" aria-label="Remover">×</button></span>`).join('') : '<span class="dim" style="font-size:11.5px">Nenhuma referência. Adicione do Radar ou gere a partir do formato.</span>');

  const titleChips = () => (titleOptions.length
    ? titleOptions.map((t) => `<button type="button" class="chip" data-use-title="${ui.esc(t)}">${ui.esc(t)}</button>`).join('')
    : '<span class="dim" style="font-size:11.5px">Gere títulos a partir do ângulo.</span>');

  const versionsHtml = () => (versions.length
    ? versions.map((v, i) => `<div class="version-row"><span>${new Date(v.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${ui.esc(v.title || 'versão anterior')}</span><span class="spacer" style="flex:1"></span><button type="button" class="btn btn-sm" data-restore="${i}">Restaurar</button><button type="button" class="btn-icon" data-copy-version="${i}" title="Copiar"><svg class="ico"><use href="#i-copy"/></svg></button></div>`).join('')
    : '<p class="dim" style="font-size:12px">O histórico começa na primeira edição salva.</p>');

  const body = `
    <form class="form" id="itemForm">
      <div class="form-row">
        <div class="field"><label for="it_title">Título / ideia</label>
          <input class="input" id="it_title" required value="${ui.esc(base.title)}" placeholder="Ex.: O detalhe do trailer que ninguém viu">
        </div>
        <div class="field"><label for="it_stage">Estágio</label>
          <select class="select" id="it_stage">
            ${STAGES.map((s) => `<option value="${s.id}" ${base.stage === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label for="it_format">Formato base</label>
          <select class="select" id="it_format">
            <option value="">— sem formato —</option>
            ${formatList.map((f) => `<option value="${f.id}" ${base.formatId === f.id ? 'selected' : ''}>${ui.esc(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="it_angle">Ângulo</label>
          <select class="select" id="it_angle">
            ${ANGLES.map((a) => `<option value="${a.id}" ${(base.angle || 'curiosidade') === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label for="it_duration">Duração alvo (min)</label>
          <input class="input" id="it_duration" type="number" min="0.5" step="0.5" value="${minutesOf(targetSec)}">
        </div>
        <div class="field"><label for="it_due">Prazo de produção</label>
          <input class="input" id="it_due" type="date" value="${ui.toDateInput(base.due)}">
        </div>
      </div>
      <div class="field"><label for="it_publish">Publicação (data e hora)</label>
        <input class="input" id="it_publish" type="datetime-local" value="${ui.toDateTimeInput(base.publishAt)}">
      </div>

      <div class="tabs" role="tablist">
        <button type="button" class="tab active" data-tab="roteiro">Roteiro</button>
        <button type="button" class="tab" data-tab="embalagem">Embalagem</button>
        <button type="button" class="tab" data-tab="checklist">Checklist</button>
        <button type="button" class="tab" data-tab="historico">Histórico${versions.length ? ` (${versions.length})` : ''}</button>
      </div>

      <section class="tab-panel active" data-panel="roteiro">
        <div class="toolbar" style="margin:0">
          <button type="button" class="btn" id="it_gen"><svg class="ico"><use href="#i-spark"/></svg>Gerar roteiro</button>
          <button type="button" class="btn" id="it_humanize"><svg class="ico"><use href="#i-bolt"/></svg>Humanizar</button>
          <button type="button" class="btn" id="it_merge"><svg class="ico"><use href="#i-merge"/></svg>Mesclar fontes</button>
          <span class="spacer"></span>
          <select class="select" id="it_block" style="width:225px;height:32px;font-size:12px">
            <option value="">+ Inserir bloco da biblioteca</option>
            ${KINDS.map((k) => {
              const list = state.blocks.filter((b) => b.kind === k.id && (!b.nicheId || b.nicheId === niche?.id));
              return list.length ? `<optgroup label="${k.label}">${list.map((b) => `<option value="${b.id}">${ui.esc(b.label || b.text.slice(0, 40))}</option>`).join('')}</optgroup>` : '';
            }).join('')}
          </select>
        </div>
        <div class="field" style="margin-top:10px"><label>Clipe cortado (EDL)</label>
          <div class="form-row" style="margin-top:6px">
            <div class="field"><input class="input" id="it_clipFile" type="file" accept="video/*"></div>
            <div class="field" style="width:1px"><button type="button" class="btn btn-sm" id="it_clipImport"><svg class="ico"><use href="#i-upload"/></svg>Importar clipe</button></div>
          </div>
          <div id="it_clipStatus" style="margin-top:6px;font-size:11px;color:var(--dim)">
            ${base.clipStatus === 'cortado' ? `✓ Clipe importado: ${ui.esc(base.clipFile || 'arquivo cortado')}` : `Status: <b style="color:var(--pink)">planejado</b> — aguardando clipe cortado`}
          </div>
        </div>
        <div class="script-stats" id="it_stats">${statsHtml()}</div>
        <div class="field"><label>Referências do roteiro</label>
          <div class="source-list" id="it_sources">${sourceChips()}</div>
          <select class="select" id="it_addSource" style="margin-top:7px">
            <option value="">+ Adicionar referência do Radar…</option>
            ${sourceOptions().map((v) => `<option value="${ui.esc(v.id)}">${ui.esc(v.title.slice(0, 64))} · ${ui.num(v.views)} views</option>`).join('')}
          </select>
        </div>
        <div class="beat-list" id="it_beats">${beatsHtml()}</div>
        <div class="head-actions">
          <button type="button" class="btn btn-sm" id="it_addBeat"><svg class="ico"><use href="#i-plus"/></svg>Bloco manual</button>
          <button type="button" class="btn btn-sm" id="it_copy"><svg class="ico"><use href="#i-copy"/></svg>Copiar roteiro</button>
          <button type="button" class="btn btn-sm" id="it_pkg"><svg class="ico"><use href="#i-download"/></svg>Exportar pacote</button>
        </div>
      </section>

      <section class="tab-panel" data-panel="embalagem">
        <div class="field"><label for="it_desc">Descrição</label>
          <textarea class="textarea" id="it_desc" style="min-height:140px" placeholder="Descrição com capítulos e referências">${ui.esc(base.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="field"><label for="it_tags">Tags (separadas por vírgula)</label>
            <input class="input" id="it_tags" value="${ui.esc(base.tags || '')}" placeholder="gta6, trailer, análise">
          </div>
          <div class="field"><label for="it_thumb">Texto da thumbnail</label>
            <input class="input" id="it_thumb" value="${ui.esc(base.thumbnail || '')}" placeholder="Máximo 3 palavras">
          </div>
        </div>
        <div class="field"><label>Títulos alternativos</label>
          <div class="source-list" id="it_titles">${titleChips()}</div>
          <div><button type="button" class="btn btn-sm" id="it_genTitles" style="margin-top:8px"><svg class="ico"><use href="#i-spark"/></svg>Gerar títulos</button></div>
        </div>
      </section>

      <section class="tab-panel" data-panel="checklist">
        <div class="toolbar" style="margin:0">
          <span class="panel-sub">Sugestões automáticas do que aplicar neste vídeo.</span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-sm" id="it_checkAll">Marcar todos</button>
          <button type="button" class="btn btn-sm" id="it_checkNone">Limpar</button>
        </div>
        <div id="it_checks" style="display:grid;gap:8px"></div>
      </section>

      <section class="tab-panel" data-panel="historico">
        <div id="it_versions">${versionsHtml()}</div>
      </section>

      <div class="form-row">
        <div class="field"><label>Plataformas</label>
          <div class="check-grid">
            ${state.platforms.map((p) => `<label class="check"><input type="checkbox" name="it_plat" value="${p.id}" ${selectedPlatforms.has(p.id) ? 'checked' : ''}>${ui.esc(p.name)}</label>`).join('')}
          </div>
        </div>
        <div class="field"><label>Idiomas</label>
          <div class="check-grid">
            ${visibleLangs.map((l) => `<label class="check"><input type="checkbox" name="it_lang" value="${l.code}" ${selectedLangs.has(l.code) ? 'checked' : ''}>${l.flag} ${ui.esc(l.name)}</label>`).join('')}
          </div>
          <span class="panel-sub">Ative mais idiomas em <b>Idiomas</b> para vê-los aqui.</span>
        </div>
      </div>
      <div class="field"><label for="it_notes">Notas</label>
        <textarea class="textarea" id="it_notes" style="min-height:64px">${ui.esc(base.notes)}</textarea>
      </div>
      <div class="form-actions">
        ${item ? '<button type="button" class="btn btn-danger" id="it_delete">Excluir</button>' : ''}
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar item</button>
      </div>
    </form>`;

  ui.openSheet({
    kicker: item ? stageName(item.stage) : 'Novo item',
    title: item ? 'Editar produção' : 'Nova produção',
    body,
    wide: true,
    onMount: (dialog) => {
      const durationInput = dialog.querySelector('#it_duration');
      const list = dialog.querySelector('#it_beats');

      const refreshStats = () => {
        const el = dialog.querySelector('#it_stats');
        if (el) el.innerHTML = statsHtml();
      };

      const renderBeats = () => {
        beats = reschedule(beats, durationSeconds());
        list.innerHTML = beatsHtml();
        refreshStats();
      };

      const renderSources = () => {
        dialog.querySelector('#it_sources').innerHTML = sourceChips();
        const select = dialog.querySelector('#it_addSource');
        select.innerHTML = `<option value="">+ Adicionar referência do Radar…</option>${sourceOptions().map((v) => `<option value="${ui.esc(v.id)}">${ui.esc(v.title.slice(0, 64))} · ${ui.num(v.views)} views</option>`).join('')}`;
      };

      const renderTitles = () => {
        dialog.querySelector('#it_titles').innerHTML = titleChips();
      };

      const snapshot = () => ({
        title: dialog.querySelector('#it_title').value.trim(),
        angle: dialog.querySelector('#it_angle').value,
        duration: durationSeconds(),
        platforms: [...dialog.querySelectorAll('input[name="it_plat"]:checked')].map((i) => i.value),
        languages: [...dialog.querySelectorAll('input[name="it_lang"]:checked')].map((i) => i.value),
        beats,
        sources,
        clipFile: dialog.querySelector('#it_clipFile')?.value || '',
        clipStatus: dialog.querySelector('#it_clipFile')?.value ? 'cortado' : base.clipStatus,
        tags: dialog.querySelector('#it_tags').value,
        description: dialog.querySelector('#it_desc').value,
        thumbnail: dialog.querySelector('#it_thumb').value,
        checks: [...checks],
      });

      const renderChecks = () => {
        const suggestions = suggestFor({ item: snapshot(), ref: sources[0] });
        const known = new Set(suggestions.map((s) => s.id));
        checks = new Set([...checks].filter((id) => known.has(id)));
        const root = dialog.querySelector('#it_checks');
        root.innerHTML = suggestions.map((s) => `<label class="checkline">
          <input type="checkbox" data-check="${s.id}" ${checks.has(s.id) ? 'checked' : ''}>
          <span><b>${ui.esc(s.label)}</b><p>${ui.esc(s.detail)}</p></span>
          <span class="badge ${s.priority === 'alta' ? 'hot' : s.priority === 'media' ? 'warn' : ''}">${s.priority}</span>
        </label>`).join('');
      };

      const renderVersions = () => {
        dialog.querySelector('#it_versions').innerHTML = versionsHtml();
      };

      dialog.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          dialog.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn));
          dialog.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === activeTab));
          if (activeTab === 'checklist') renderChecks();
          if (activeTab === 'historico') renderVersions();
        });
      });

      dialog.querySelector('#it_addBeat').addEventListener('click', () => {
        beats.push({ id: uid('b'), kind: 'desenvolvimento', text: '', cue: '', weight: 3 });
        renderBeats();
      });

      list.addEventListener('input', (e) => {
        const row = e.target.closest('[data-beat]');
        if (!row) return;
        const beat = beats.find((b) => b.id === row.dataset.beat);
        if (!beat) return;
        const field = e.target.dataset.field;
        if (field) beat[field] = e.target.value;
        if (field === 'kind') renderBeats();
        else refreshStats();
      });

      list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const row = btn.closest('[data-beat]');
        const index = beats.findIndex((b) => b.id === row.dataset.beat);
        if (index < 0) return;
        const act = btn.dataset.act;
        if (act === 'del') beats.splice(index, 1);
        if (act === 'dup') beats.splice(index + 1, 0, { ...beats[index], id: uid('b') });
        if (act === 'up' && index > 0) [beats[index - 1], beats[index]] = [beats[index], beats[index - 1]];
        if (act === 'down' && index < beats.length - 1) [beats[index + 1], beats[index]] = [beats[index], beats[index + 1]];
        renderBeats();
      });

      dialog.querySelector('#it_addSource').addEventListener('change', (e) => {
        const video = feedItems().find((v) => v.id === e.target.value);
        if (!video) return;
        sources.push({
          id: video.id, videoId: video.id, title: video.title, channel: video.channelTitle,
          views: video.views, likes: video.likes, comments: video.comments,
          publishedAt: video.publishedAt, duration: video.duration, tags: video.tags,
          demo: video.demo, url: video.demo ? '' : `https://youtu.be/${video.id}`,
        });
        renderSources();
        ui.toast('Referência adicionada');
      });

      dialog.querySelector('#it_sources').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-source]');
        if (!btn) return;
        const id = btn.dataset.removeSource;
        sources = sources.filter((s) => (s.videoId || s.id) !== id);
        renderSources();
      });

      durationInput.addEventListener('change', () => {
        targetSec = durationSeconds();
        renderBeats();
      });

      dialog.querySelector('#it_gen').addEventListener('click', () => {
        const current = dialog.querySelector('#it_title').value.trim();
        const format = state.formats.find((f) => f.id === dialog.querySelector('#it_format').value) || null;
        const source = sources[0] ? { ...sources[0], channelTitle: sources[0].channel } : null;
        if (!current && !format && !source) return ui.toast('Informe um título, formato ou referência primeiro.', 'error');
        if (beats.length && !confirm('Substituir o roteiro atual pelo gerado?')) return;
        const generated = buildScript({
          video: source,
          format,
          angle: dialog.querySelector('#it_angle').value,
          title: current || undefined,
          duration: durationSeconds(),
        });
        beats = generated.beats;
        if (!current) dialog.querySelector('#it_title').value = generated.title;
        if (!dialog.querySelector('#it_desc').value) dialog.querySelector('#it_desc').value = generated.description;
        if (!dialog.querySelector('#it_tags').value) dialog.querySelector('#it_tags').value = generated.tags.join(', ');
        if (!dialog.querySelector('#it_thumb').value) dialog.querySelector('#it_thumb').value = generated.thumbnail;
        titleOptions = generated.titleOptions;
        renderBeats();
        renderTitles();
        ui.toast('Roteiro gerado — edite os blocos como quiser');
      });

      dialog.querySelector('#it_humanize').addEventListener('click', () => {
        if (!beats.length) return ui.toast('Gere o roteiro antes de humanizar.', 'error');
        const result = humanizeBeats(beats);
        beats = result.beats;
        const desc = dialog.querySelector('#it_desc');
        const humanDesc = humanize(desc.value);
        if (humanDesc !== desc.value) desc.value = humanDesc;
        renderBeats();
        ui.toast(result.changed ? `${result.changed} bloco(s) humanizado(s)` : 'O texto já estava limpo');
      });

      dialog.querySelector('#it_merge').addEventListener('click', () => {
        if (sources.length < 2) return ui.toast('Adicione pelo menos duas referências para mesclar.', 'error');
        if (beats.length && !confirm('Substituir o roteiro atual pelo híbrido das referências?')) return;
        const entries = sources.map((s) => buildScript({
          video: { ...s, channelTitle: s.channel },
          title: s.title,
        }));
        const merged = mergeScripts(entries);
        if (!merged) return ui.toast('Não foi possível mesclar essas referências.', 'error');
        beats = merged.beats;
        titleOptions = merged.titleOptions;
        dialog.querySelector('#it_title').value = dialog.querySelector('#it_title').value || merged.title;
        if (!dialog.querySelector('#it_desc').value) dialog.querySelector('#it_desc').value = merged.description;
        if (!dialog.querySelector('#it_tags').value) dialog.querySelector('#it_tags').value = merged.tags.join(', ');
        if (!dialog.querySelector('#it_thumb').value) dialog.querySelector('#it_thumb').value = merged.thumbnail;
        renderBeats();
        renderTitles();
        ui.toast('Roteiro híbrido gerado a partir das fontes');
      });

      dialog.querySelector('#it_block').addEventListener('change', (e) => {
        const block = state.blocks.find((b) => b.id === e.target.value);
        if (!block) return;
        beats.push({
          id: uid('b'),
          kind: block.kind,
          text: fillBlock(block.text, { title: dialog.querySelector('#it_title').value || block.label }),
          cue: block.cue || '',
          weight: block.weight || undefined,
        });
        e.target.value = '';
        renderBeats();
        ui.toast('Bloco inserido');
      });

      const clipInput = dialog.querySelector('#it_clipFile');
      const clipStatusEl = dialog.querySelector('#it_clipStatus');
      const refreshClipStatus = () => {
        if (clipInput?.value) {
          const name = clipInput.value.split(/[\\/]/).pop();
          clipStatusEl.innerHTML = `✓ Clipe selecionado: ${ui.esc(name)}`;
          clipStatusEl.style.color = 'var(--ok)';
        } else if (base.clipFile) {
          clipStatusEl.innerHTML = `✓ Clipe importado: ${ui.esc(base.clipFile.split(/[\\/]/).pop())}`;
          clipStatusEl.style.color = 'var(--ok)';
        } else {
          clipStatusEl.innerHTML = 'Status: <b style="color:var(--pink)">planejado</b> — aguardando clipe cortado';
          clipStatusEl.style.color = 'var(--dim)';
        }
      };
      clipInput?.addEventListener('change', refreshClipStatus);
      dialog.querySelector('#it_clipImport')?.addEventListener('click', () => {
        if (!clipInput?.value) return ui.toast('Selecione o arquivo de vídeo cortado primeiro.', 'error');
        const name = clipInput.value.split(/[\\/]/).pop();
        base.clipFile = name;
        base.clipStatus = 'cortado';
        refreshClipStatus();
        ui.toast('Clipe marcado como cortado — salve o item');
      });
      refreshClipStatus();

      dialog.querySelector('#it_copy').addEventListener('click', () => {
        if (!beats.length) return ui.toast('Nada para copiar ainda.', 'error');
        ui.copyText(scriptText(beats), 'Roteiro copiado');
      });

      dialog.querySelector('#it_pkg').addEventListener('click', () => {
        if (!beats.length) return ui.toast('Gere o roteiro antes de exportar.', 'error');
        const data = snapshot();
        const slug = (data.title || 'roteiro').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        ui.downloadFile(`${slug || 'roteiro'}.md`, packageFor({ ...base, ...data, duration: targetSec }), 'text/markdown;charset=utf-8');
        ui.toast('Pacote de produção exportado');
      });

      dialog.querySelector('#it_genTitles').addEventListener('click', () => {
        const title = dialog.querySelector('#it_title').value.trim();
        titleOptions = titleVariants(topicOf(title || base.title || 'GTA VI'), dialog.querySelector('#it_angle').value);
        renderTitles();
        ui.toast('Títulos gerados');
      });

      dialog.querySelector('#it_titles').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-use-title]');
        if (!btn) return;
        dialog.querySelector('#it_title').value = btn.dataset.useTitle;
        ui.toast('Título aplicado');
      });

      dialog.querySelector('#it_checks').addEventListener('change', (e) => {
        const input = e.target.closest('[data-check]');
        if (!input) return;
        if (input.checked) checks.add(input.dataset.check);
        else checks.delete(input.dataset.check);
      });

      dialog.querySelector('#it_checkAll').addEventListener('click', () => {
        dialog.querySelectorAll('[data-check]').forEach((i) => { i.checked = true; checks.add(i.dataset.check); });
      });
      dialog.querySelector('#it_checkNone').addEventListener('click', () => {
        checks.clear();
        dialog.querySelectorAll('[data-check]').forEach((i) => { i.checked = false; });
      });

      dialog.querySelector('#it_versions').addEventListener('click', (e) => {
        const restore = e.target.closest('[data-restore]');
        const copy = e.target.closest('[data-copy-version]');
        if (restore) {
          const version = versions[Number(restore.dataset.restore)];
          if (!version) return;
          beats = version.beats?.length ? structuredClone(version.beats) : scriptToBeats(version.script);
          renderBeats();
          ui.toast('Versão restaurada — salve para confirmar');
        }
        if (copy) {
          const version = versions[Number(copy.dataset.copyVersion)];
          if (version) ui.copyText(version.script || scriptText(version.beats || []), 'Versão copiada');
        }
      });

      dialog.querySelector('#itemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = dialog.querySelector('#it_title').value.trim();
        if (!title) return;
        const script = scriptText(beats);
        const data = {
          title,
          formatId: dialog.querySelector('#it_format').value,
          stage: dialog.querySelector('#it_stage').value,
          angle: dialog.querySelector('#it_angle').value,
          duration: targetSec,
          due: dialog.querySelector('#it_due').value,
          publishAt: dialog.querySelector('#it_publish').value
            ? new Date(dialog.querySelector('#it_publish').value).toISOString()
            : '',
          platforms: [...dialog.querySelectorAll('input[name="it_plat"]:checked')].map((i) => i.value),
          languages: [...dialog.querySelectorAll('input[name="it_lang"]:checked')].map((i) => i.value),
          hook: beats.find((b) => b.kind === 'hook')?.text || base.hook || '',
          script,
          beats,
          sources,
          checks: [...checks],
          titleOptions,
          description: dialog.querySelector('#it_desc').value,
          tags: dialog.querySelector('#it_tags').value,
          thumbnail: dialog.querySelector('#it_thumb').value,
          notes: dialog.querySelector('#it_notes').value,
        };
        if (item) {
          if (item.script && item.script !== script) {
            versions = [{ at: new Date().toISOString(), title: item.title, script: item.script, beats: item.beats || [] }, ...versions].slice(0, 8);
          }
          data.versions = versions;
          Object.assign(item, data);
        } else {
          state.pipeline.push({
            id: base.id,
            nicheId: base.nicheId,
            createdAt: new Date().toISOString(),
            versions,
            ...data,
          });
        }
        save();
        dialog.close();
        ui.toast(item ? 'Item atualizado' : 'Item criado');
        ctx.refresh();
      });

      const del = dialog.querySelector('#it_delete');
      if (del) del.addEventListener('click', () => {
        if (!confirm('Excluir este item do pipeline?')) return;
        state.pipeline = state.pipeline.filter((p) => p.id !== item.id);
        save();
        dialog.close();
        ui.toast('Item excluído');
        ctx.refresh();
      });
    },
  });
}

export const pipeline = {
  render(ctx) {
    const items = state.pipeline.filter((p) => p.nicheId === ctx.niche.id);
    const counts = Object.fromEntries(STAGES.map((s) => [s.id, items.filter((p) => p.stage === s.id).length]));
    const active = items.filter((p) => p.stage !== 'publicado').length;
    const withScript = items.filter((p) => (p.beats?.length || p.script) && !stats(p.beats?.length ? p.beats : scriptToBeats(p.script)).missing.length).length;

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Produção · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Pipeline</h1>
          <p class="page-sub">Da referência ao publicado. Cada cartão carrega roteiro em blocos, referências, plataformas e idiomas — arraste para mover de etapa.</p>
        </div>
        <div class="head-actions">
          <button class="btn" id="pipeStudio"><svg class="ico"><use href="#i-script"/></svg>Estúdio</button>
          <button class="btn btn-primary" id="newPipeline"><svg class="ico"><use href="#i-plus"/></svg>Novo item</button>
        </div>
      </div>

      <div class="kpis" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi"><span class="kpi-label">Itens ativos</span><div class="kpi-value">${active}</div><span class="kpi-note">fora do estágio publicado</span></div>
        <div class="kpi"><span class="kpi-label">Roteiro completo</span><div class="kpi-value">${withScript} <small>/ ${items.length}</small></div><span class="kpi-note">hook + prova + CTA</span></div>
        <div class="kpi"><span class="kpi-label">Prontos</span><div class="kpi-value">${counts.pronto}</div><span class="kpi-note">aguardando publicação</span></div>
        <div class="kpi"><span class="kpi-label">Publicados</span><div class="kpi-value">${counts.publicado}</div><span class="kpi-note">histórico do nicho</span></div>
      </div>

      ${items.length === 0 ? `<div class="empty">
        <div class="empty-art"><svg class="ico"><use href="#i-kanban"/></svg></div>
        <h3>Nenhuma produção ainda</h3>
        <p>Use “Automatizar top 5” no Radar ou “Gerar do Radar” no Estúdio. Cada vídeo entra com roteiro em blocos, embalagem e checklist prontos para editar.</p>
        <div class="head-actions"><button class="btn btn-primary" id="newPipeline2">Criar primeiro item</button><button class="btn" id="pipeStudio2">Abrir Estúdio</button></div>
      </div>` : ''}

      <div class="kanban">
        ${STAGES.map((s) => `
          <section class="kcol" data-stage="${s.id}">
            <div class="kcol-head"><strong>${s.name}</strong><span>${counts[s.id]}</span></div>
            ${items.filter((p) => p.stage === s.id).map(itemCard).join('') || '<div class="kempty">Arraste para cá</div>'}
          </section>`).join('')}
      </div>`;
  },

  mount(root, ctx) {
    const open = () => openItemEditor(ctx);
    root.querySelector('#newPipeline')?.addEventListener('click', open);
    root.querySelector('#newPipeline2')?.addEventListener('click', open);
    root.querySelector('#pipeStudio')?.addEventListener('click', () => ctx.go('roteiros'));
    root.querySelector('#pipeStudio2')?.addEventListener('click', () => ctx.go('roteiros'));

    root.querySelectorAll('.kcard').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => {
        const item = state.pipeline.find((p) => p.id === card.dataset.id);
        if (item) openItemEditor(ctx, item);
      });
    });

    root.querySelectorAll('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain');
        const item = state.pipeline.find((p) => p.id === id);
        if (!item || item.stage === col.dataset.stage) return;
        item.stage = col.dataset.stage;
        if (item.stage === 'publicado' && !item.publishAt) item.publishAt = new Date().toISOString();
        save();
        ui.toast(`Movido para ${stageName(item.stage)}`);
        ctx.refresh();
      });
    });
  },
};
