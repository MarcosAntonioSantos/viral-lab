import { state, save, uid, resetAll, setFeed, hasApiKey } from '../lib/store.js';
import { DEMO_VIDEOS } from '../lib/seed.js';
import * as ui from '../lib/ui.js';

function openNicheEditor(ctx, niche = null) {
  const body = `
    <form class="form" id="nicheForm">
      <div class="field"><label for="nc_name">Nome do nicho</label>
        <input class="input" id="nc_name" required value="${ui.esc(niche?.name || '')}" placeholder="Ex.: GTA VI">
      </div>
      <div class="field"><label for="nc_queries">Buscas no YouTube — uma por linha</label>
        <textarea class="textarea" id="nc_queries" style="min-height:140px" placeholder="GTA 6&#10;GTA VI trailer">${ui.esc((niche?.queries || []).join('\n'))}</textarea>
        <span class="panel-sub">Cada linha vira uma busca de 100 unidades. Use 6 a 8 termos específicos, não genéricos.</span>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar nicho</button>
      </div>
    </form>`;

  ui.openSheet({
    kicker: niche ? 'Editar nicho' : 'Novo nicho',
    title: niche ? 'Editar nicho' : 'Adicionar nicho',
    body,
    onMount: (dialog) => {
      dialog.querySelector('#nicheForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dialog.querySelector('#nc_name').value.trim();
        const queries = ui.words(dialog.querySelector('#nc_queries').value);
        if (!name) return;
        if (niche) {
          niche.name = name;
          niche.queries = queries;
        } else {
          const item = { id: uid('n'), name, queries, createdAt: new Date().toISOString() };
          state.niches.push(item);
          state.activeNiche = item.id;
        }
        save();
        dialog.close();
        ui.toast('Nicho salvo');
        ctx.refresh();
      });
    },
  });
}

