import { state, save, uid, nicheBlocks } from '../lib/store.js';
import * as ui from '../lib/ui.js';
import { viralScore } from '../lib/metrics.js';
import {
  KINDS, kindById, scriptToBeats, scriptText, humanizeBeats, stats, packageFor,
  durationLabel, ANGLES,
} from '../lib/script.js';
import { beatsPreview, openMergeDialog } from '../lib/script-ui.js';
import { createItemFromScript, createItemsFromVideos } from '../lib/autopilot.js';
import { openItemEditor, STAGES } from './pipeline.js';

const picked = new Set();
let kindFilter = 'todos';

const stageName = (id) => STAGES.find((s) => s.id === id)?.name || id;

function openBlockEditor(ctx, block = null) {
  const src = block || { kind: 'hook', label: '', text: '', cue: '', tags: ['geral'] };
  const body = `
    <form class="form" id="blockForm">
      <div class="form-row">
        <div class="field"><label for="bk_kind">Tipo de bloco</label>
          <select class="select" id="bk_kind">
            ${KINDS.map((k) => `<option value="${k.id}" ${src.kind === k.id ? 'selected' : ''}>${k.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="bk_label">Nome curto</label>
          <input class="input" id="bk_label" value="${ui.esc(src.label || '')}" placeholder="Ex.: Frame na tela">
        </div>
      </div>
      <div class="field"><label for="bk_text">Texto reutilizável</label>
        <textarea class="textarea" id="bk_text" style="min-height:110px" placeholder="Use {tema} para o assunto da referência">${ui.esc(src.text || '')}</textarea>
        <span class="panel-sub">Tokens: {tema}, {canal}, {numero}, {praca}.</span>
      </div>
      <div class="field"><label for="bk_cue">Direção de cena</label>
        <input class="input" id="bk_cue" value="${ui.esc(src.cue || '')}" placeholder="O que aparece na tela nesse bloco">
      </div>
      <div class="field"><label for="bk_tags">Tags de ângulo (vírgula)</label>
        <input class="input" id="bk_tags" value="${ui.esc((src.tags || []).join(', '))}" placeholder="geral, noticia, analise">
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar bloco</button>
      </div>
    </form>`;

  ui.openSheet({
    kicker: block ? 'Editar bloco' : 'Biblioteca',
    title: block ? 'Editar bloco' : 'Novo bloco',
    body,
    onMount: (dialog) => {
      dialog.querySelector('#blockForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = dialog.querySelector('#bk_text').value.trim();
        if (!text) return;
        const data = {
          kind: dialog.querySelector('#bk_kind').value,
          label: dialog.querySelector('#bk_label').value.trim(),
          text,
          cue: dialog.querySelector('#bk_cue').value.trim(),
          tags: dialog.querySelector('#bk_tags').value.split(',').map((s) => s.trim()).filter(Boolean),
        };
        if (block) Object.assign(block, data);
        else state.blocks.push({ id: uid('blk'), nicheId: ctx.niche.id, ...data });
        save();
        dialog.close();
        ui.toast(block ? 'Bloco atualizado' : 'Bloco criado');
        ctx.refresh();
      });
    },
  });
}

function autoFromRadar(ctx) {
  const feed = state.feeds[ctx.niche.id]?.items || [];
  if (!feed.length) {
    ui.toast('Radar vazio. Atualize os dados ou carregue a demonstração.', 'error');
    return;
  }
  const top = [...feed].sort((a, b) => viralScore(b) - viralScore(a)).slice(0, 5);
  const created = createItemsFromVideos(ctx, top);
  if (!created) return ui.toast('As referências do top já estão no pipeline.');
  ui.toast(`${created} roteiro(s) criado(s) a partir do top 5`);
  ctx.refresh();
}

export const roteiros = {
  render(ctx) {
    const items = state.pipeline.filter((p) => p.nicheId === ctx.niche.id);
    const valid = new Set(items.map((p) => p.id));
    [...picked].forEach((id) => { if (!valid.has(id)) picked.delete(id); });

    const prepared = items.map((item) => {
      const beats = item.beats?.length ? item.beats : scriptToBeats(item.script);
      return { item, beats, st: stats(beats) };
    });
    const complete = prepared.filter((p) => p.beats.length && !p.st.missing.length).length;
    const minutes = Math.round(prepared.reduce((sum, p) => sum + p.st.seconds, 0) / 60);
    const pending = prepared.filter((p) => p.st.missing.length).length;

    const blocks = nicheBlocks().filter((b) => kindFilter === 'todos' || b.kind === kindFilter || (kindFilter === 'todos' && !b.kind));

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Roteiro · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Estúdio de roteiro</h1>
          <p class="page-sub">Gere a estrutura a partir de uma referência, edite por blocos, humanize o texto e mescle vídeos em um roteiro só. O conteúdo é seu; a estrutura vem do que performou.</p>
        </div>
        <div class="head-actions">
          <button class="btn" id="studioAuto"><svg class="ico"><use href="#i-bolt"/></svg>Gerar do Radar</button>
          <button class="btn btn-primary" id="studioNew"><svg class="ico"><use href="#i-plus"/></svg>Novo roteiro</button>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="kpi-label">Roteiros</span><div class="kpi-value">${prepared.length}</div><span class="kpi-note">itens do nicho no pipeline</span></div>
        <div class="kpi"><span class="kpi-label">Estrutura completa</span><div class="kpi-value">${complete} <small>/ ${prepared.length}</small></div><span class="kpi-note">hook + prova + CTA</span></div>
        <div class="kpi"><span class="kpi-label">Minutos falados</span><div class="kpi-value">${minutes}</div><span class="kpi-note">soma dos roteiros gerados</span></div>
        <div class="kpi"><span class="kpi-label">Pendências</span><div class="kpi-value">${pending}</div><span class="kpi-note">roteiros com bloco faltando</span></div>
      </div>

      <div class="merge-bar">
        <span><b id="pickCount">${picked.size}</b> selecionado(s) para mesclar</span>
        <span class="panel-sub">Marque dois ou mais cartões para criar um roteiro híbrido.</span>
        <button class="btn btn-sm" id="clearPicks" ${picked.size ? '' : 'disabled'}>Limpar</button>
        <button class="btn btn-primary btn-sm" id="mergePicks" ${picked.size >= 2 ? '' : 'disabled'}><svg class="ico"><use href="#i-merge"/></svg>Mesclar em um roteiro</button>
      </div>

      ${prepared.length ? `<div class="studio-grid">
        ${prepared.map(({ item, beats, st }) => `<article class="card script-card">
          <div class="card-head">
            <div style="display:flex;gap:10px;align-items:flex-start;min-width:0">
              <input type="checkbox" class="pick" data-pick="${item.id}" ${picked.has(item.id) ? 'checked' : ''} aria-label="Selecionar para mesclar">
              <div style="min-width:0">
                <h3 class="card-title">${ui.esc(item.title || 'Sem título')}</h3>
                <div class="card-sub">${ui.esc(stageName(item.stage))} · ${beats.length} blocos · ${durationLabel(st.seconds)} falados · ${ANGLES.find((a) => a.id === item.angle)?.name || 'sem ângulo'}</div>
              </div>
            </div>
            <span class="badge ${st.missing.length ? 'warn' : 'ok'}">${st.missing.length ? `falta ${st.missing.length}` : 'completo'}</span>
          </div>
          <div class="progress"><i style="width:${st.coverage}%"></i></div>
          ${beatsPreview(beats, { limit: 3 })}
          <div class="card-head" style="margin:13px 0 0;align-items:center">
            <div class="platform-dots">
              ${(item.platforms || []).slice(0, 4).map((id) => `<span class="pdot">${ui.esc(id)}</span>`).join('')}
              ${item.sources?.length ? `<span class="badge">${item.sources.length} fontes</span>` : ''}
            </div>
            <div class="card-actions">
              <button class="btn btn-sm" data-edit="${item.id}">Editar</button>
              <button class="btn-icon" data-humanize="${item.id}" title="Humanizar texto"><svg class="ico"><use href="#i-bolt"/></svg></button>
              <button class="btn-icon" data-copy="${item.id}" title="Copiar roteiro"><svg class="ico"><use href="#i-copy"/></svg></button>
              <button class="btn-icon" data-pkg="${item.id}" title="Exportar pacote"><svg class="ico"><use href="#i-download"/></svg></button>
            </div>
          </div>
        </article>`).join('')}
      </div>` : `<div class="empty">
        <div class="empty-art"><svg class="ico"><use href="#i-script"/></svg></div>
        <h3>Nenhum roteiro ainda</h3>
        <p>Use “Gerar do Radar” para transformar o top 5 em roteiros completos, ou comece um item do zero.</p>
        <div class="head-actions"><button class="btn btn-primary" id="studioAuto2">Gerar do Radar</button><button class="btn" id="studioNew2">Criar do zero</button></div>
      </div>`}

      <div class="panel" style="padding:17px;margin-top:26px">
        <div class="panel-head" style="padding:0 0 14px;border-bottom:1px solid var(--line);margin-bottom:14px">
          <div>
            <div class="panel-title">Biblioteca de blocos</div>
            <div class="panel-sub">Hooks, provas, viradas e CTAs reutilizáveis. Use {tema} para adaptar ao assunto.</div>
          </div>
          <button class="btn btn-sm" id="newBlock"><svg class="ico"><use href="#i-plus"/></svg>Novo bloco</button>
        </div>
        <div class="toolbar">
          <button class="chip ${kindFilter === 'todos' ? 'active' : ''}" data-kind="todos">Todos</button>
          ${KINDS.map((k) => `<button class="chip ${kindFilter === k.id ? 'active' : ''}" data-kind="${k.id}">${k.label}</button>`).join('')}
          <span class="spacer"></span>
          <span class="panel-sub">${blocks.length} blocos</span>
        </div>
        <div class="blocks-grid">
          ${blocks.map((b) => `<article class="block-card">
            <div class="block-head">
              <span class="badge">${ui.esc(kindById(b.kind).label)}</span>
              <div class="card-actions">
                <button class="btn-icon" data-copy-block="${b.id}" title="Copiar"><svg class="ico"><use href="#i-copy"/></svg></button>
                <button class="btn-icon" data-edit-block="${b.id}" title="Editar"><svg class="ico"><use href="#i-sliders"/></svg></button>
                <button class="btn-icon" data-del-block="${b.id}" title="Excluir"><svg class="ico"><use href="#i-trash"/></svg></button>
              </div>
            </div>
            <p>${ui.esc(b.text)}</p>
            ${b.cue ? `<div class="block-cue">→ ${ui.esc(b.cue)}</div>` : ''}
          </article>`).join('') || '<div class="kempty">Nenhum bloco neste filtro.</div>'}
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const items = state.pipeline.filter((p) => p.nicheId === ctx.niche.id);
    const find = (id) => state.pipeline.find((p) => p.id === id);

    root.querySelector('#studioNew')?.addEventListener('click', () => openItemEditor(ctx));
    root.querySelector('#studioNew2')?.addEventListener('click', () => openItemEditor(ctx));
    root.querySelector('#studioAuto')?.addEventListener('click', () => autoFromRadar(ctx));
    root.querySelector('#studioAuto2')?.addEventListener('click', () => autoFromRadar(ctx));

    root.querySelectorAll('[data-pick]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) picked.add(input.dataset.pick);
        else picked.delete(input.dataset.pick);
        root.querySelector('#pickCount').textContent = picked.size;
        root.querySelector('#mergePicks').disabled = picked.size < 2;
        root.querySelector('#clearPicks').disabled = picked.size === 0;
      });
    });

    root.querySelector('#clearPicks')?.addEventListener('click', () => {
      picked.clear();
      ctx.refresh();
    });

    root.querySelector('#mergePicks')?.addEventListener('click', () => {
      const chosen = items.filter((p) => picked.has(p.id));
      if (chosen.length < 2) return ui.toast('Selecione pelo menos dois roteiros.', 'error');
      openMergeDialog({
        entries: chosen.map((p) => ({ ...p, beats: p.beats?.length ? p.beats : scriptToBeats(p.script) })),
        kicker: 'Mesclar roteiros',
        title: 'Roteiro híbrido',
        onApply: (merged) => {
          const created = createItemFromScript(ctx, merged, { sources: merged.sources, stage: 'roteiro' });
          if (!created) return ui.toast('Não foi possível criar o híbrido.', 'error');
          picked.clear();
          ui.toast('Roteiro híbrido criado no pipeline');
          ctx.refresh();
        },
      });
    });

    root.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      const item = find(btn.dataset.edit);
      if (item) openItemEditor(ctx, item);
    }));

    root.querySelectorAll('[data-humanize]').forEach((btn) => btn.addEventListener('click', () => {
      const item = find(btn.dataset.humanize);
      if (!item) return;
      const beats = item.beats?.length ? item.beats : scriptToBeats(item.script);
      const result = humanizeBeats(beats);
      item.beats = result.beats;
      item.script = scriptText(result.beats);
      save();
      ui.toast(result.changed ? `${result.changed} bloco(s) humanizado(s)` : 'O texto já estava limpo');
      ctx.refresh();
    }));

    root.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', () => {
      const item = find(btn.dataset.copy);
      if (!item) return;
      const beats = item.beats?.length ? item.beats : scriptToBeats(item.script);
      if (!beats.length) return ui.toast('Este roteiro está vazio.', 'error');
      ui.copyText(scriptText(beats), 'Roteiro copiado');
    }));

    root.querySelectorAll('[data-pkg]').forEach((btn) => btn.addEventListener('click', () => {
      const item = find(btn.dataset.pkg);
      if (!item) return;
      const slug = (item.title || 'roteiro').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      ui.downloadFile(`${slug || 'roteiro'}.md`, packageFor(item), 'text/markdown;charset=utf-8');
      ui.toast('Pacote exportado');
    }));

    root.querySelectorAll('[data-kind]').forEach((btn) => btn.addEventListener('click', () => {
      kindFilter = btn.dataset.kind;
      ctx.refresh();
    }));

    root.querySelector('#newBlock')?.addEventListener('click', () => openBlockEditor(ctx));

    root.querySelectorAll('[data-edit-block]').forEach((btn) => btn.addEventListener('click', () => {
      const block = state.blocks.find((b) => b.id === btn.dataset.editBlock);
      if (block) openBlockEditor(ctx, block);
    }));

    root.querySelectorAll('[data-copy-block]').forEach((btn) => btn.addEventListener('click', () => {
      const block = state.blocks.find((b) => b.id === btn.dataset.copyBlock);
      if (block) ui.copyText(block.text, 'Bloco copiado');
    }));

    root.querySelectorAll('[data-del-block]').forEach((btn) => btn.addEventListener('click', () => {
      const block = state.blocks.find((b) => b.id === btn.dataset.delBlock);
      if (!block || !confirm('Excluir este bloco da biblioteca?')) return;
      state.blocks = state.blocks.filter((b) => b.id !== block.id);
      save();
      ui.toast('Bloco excluído');
      ctx.refresh();
    }));
  },
};
