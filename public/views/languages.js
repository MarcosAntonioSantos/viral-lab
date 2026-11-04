import { state, save } from '../lib/store.js';
import * as ui from '../lib/ui.js';

const tierLabel = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

export const languages = {
  render(ctx) {
    const active = state.languages.filter((l) => l.active);
    const tier1 = state.languages.filter((l) => l.tier === 1);
    const coverage = `${tier1.filter((l) => l.active).length}/${tier1.length}`;

    const rows = [1, 2, 3].map((tier) => {
      const list = state.languages.filter((l) => l.tier === tier);
      return `<tr><td colspan="6" style="padding-top:16px;padding-bottom:6px"><span class="tier">${tierLabel[tier]}</span> <span class="panel-sub">· ${list.filter((l) => l.active).length} ativos</span></td></tr>
        ${list.map((l) => `<tr class="${l.active ? '' : 'off'}">
          <td style="width:56px">
            <label class="switch"><input type="checkbox" data-lang="${l.code}" ${l.active ? 'checked' : ''}><span></span></label>
          </td>
          <td><span class="flag">${l.flag}</span><b style="font-weight:500">${ui.esc(l.name)}</b> <span class="dim" style="font-family:var(--mono);font-size:10px">${l.code}</span></td>
          <td class="muted">${ui.esc(l.market)}</td>
          <td><span class="badge ${l.reach.includes('muito') ? 'hot' : ''}">${ui.esc(l.reach)}</span></td>
          <td class="muted">${ui.esc(l.effort)}</td>
          <td class="muted">${ui.esc(l.mode)}</td>
        </tr>`).join('')}`;
    }).join('');

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Alcance · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Idiomas e mercados</h1>
          <p class="page-sub">Cada idioma ativo vira um pacote de localização: título, descrição, legenda e dublagem. Comece pelo Tier 1 e só expanda quando a operação aguentar.</p>
        </div>
        <div class="head-actions">
          <button class="btn" id="langTier1">Ativar Tier 1</button>
          <button class="btn" id="langCopy">Copiar plano</button>
        </div>
      </div>

      <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
        <div class="kpi"><span class="kpi-label">Idiomas ativos</span><div class="kpi-value">${active.length}<small>/ ${state.languages.length}</small></div><span class="kpi-note">pacotes de localização por vídeo</span></div>
        <div class="kpi"><span class="kpi-label">Cobertura Tier 1</span><div class="kpi-value">${coverage}</div><span class="kpi-note">pt-BR · inglês · espanhol</span></div>
        <div class="kpi"><span class="kpi-label">Mercados</span><div class="kpi-value">${new Set(state.languages.filter((l) => l.active).map((l) => l.market)).size}</div><span class="kpi-note">regiões com presença planejada</span></div>
      </div>

      <div class="panel">
        <div class="table-scroll">
        <table class="lang-table">
          <thead><tr><th></th><th>Idioma</th><th>Mercado</th><th>Alcance</th><th>Esforço</th><th>Localização</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
      </div>

      <div class="callout" style="margin-top:16px">
        <b>Regra de expansão:</b> só adicione um idioma quando os três primeiros estiverem com calendário rodando e retenção estável. Traduzir tudo ao mesmo tempo dilui a operação e queima a margem.
      </div>`;
  },

  mount(root, ctx) {
    root.querySelectorAll('[data-lang]').forEach((input) => input.addEventListener('change', () => {
      const lang = state.languages.find((l) => l.code === input.dataset.lang);
      if (!lang) return;
      lang.active = input.checked;
      save();
      ui.toast(`${lang.name} ${lang.active ? 'ativado' : 'desativado'}`);
      ctx.refresh();
    }));

    root.querySelector('#langTier1')?.addEventListener('click', () => {
      state.languages.forEach((l) => { if (l.tier === 1) l.active = true; });
      save();
      ui.toast('Tier 1 ativado');
      ctx.refresh();
    });

    root.querySelector('#langCopy')?.addEventListener('click', () => {
      const active = state.languages.filter((l) => l.active);
      const text = [
        `PLANO DE LOCALIZAÇÃO — ${ctx.niche.name}`,
        '',
        ...active.map((l) => `• ${l.name} (${l.code}) — ${l.market} · ${l.mode} · esforço ${l.effort}`),
        '',
        'Checklist por vídeo:',
        '[ ] título e thumbnail adaptados (não traduzidos ao pé da letra)',
        '[ ] legenda revisada por nativo ou IA + revisão',
        '[ ] dublagem com voz consistente entre vídeos',
        '[ ] descrição com palavras-chave do mercado',
        '[ ] data de publicação escalonada em 24h',
      ].join('\n');
      ui.copyText(text, 'Plano de localização copiado');
    });
  },
};