function toCSV(items) {
  const head = ['titulo', 'canal', 'publicado', 'views', 'likes', 'comentarios', 'duracao_s', 'url', 'demo'];
  const rows = items.map((v) => [
    v.title, v.channelTitle, v.publishedAt, v.views, v.likes, v.comments, v.duration,
    v.demo ? '' : `https://youtu.be/${v.id}`, v.demo ? 'sim' : 'não',
  ]);
  return [head, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export const config = {
  render(ctx) {
    const queries = state.niches.reduce((sum, n) => sum + n.queries.length, 0);
    const feed = state.feeds[ctx.niche.id];
    const sizeKb = Math.round(JSON.stringify(state).length / 1024);

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Sistema</span>
          <h1 class="page-title">Configurações</h1>
          <p class="page-sub">Chave da API, nichos, importação e exportação. Tudo fica salvo apenas neste navegador.</p>
        </div>
      </div>

      <div style="display:grid;gap:16px;max-width:900px">

        <section class="panel" style="padding:18px">
          <div class="panel-head" style="padding:0 0 14px;border-bottom:1px solid var(--line);margin-bottom:16px">
            <div>
              <div class="panel-title">Conexão YouTube</div>
              <div class="panel-sub">A chave nunca é gravada no servidor — fica no localStorage deste navegador.</div>
            </div>
            <span class="badge ${hasApiKey() ? 'ok' : 'warn'}">${state.apiKey ? 'chave salva' : hasApiKey() ? 'chave do servidor' : 'sem chave'}</span>
          </div>

          <div class="field" style="margin-bottom:12px">
            <label for="cfgKey">YouTube Data API v3 — chave</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input class="input" id="cfgKey" type="password" style="flex:1;min-width:240px" value="${ui.esc(state.apiKey)}" placeholder="AIza…">
              <button class="btn" id="cfgTest">Testar</button>
              <button class="btn btn-primary" id="cfgSave">Salvar chave</button>
            </div>
          </div>

          <div class="prose" style="font-size:12px">
            <p><strong>Como conseguir (leva ~5 min, é gratuito):</strong></p>
            <ol>
              <li>Acesse <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" style="color:var(--pink)">console.cloud.google.com</a> e crie um projeto.</li>
              <li>Em <b>APIs e serviços → Biblioteca</b>, ative a <b>YouTube Data API v3</b>.</li>
              <li>Em <b>Credenciais → Criar credenciais → Chave de API</b>, copie a chave.</li>
              <li>Opcional: restrinja a chave à YouTube Data API v3.</li>
            </ol>
            <p style="margin-top:10px"><strong>Custo:</strong> a cota gratuita é de <b>10.000 unidades/dia</b> e não exige cartão. Uma busca custa 100 unidades; detalhes de vídeo/canal custam 1. Ou seja: ~100 buscas ou ~10.000 enriquecimentos por dia. Acima disso a API responde com erro de quota até a renovação (meia-noite no Pacífico).</p>
            <p style="margin-top:8px" class="dim">Buscas cadastradas: ${queries} · cada atualização completa do radar ≈ ${queries * 100} unidades.</p>
          </div>
        </section>

        <section class="panel" style="padding:18px">
          <div class="panel-head" style="padding:0 0 14px;border-bottom:1px solid var(--line);margin-bottom:14px">
            <div>
              <div class="panel-title">Nichos</div>
              <div class="panel-sub">Cada nicho tem suas buscas e seus próprios dados.</div>
            </div>
            <button class="btn btn-sm" id="cfgAddNiche"><svg class="ico"><use href="#i-plus"/></svg>Novo</button>
          </div>
          <div style="display:grid;gap:8px">
            ${state.niches.map((n) => `<div class="kcard" style="display:flex;align-items:center;gap:12px;cursor:default">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500">${ui.esc(n.name)} ${n.id === state.activeNiche ? '<span class="badge ok" style="margin-left:6px">ativo</span>' : ''}</div>
                <div class="vid-channel">${n.queries.length} buscas · ${ui.esc(n.queries.join(', '))}</div>
              </div>
              <button class="btn-icon" data-edit-niche="${n.id}" title="Editar"><svg class="ico"><use href="#i-sliders"/></svg></button>
              <button class="btn-icon" data-del-niche="${n.id}" title="Excluir"><svg class="ico"><use href="#i-trash"/></svg></button>
            </div>`).join('')}
          </div>
        </section>

        <section class="panel" style="padding:18px">
          <div class="panel-head" style="padding:0 0 14px;border-bottom:1px solid var(--line);margin-bottom:14px">
            <div>
              <div class="panel-title">Dados</div>
              <div class="panel-sub">${sizeKb} KB salvos · ${feed?.items?.length || 0} vídeos no nicho atual</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="cfgExport"><svg class="ico"><use href="#i-download"/></svg>Exportar JSON</button>
            <button class="btn" id="cfgCsv"><svg class="ico"><use href="#i-download"/></svg>Exportar CSV</button>
            <button class="btn" id="cfgImport"><svg class="ico"><use href="#i-upload"/></svg>Importar JSON</button>
            <button class="btn" id="cfgDemo">Carregar demonstração</button>
            <button class="btn btn-danger" id="cfgReset"><svg class="ico"><use href="#i-trash"/></svg>Resetar tudo</button>
            <input type="file" id="cfgFile" accept="application/json,.json" hidden>
          </div>
          <p class="panel-sub" style="margin-top:12px">O JSON exportado não inclui a chave da API. A importação substitui todos os dados atuais, exceto a chave.</p>
        </section>

        <section class="panel" style="padding:18px">
          <div class="panel-title" style="margin-bottom:10px">Sobre</div>
          <p class="prose" style="font-size:12px">Viral Lab · central local de estudo, replicação e distribuição. Sem banco de dados, sem login, sem telemetria: tudo em <b>localStorage</b>. Para dados reais, conecte a YouTube Data API; o restante — formatos, pipeline, calendário, plataformas e idiomas — funciona offline.</p>
        </section>
      </div>`;
  },

  mount(root, ctx) {
    const keyInput = root.querySelector('#cfgKey');

    root.querySelector('#cfgSave')?.addEventListener('click', () => {
      state.apiKey = keyInput.value.trim();
      save();
      ui.toast(state.apiKey ? 'Chave salva' : 'Chave removida');
      ctx.refresh();
    });

    root.querySelector('#cfgTest')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const key = keyInput.value.trim();
      btn.disabled = true;
      btn.textContent = 'Testando…';
      try {
        const r = await fetch('/api/yt/videos?part=snippet&chart=mostPopular&maxResults=1&regionCode=BR', {
          headers: key ? { 'x-yt-key': key } : {},
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error?.message || `Erro ${r.status}`);
        ui.toast(`Conexão ok · ${data.items?.[0]?.snippet?.title || 'API respondeu'}`);
      } catch (err) {
        ui.toast(err.message || 'Falha na conexão', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Testar';
      }
    });

    root.querySelector('#cfgAddNiche')?.addEventListener('click', () => openNicheEditor(ctx));
    root.querySelectorAll('[data-edit-niche]').forEach((b) => b.addEventListener('click', () => {
      const n = state.niches.find((x) => x.id === b.dataset.editNiche);
      if (n) openNicheEditor(ctx, n);
    }));
    root.querySelectorAll('[data-del-niche]').forEach((b) => b.addEventListener('click', () => {
      if (state.niches.length <= 1) return ui.toast('Mantenha pelo menos um nicho.', 'error');
      const n = state.niches.find((x) => x.id === b.dataset.delNiche);
      if (!n || !confirm(`Excluir o nicho "${n.name}" e todos os dados ligados a ele?`)) return;
      state.niches = state.niches.filter((x) => x.id !== n.id);
      delete state.feeds[n.id];
      state.channels = state.channels.filter((c) => c.nicheId !== n.id);
      state.pipeline = state.pipeline.filter((p) => p.nicheId !== n.id);
      if (state.activeNiche === n.id) state.activeNiche = state.niches[0].id;
      save();
      ui.toast('Nicho excluído');
      ctx.refresh();
    }));

    root.querySelector('#cfgExport')?.addEventListener('click', () => {
      const { apiKey, ...safe } = state;
      ui.downloadFile(`viral-lab-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(safe, null, 2));
      ui.toast('Backup exportado');
    });

    root.querySelector('#cfgCsv')?.addEventListener('click', () => {
      const items = state.feeds[ctx.niche.id]?.items || [];
      if (!items.length) return ui.toast('Nenhum vídeo para exportar.', 'error');
      ui.downloadFile(`radar-${ctx.niche.id}.csv`, `\ufeff${toCSV(items)}`, 'text/csv;charset=utf-8');
      ui.toast('CSV exportado');
    });

    const file = root.querySelector('#cfgFile');
    root.querySelector('#cfgImport')?.addEventListener('click', () => file.click());
    file?.addEventListener('change', async () => {
      const picked = file.files?.[0];
      if (!picked) return;
      try {
        const data = JSON.parse(await picked.text());
        if (!data || !Array.isArray(data.niches) || !data.niches.length) throw new Error('Arquivo inválido.');
        Object.assign(state, data, { apiKey: state.apiKey });
        save();
        ui.toast('Backup importado');
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        ui.toast(err.message || 'Não foi possível importar.', 'error');
      }
    });

    root.querySelector('#cfgDemo')?.addEventListener('click', () => {
      setFeed(structuredClone(DEMO_VIDEOS), 'demo');
      state.settings.demo = true;
      save();
      ui.toast('Demonstração carregada');
      ctx.refresh();
    });

    root.querySelector('#cfgReset')?.addEventListener('click', () => {
      if (!confirm('Apagar todos os dados, formatos e itens do pipeline?')) return;
      if (!confirm('Tem certeza? Essa ação não pode ser desfeita.')) return;
      resetAll();
    });
  },
};
