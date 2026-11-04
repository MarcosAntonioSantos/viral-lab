import { state, save, hasApiKey } from '../lib/store.js';
import { analyzeChannel } from '../lib/api.js';
import { viralScore, viewsPerDay, median } from '../lib/metrics.js';
import * as ui from '../lib/ui.js';
import { openVideo } from './radar.js';

function channelVideos(channel) {
  return (channel.outliers?.length ? channel.outliers : channel.videos || []).slice(0, 4);
}

function openAll(channel, ctx) {
  const list = (channel.outliers?.length ? channel.outliers : channel.videos) || [];
  const body = `
    <p class="panel-sub" style="margin-bottom:12px">${list.length} vídeos analisados · mediana de ${ui.num(channel.median)} views. Outliers em destaque.</p>
    <div class="vtable" style="display:grid;gap:8px">
      ${list.map((v) => `<div class="kcard" data-vid="${ui.esc(v.id)}" style="cursor:pointer;display:flex;gap:11px;align-items:center">
        ${ui.thumb(v, 76)}
        <div style="min-width:0;flex:1">
          <div class="vid-title" style="max-width:none">${ui.esc(v.title)}</div>
          <div class="vid-channel">${ui.ago(v.publishedAt)} · ${ui.num(v.views)} views · ${ui.num(viewsPerDay(v))}/dia · ${v.outlierRatio ? v.outlierRatio.toFixed(1) + '× mediana' : ''}</div>
        </div>
        ${ui.scoreBar(viralScore(v))}
      </div>`).join('')}
    </div>`;

  const d = ui.openSheet({ kicker: channel.title, title: 'Vídeos analisados', body, wide: true });
  d.querySelectorAll('[data-vid]').forEach((row) => {
    row.addEventListener('click', () => {
      const v = list.find((x) => x.id === row.dataset.vid);
      if (v) openVideo(v, ctx);
    });
  });
}

export const channels = {
  render(ctx) {
    const term = (ctx.search || '').toLowerCase();
    const list = state.channels.filter((c) =>
      c.nicheId === ctx.niche.id && (!term || c.title.toLowerCase().includes(term)));

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Benchmark · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">Canais de referência</h1>
          <p class="page-sub">Quem já venceu no nicho, a mediana de views e os vídeos que explodiram contra o próprio histórico. Esses são os formatos a estudar.</p>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head">
          <div>
            <div class="panel-title">Adicionar canal</div>
            <div class="panel-sub">Cole a URL, o @handle ou o ID. Lê os últimos 50 uploads (~3 unidades de quota).</div>
          </div>
        </div>
        <form id="chForm" style="display:flex;gap:9px;padding:14px 17px;flex-wrap:wrap">
          <input class="input" id="chInput" style="flex:1;min-width:240px" placeholder="https://youtube.com/@RadarLeonida ou @RadarLeonida">
          <button class="btn btn-primary" id="chAdd" type="submit"><svg class="ico"><use href="#i-search"/></svg>Analisar canal</button>
        </form>
      </div>

      ${list.length === 0 ? `<div class="empty">
        <div class="empty-art"><svg class="ico"><use href="#i-channels"/></svg></div>
        <h3>Nenhum canal monitorado</h3>
        <p>Comece pelos canais que o Radar já revelou. O motor calcula a mediana do canal e isola os vídeos com 2× ou mais views — o verdadeiro sinal de formato vencedor.</p>
      </div>` : ''}

      <div class="cards">
        ${list.map((c) => `
          <article class="card">
            <div class="card-head">
              <div style="display:flex;gap:10px;align-items:center;min-width:0">
                ${ui.avatar(c.avatar, c.title)}
                <div style="min-width:0">
                  <h3 class="card-title">${ui.esc(c.title)}</h3>
                  <div class="card-sub">${ui.num(c.subs)} inscritos · ${c.handle ? ui.esc(c.handle) : ''}</div>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn-icon" data-re="${c.id}" title="Reanalisar"><svg class="ico"><use href="#i-refresh"/></svg></button>
                <button class="btn-icon" data-del="${c.id}" title="Remover"><svg class="ico"><use href="#i-trash"/></svg></button>
              </div>
            </div>

            <div class="metrics-row">
              <div class="metric"><span>Mediana</span><b>${ui.num(c.median)}</b></div>
              <div class="metric"><span>Média</span><b>${ui.num(c.avg)}</b></div>
              <div class="metric"><span>Outliers</span><b>${c.outliers?.length || 0}</b></div>
            </div>

            <div class="panel-sub" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span>Vídeos mais fortes</span>
              <button class="btn btn-sm btn-ghost" data-all="${c.id}">ver todos →</button>
            </div>

            <div style="display:grid;gap:6px">
              ${channelVideos(c).map((v) => `<div class="kcard" data-vid="${ui.esc(v.id)}" style="display:flex;gap:9px;align-items:center;padding:8px">
                ${ui.thumb(v, 62)}
                <div style="min-width:0;flex:1">
                  <div class="vid-title" style="font-size:11.5px;max-width:none">${ui.esc(v.title)}</div>
                  <div class="vid-channel">${ui.num(v.views)} views ${v.outlierRatio >= 2 ? `<span class="badge hot" style="margin-left:4px">${v.outlierRatio.toFixed(1)}×</span>` : ''}</div>
                </div>
              </div>`).join('') || '<p class="panel-sub">Sem vídeos recentes.</p>'}
            </div>
          </article>`).join('')}
      </div>`;
  },

  mount(root, ctx) {
    const form = root.querySelector('#chForm');
    const input = root.querySelector('#chInput');
    const btn = root.querySelector('#chAdd');

    const run = async (value) => {
      if (!value.trim()) return;
      if (!hasApiKey()) {
        ui.toast('Salve sua chave da API primeiro.', 'error');
        location.hash = '#/config';
        return;
      }
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<svg class="ico"><use href="#i-refresh"/></svg>Analisando…';
      try {
        const data = await analyzeChannel(value.trim(), state.apiKey);
        const record = { ...data, nicheId: ctx.niche.id };
        const idx = state.channels.findIndex((c) => c.id === data.id && c.nicheId === ctx.niche.id);
        if (idx >= 0) state.channels[idx] = record;
        else state.channels.push(record);
        save();
        ui.toast(`${data.analyzed} vídeos analisados · ${data.outliers.length} outliers`);
        ctx.refresh();
      } catch (err) {
        ui.toast(err.message || 'Falha ao analisar o canal.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      run(input.value);
    });

    root.querySelectorAll('[data-re]').forEach((b) => b.addEventListener('click', () => {
      const c = state.channels.find((x) => x.id === b.dataset.re && x.nicheId === ctx.niche.id);
      if (c) {
        input.value = c.handle || `https://www.youtube.com/channel/${c.id}`;
        run(input.value);
      }
    }));

    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('Remover este canal do monitoramento?')) return;
      state.channels = state.channels.filter((x) => !(x.id === b.dataset.del && x.nicheId === ctx.niche.id));
      save();
      ui.toast('Canal removido');
      ctx.refresh();
    }));

    root.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
      const c = state.channels.find((x) => x.id === b.dataset.all && x.nicheId === ctx.niche.id);
      if (c) openAll(c, ctx);
    }));

    root.querySelectorAll('[data-vid]').forEach((row) => {
      row.addEventListener('click', () => {
        const pool = state.channels
          .filter((x) => x.nicheId === ctx.niche.id)
          .flatMap((x) => [...(x.videos || []), ...(x.outliers || [])]);
        const v = pool.find((x) => x.id === row.dataset.vid);
        if (v) openVideo(v, ctx);
      });
    });
  },
};
