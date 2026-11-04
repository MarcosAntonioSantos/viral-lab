import { state, save } from '../lib/store.js';
import * as ui from '../lib/ui.js';
import { openItemEditor } from './pipeline.js';

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function currentMonth() {
  const saved = state.settings.calMonth;
  if (saved && /^\d{4}-\d{2}$/.test(saved)) {
    const [y, m] = saved.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

function shift(month, delta) {
  const d = new Date(month.getFullYear(), month.getMonth() + delta, 1);
  state.settings.calMonth = monthKey(d);
  save();
}

export const calendar = {
  render(ctx) {
    const month = currentMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const items = state.pipeline.filter((p) => p.nicheId === ctx.niche.id);
    const scheduled = items.filter((p) => p.publishAt);
    const byDay = new Map();
    for (const item of scheduled) {
      const d = new Date(item.publishAt);
      if (d.getFullYear() === year && d.getMonth() === m) {
        const key = d.getDate();
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(item);
      }
    }

    const offset = new Date(year, m, 1).getDay();
    const total = new Date(year, m + 1, 0).getDate();
    const prevTotal = new Date(year, m, 0).getDate();
    const cellCount = Math.ceil((offset + total) / 7) * 7;
    const today = new Date();
    const isToday = (d) => today.getFullYear() === year && today.getMonth() === m && today.getDate() === d;

    const cells = [];
    for (let i = 0; i < cellCount; i += 1) {
      const day = i - offset + 1;
      const out = day < 1 || day > total;
      const label = out ? (day < 1 ? prevTotal + day : day - total) : day;
      const dateNum = out ? null : day;
      const list = dateNum ? byDay.get(dateNum) || [] : [];
      cells.push(`<button class="cal-day ${out ? 'out' : ''} ${dateNum && isToday(dateNum) ? 'today' : ''}" ${dateNum ? `data-day="${dateNum}"` : 'disabled'}>
        <span class="cal-num">${label}</span>
        <span class="cal-items">
          ${list.map((item) => `<span class="cal-chip ${item.stage === 'publicado' ? 'done' : ''}" data-item="${ui.esc(item.id)}"><small>${new Date(item.publishAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>${ui.esc(item.title)}</span>`).join('')}
        </span>
      </button>`);
    }

    const upcoming = scheduled
      .filter((p) => new Date(p.publishAt) >= new Date(Date.now() - 86_400_000))
      .sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt))
      .slice(0, 6);

    const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Distribuição · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Calendário</h1>
          <p class="page-sub">Cada publicação com data, plataforma e idioma no mesmo lugar. Clique em um dia para agendar; clique em um item para editar.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-primary" id="calNew"><svg class="ico"><use href="#i-plus"/></svg>Agendar</button>
        </div>
      </div>

      <div class="panel" style="padding:16px">
        <div class="cal-head">
          <div class="cal-month">${monthLabel}</div>
          <div style="display:flex;gap:6px">
            <button class="btn-icon" id="calPrev" aria-label="Mês anterior"><svg class="ico"><use href="#i-chev-left"/></svg></button>
            <button class="btn btn-sm" id="calToday">Hoje</button>
            <button class="btn-icon" id="calNext" aria-label="Próximo mês"><svg class="ico"><use href="#i-chev-right"/></svg></button>
          </div>
        </div>
        <div class="cal-week">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-head">
          <div class="panel-title">Próximas publicações</div>
          <span class="panel-sub">${scheduled.length} itens com data</span>
        </div>
        ${upcoming.length ? `<div style="padding:6px 0">
          ${upcoming.map((p) => `<div class="kcard" data-item="${ui.esc(p.id)}" style="margin:8px 14px;display:flex;align-items:center;gap:12px">
            <div style="font-family:var(--mono);font-size:11px;color:var(--pink);min-width:76px">${new Date(p.publishAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
            <div style="flex:1;min-width:0">
              <div class="kcard-title" style="max-width:none">${ui.esc(p.title)}</div>
              <div class="vid-channel">${ui.esc(p.stage)} · ${(p.platforms || []).length} plataformas · ${(p.languages || []).length} idiomas</div>
            </div>
            <svg class="ico" style="color:var(--dim)"><use href="#i-chev-right"/></svg>
          </div>`).join('')}
        </div>` : `<div style="padding:26px;text-align:center" class="panel-sub">Nada agendado. Clique em um dia do calendário para criar.</div>`}
      </div>`;
  },

  mount(root, ctx) {
    const month = currentMonth();

    root.querySelector('#calPrev')?.addEventListener('click', () => {
      shift(month, -1);
      ctx.refresh();
    });
    root.querySelector('#calNext')?.addEventListener('click', () => {
      shift(month, 1);
      ctx.refresh();
    });
    root.querySelector('#calToday')?.addEventListener('click', () => {
      state.settings.calMonth = monthKey(new Date());
      save();
      ctx.refresh();
    });

    const createFor = (date) => {
      const iso = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString() : '';
      openItemEditor(ctx, null, { publishAt: iso });
    };

    root.querySelector('#calNew')?.addEventListener('click', () => createFor(new Date()));

    root.querySelectorAll('.cal-day[data-day]').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.cal-chip')) return;
        createFor(new Date(month.getFullYear(), month.getMonth(), Number(cell.dataset.day)));
      });
    });

    root.querySelectorAll('[data-item]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = state.pipeline.find((p) => p.id === el.dataset.item);
        if (item) openItemEditor(ctx, item);
      });
    });
  },
};
