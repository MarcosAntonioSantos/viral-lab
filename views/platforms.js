import { state, save } from '../lib/store.js';
import * as ui from '../lib/ui.js';

const GROUPS = ['Todos', 'Ocidente', 'Ásia'];
let group = 'Todos';

const STATUS_LABEL = { active: 'ativo', planned: 'planejado', off: 'pausado' };

export const platforms = {
  render(ctx) {
    const list = state.platforms.filter((p) => group === 'Todos' || p.group === group);
    const active = state.platforms.filter((p) => p.status === 'active').length;

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Rede · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Plataformas</h1>
          <p class="page-sub">Um master, muitos destinos. Especificações, monetização e o papel de cada plataforma no ecossistema.</p>
        </div>
        <div class="head-actions"><span class="badge ok">${active} ativas</span></div>
      </div>

      <div class="flow">
        <div class="flow-step"><b>01 · MASTER</b><strong>1 vídeo 16:9</strong><span>8–15 min, a versão completa que sustenta autoridade e busca.</span></div>
        <div class="flow-step"><b>02 · DERIVADOS</b><strong>5–8 cortes 9:16</strong><span>Cada corte com hook próprio — nunca um recorte sem contexto.</span></div>
        <div class="flow-step"><b>03 · LOCALIZAÇÃO</b><strong>Legenda + dublagem</strong><span>Um master por idioma ativo, com título e thumbnail adaptados.</span></div>
        <div class="flow-step"><b>04 · DISTRIBUIÇÃO</b><strong>Capa e CTA nativos</strong><span>Sem watermark de outra plataforma. Cada rede premia o conteúdo nativo.</span></div>
      </div>

      <div class="toolbar">
        ${GROUPS.map((g) => `<button class="chip ${group === g ? 'active' : ''}" data-group="${g}">${g === 'Todos' ? 'Todas' : g}</button>`).join('')}
        <span class="spacer"></span>
        <span class="panel-sub">${list.length} plataformas · monetização e formato</span>
      </div>

      <div class="cards">
        ${list.map((p) => `<article class="card pcard">
          <div class="pcard-top">
            <div>
              <h3>${ui.esc(p.name)} <span class="badge ${p.status === 'active' ? 'ok' : ''}">${STATUS_LABEL[p.status] || p.status}</span></h3>
              <div class="card-sub">${ui.esc(p.group)} · ${ui.esc(p.format)}</div>
            </div>
            <select class="select" data-status="${p.id}" style="width:112px;height:29px;font-size:11px">
              <option value="active" ${p.status === 'active' ? 'selected' : ''}>Ativo</option>
              <option value="planned" ${p.status === 'planned' ? 'selected' : ''}>Planejado</option>
              <option value="off" ${p.status === 'off' ? 'selected' : ''}>Pausado</option>
            </select>
          </div>
          <div class="pspec"><span>${ui.esc(p.aspect)}</span><span>${ui.esc(p.length)}</span></div>
          <p>${ui.esc(p.role)}</p>
          <div class="money">Monetização: <b>${ui.esc(p.monetization)}</b><br>RPM estimado: <b>${ui.esc(p.rpm)}</b></div>
          <div class="card-head" style="margin:12px 0 0;align-items:center">
            <button class="btn btn-sm" data-copy="${p.id}"><svg class="ico"><use href="#i-copy"/></svg>Copiar spec</button>
            <a class="btn btn-sm btn-ghost" href="${ui.esc(p.url)}" target="_blank" rel="noopener">Abrir <svg class="ico"><use href="#i-external"/></svg></a>
          </div>
        </article>`).join('')}
      </div>`;
  },

  mount(root, ctx) {
    root.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
      group = b.dataset.group;
      ctx.refresh();
    }));

    root.querySelectorAll('[data-status]').forEach((sel) => sel.addEventListener('change', () => {
      const p = state.platforms.find((x) => x.id === sel.dataset.status);
      if (!p) return;
      p.status = sel.value;
      save();
      ui.toast(`${p.name}: ${STATUS_LABEL[p.status]}`);
      ctx.refresh();
    }));

    root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
      const p = state.platforms.find((x) => x.id === b.dataset.copy);
      if (!p) return;
      ui.copyText(
        `${p.name}\nFormato: ${p.format} · ${p.aspect} · ${p.length}\nMonetização: ${p.monetization}\nRPM: ${p.rpm}\nPapel: ${p.role}`,
        'Spec copiada',
      );
    }));
  },
};
