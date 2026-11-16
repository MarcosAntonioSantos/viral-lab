import * as ui from './ui.js';
import { mergeScripts, kindById, stats, durationLabel, clip } from './script.js';

export function beatsPreview(beats = [], { limit = 8 } = {}) {
  if (!beats.length) return '<p class="dim" style="font-size:12px">Nenhum bloco ainda. Gere o roteiro para começar.</p>';
  return `<div class="script-preview">${beats.slice(0, limit).map((b) => `<div class="sp-beat">
    <span class="sp-time">${ui.esc(b.time || kindById(b.kind).short)}</span>
    <div><b>${ui.esc(kindById(b.kind).label)}</b><p>${ui.esc(b.text)}</p>${b.cue ? `<em>→ ${ui.esc(b.cue)}</em>` : ''}</div>
  </div>`).join('')}</div>`;
}

export function openMergeDialog({ entries = [], onApply, kicker = 'Mesclar referências', title = 'Roteiro híbrido' }) {
  const merged = mergeScripts(entries);
  if (!merged) {
    ui.toast('Nenhum roteiro disponível para mesclar.', 'error');
    return;
  }
  const st = stats(merged.beats);
  const sources = merged.sources || [];

  const body = `
    <div class="callout" style="margin-bottom:16px">O híbrido usa o hook mais forte, uma prova de cada referência e o desenvolvimento alternado. Nada é copiado: os blocos são reorganizados e podem ser editados depois.</div>
    <div class="field" style="margin-bottom:14px"><label>Referências combinadas</label>
      <div class="source-list">${sources.length ? sources.map((s) => `<span class="source-chip">${ui.esc(clip(s.title, 42))}</span>`).join('') : '<span class="dim" style="font-size:12px">Referências sem metadados.</span>'}</div>
    </div>
    <div class="script-stats" style="margin-bottom:16px">
      <span><b>${merged.beats.length}</b> blocos</span>
      <span><b>${st.seconds}s</b> falados</span>
      <span><b>${durationLabel(merged.duration)}</b> alvo</span>
      <span><b>${merged.mergedFrom.length}</b> temas</span>
    </div>
    <div class="field" style="margin-bottom:14px"><label for="mgTitle">Título do híbrido</label>
      <input class="input" id="mgTitle" value="${ui.esc(merged.title)}">
    </div>
    <div class="field" style="margin-bottom:16px"><label>Alternativas</label>
      <div class="source-list">${(merged.titleOptions || []).map((t) => `<button type="button" class="chip" data-mg-title="${ui.esc(t)}">${ui.esc(t)}</button>`).join('')}</div>
    </div>
    <div class="field"><label>Prévia do roteiro</label>
      ${beatsPreview(merged.beats, { limit: 12 })}
    </div>
    <div class="form-actions" style="margin-top:18px">
      <button type="button" class="btn" data-close>Cancelar</button>
      <button type="button" class="btn btn-primary" id="mgApply"><svg class="ico"><use href="#i-merge"/></svg>Usar este roteiro</button>
    </div>`;

  ui.openSheet({
    kicker,
    title,
    body,
    wide: true,
    onMount: (dialog) => {
      const input = dialog.querySelector('#mgTitle');
      dialog.querySelectorAll('[data-mg-title]').forEach((btn) => {
        btn.addEventListener('click', () => { input.value = btn.dataset.mgTitle; });
      });
      dialog.querySelector('#mgApply').addEventListener('click', () => {
        const chosen = input.value.trim() || merged.title;
        merged.title = chosen;
        merged.titleOptions = [chosen, ...(merged.titleOptions || []).filter((t) => t !== chosen)].slice(0, 3);
        onApply?.(merged);
        dialog.close();
      });
    },
  });
}
