import { state, save, uid, nicheFormats } from '../lib/store.js';
import * as ui from '../lib/ui.js';
import { buildScript, scriptText, inferAngle } from '../lib/script.js';
import { openItemEditor } from './pipeline.js';

export function openFormatEditor(ctx, format = null) {
  const src = format || {
    name: '', duration: '', tags: [], hook: '', steps: [], platforms: [], notes: '',
  };
  const selected = new Set(src.platforms || []);

  const body = `
    <form class="form" id="fmtForm">
      <div class="field"><label for="fm_name">Nome do formato</label>
        <input class="input" id="fm_name" required value="${ui.esc(src.name)}" placeholder="Ex.: Notícia em 60 segundos">
      </div>
      <div class="form-row">
        <div class="field"><label for="fm_dur">Duração</label>
          <input class="input" id="fm_dur" value="${ui.esc(src.duration)}" placeholder="Ex.: 45–60 s">
        </div>
        <div class="field"><label for="fm_tags">Tags (separadas por vírgula)</label>
          <input class="input" id="fm_tags" value="${ui.esc((src.tags || []).join(', '))}" placeholder="notícia, urgência">
        </div>
      </div>
      <div class="field"><label for="fm_hook">Hook de referência</label>
        <input class="input" id="fm_hook" value="${ui.esc(src.hook)}" placeholder="A frase que abre o vídeo">
      </div>
      <div class="field"><label for="fm_steps">Estrutura — um passo por linha</label>
        <textarea class="textarea" id="fm_steps" style="min-height:130px">${ui.esc((src.steps || []).join('\n'))}</textarea>
      </div>
      <div class="field"><label>Plataformas</label>
        <div class="check-grid">
          ${state.platforms.map((p) => `<label class="check"><input type="checkbox" name="fm_plat" value="${p.id}" ${selected.has(p.id) ? 'checked' : ''}>${ui.esc(p.name)}</label>`).join('')}
        </div>
      </div>
      <div class="field"><label for="fm_notes">Notas</label>
        <textarea class="textarea" id="fm_notes" style="min-height:64px">${ui.esc(src.notes)}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar formato</button>
      </div>
    </form>`;

  ui.openSheet({
    kicker: format ? 'Editar' : 'Biblioteca',
    title: format ? 'Editar formato' : 'Novo formato',
    body,
    wide: true,
    onMount: (dialog) => {
      dialog.querySelector('#fmtForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dialog.querySelector('#fm_name').value.trim();
        if (!name) return;
        const data = {
          name,
          duration: dialog.querySelector('#fm_dur').value.trim(),
          tags: dialog.querySelector('#fm_tags').value.split(',').map((s) => s.trim()).filter(Boolean),
          hook: dialog.querySelector('#fm_hook').value.trim(),
          steps: ui.words(dialog.querySelector('#fm_steps').value),
          platforms: [...dialog.querySelectorAll('input[name="fm_plat"]:checked')].map((i) => i.value),
          notes: dialog.querySelector('#fm_notes').value.trim(),
        };
        if (format) Object.assign(format, data);
        else state.formats.push({ id: uid('fmt'), nicheId: ctx.niche.id, createdAt: new Date().toISOString(), ...data });
        save();
        dialog.close();
        ui.toast(format ? 'Formato atualizado' : 'Formato criado');
        ctx.refresh();
      });
    },
  });
}

export const formats = {
  render(ctx) {
    const term = (ctx.search || '').toLowerCase();
    const list = nicheFormats().filter((f) =>
      !term || `${f.name} ${(f.tags || []).join(' ')}`.toLowerCase().includes(term));

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Biblioteca · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Formatos replicáveis</h1>
          <p class="page-sub">Estruturas que já provaram funcionar. Cada card é um molde de produção — o conteúdo é seu, o esqueleto vem do que performou.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-primary" id="newFormat"><svg class="ico"><use href="#i-plus"/></svg>Novo formato</button>
        </div>
      </div>

      ${list.length === 0 ? `<div class="empty">
        <div class="empty-art"><svg class="ico"><use href="#i-layers"/></svg></div>
        <h3>Nenhum formato salvo</h3>
        <p>Abra um vídeo no Radar, clique em “Ficha” e salve a estrutura. Ou crie um molde do zero.</p>
        <div class="head-actions"><button class="btn btn-primary" id="newFormat2">Criar formato</button></div>
      </div>` : ''}

      <div class="cards">
        ${list.map((f) => `<article class="card" data-format="${f.id}">
          <div class="card-head">
            <div>
              <h3 class="card-title">${ui.esc(f.name)}</h3>
              <div class="card-sub">${f.duration ? ui.esc(f.duration) : 'duração livre'} · ${f.steps?.length || 0} passos</div>
            </div>
            <div class="card-actions">
              <button class="btn-icon" data-edit="${f.id}" title="Editar"><svg class="ico"><use href="#i-sliders"/></svg></button>
              <button class="btn-icon" data-dup="${f.id}" title="Duplicar"><svg class="ico"><use href="#i-copy"/></svg></button>
            </div>
          </div>
          ${(f.tags || []).length ? ui.tags(f.tags, 4) : ''}
          ${f.hook ? `<div class="hook" style="margin-top:11px">${ui.esc(f.hook)}</div>` : ''}
          ${(f.steps || []).length ? `<ol class="steps">${f.steps.map((s) => `<li>${ui.esc(s)}</li>`).join('')}</ol>` : ''}
          <div class="card-head" style="margin:14px 0 0;align-items:center">
            <div class="platform-dots">
              ${(f.platforms || []).map((id) => {
                const p = state.platforms.find((x) => x.id === id);
                return `<span class="pdot">${ui.esc(p?.name || id)}</span>`;
              }).join('')}
            </div>
            <button class="btn btn-sm" data-use="${f.id}">→ Pipeline</button>
          </div>
        </article>`).join('')}
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('#newFormat')?.addEventListener('click', () => openFormatEditor(ctx));
    root.querySelector('#newFormat2')?.addEventListener('click', () => openFormatEditor(ctx));

    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const f = state.formats.find((x) => x.id === b.dataset.edit);
      if (f) openFormatEditor(ctx, f);
    }));

    root.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', () => {
      const f = state.formats.find((x) => x.id === b.dataset.dup);
      if (!f) return;
      state.formats.push({ ...structuredClone(f), id: uid('fmt'), name: `${f.name} (cópia)`, createdAt: new Date().toISOString() });
      save();
      ui.toast('Formato duplicado');
      ctx.refresh();
    }));

    root.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
      const f = state.formats.find((x) => x.id === b.dataset.use);
      if (!f) return;
      const script = buildScript({
        format: f,
        angle: inferAngle({ name: f.name, tags: f.tags }),
      });
      openItemEditor(ctx, null, {
        title: f.name,
        formatId: f.id,
        hook: script.hook,
        script: scriptText(script.beats),
        beats: script.beats,
        titleOptions: script.titleOptions,
        description: script.description,
        tags: script.tags.join(', '),
        thumbnail: script.thumbnail,
        angle: script.angle,
        duration: script.duration,
        platforms: f.platforms || [],
      });
    }));
  },
};
