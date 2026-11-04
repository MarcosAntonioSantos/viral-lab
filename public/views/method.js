import { state } from '../lib/store.js';
import * as ui from '../lib/ui.js';

const LOOP = [
  ['Coletar', 'O Radar puxa os vídeos mais vistos do nicho por período. Canais de referência entram na análise para dar contexto.'],
  ['Isolar o outlier', 'O que importa não é o vídeo com mais views, e sim o que performou muito acima da mediana do próprio canal. Aí o formato venceu, não só o público.'],
  ['Desmontar o formato', 'Hook, estrutura, duração, ritmo, thumbnail e promessa. Vira uma ficha na biblioteca — replicável e sem copiar o arquivo de ninguém.'],
  ['Gerar o roteiro', 'O Estúdio monta hook, contexto, prova, desenvolvimento, virada e CTA, com tempo por bloco. A estrutura vem do que performou; o texto é seu e fica editável.'],
  ['Humanizar e mesclar', 'Regras de reescrita tiram clichê, travessão e frase inflada. Dois ou mais virais podem virar um híbrido, com o hook mais forte e uma prova de cada referência.'],
  ['Produzir derivados', 'Um master 16:9 e 5–8 cortes 9:16, cada um com hook próprio. Nunca um recorte sem contexto.'],
  ['Localizar', 'Título, thumbnail, legenda e dublagem por idioma ativo. Cada mercado tem seu vocabulário — tradução literal mata o clique.'],
  ['Distribuir', 'YouTube, Shorts, TikTok, Facebook, Reels, Rumble, X, Kwai, Bilibili. Conteúdo nativo por plataforma, sem watermark alheio.'],
  ['Medir e repetir', 'Retenção, CTR e views/dia por formato. O que passa do corte vira novo item do pipeline; o resto morre rápido.'],
];

export const method = {
  render(ctx) {
    const active = state.languages.filter((l) => l.active);

    return `
      <div class="page-head">
        <div>
          <span class="eyebrow">Sistema · ${ui.esc(ctx.niche.name)}</span>
          <h1 class="page-title">O método</h1>
          <p class="page-sub">Estudar o que funcionou, transformar em molde, produzir em série e distribuir em rede. O ciclo se repete a cada semana.</p>
        </div>
      </div>

      <div class="method-grid">
        <div class="panel" style="padding:18px">
          <div class="panel-title" style="margin-bottom:10px">O ciclo de replicação</div>
          <div class="loop">
            ${LOOP.map(([title, text], i) => `<div class="loop-step">
              <div class="loop-num">${String(i + 1).padStart(2, '0')}</div>
              <div><strong>${title}</strong><p>${text}</p></div>
            </div>`).join('')}
          </div>
        </div>

        <div style="display:grid;gap:16px">
          <div class="panel" style="padding:18px">
            <div class="panel-title" style="margin-bottom:12px">Playbook GTA VI</div>
            <div class="prose">
              <p><strong>Quatro frentes que sustentam o nicho:</strong></p>
              <ol>
                <li><strong>Notícia em 60s:</strong> velocidade. Publicar em até 2 horas, sempre com fonte na tela.</li>
                <li><strong>Análise frame a frame:</strong> profundidade. Funciona por meses e gera cortes infinitos.</li>
                <li><strong>Comparação e nostalgia:</strong> GTA V vs VI. Alcance amplo, inclusive fora da bolha.</li>
                <li><strong>Consumidor:</strong> preço, versões, PC. Intenção de compra e busca de cauda longa.</li>
              </ol>
              <p><strong>Cadência mínima:</strong> 1 vídeo longo por semana, 5 cortes verticais por semana e 1 notícia curta por dia quando houver fato novo.</p>
              <p><strong>Voz sem rosto:</strong> narração + captura de tela + motion graphics. A autoridade vem do ritmo e da precisão, não da câmera.</p>
              <p><strong>Roteiro assistido:</strong> o Estúdio gera a espinha (hook, prova, virada, CTA), aponta o que falta e sugere o que aplicar. Copie o formato, reescreva com suas palavras e mescle referências quando o tema permitir.</p>
            </div>
          </div>

          <div class="panel" style="padding:18px">
            <div class="panel-title" style="margin-bottom:10px">Rede em camadas</div>
            <div class="prose">
              <p><strong>Camada 1 — descoberta:</strong> Shorts, TikTok, Reels e Kwai. Testam hook e alimentam os canais longos.</p>
              <p><strong>Camada 2 — profundidade:</strong> YouTube e Rumble. Retenção, busca e receita por view mais alta.</p>
              <p><strong>Camada 3 — alcance regional:</strong> Facebook, X e Bilibili. Reaproveitam o master com embalagem local.</p>
              <p><strong>Idiomas primeiro:</strong> ${active.slice(0, 3).map((l) => `${l.flag} ${l.name}`).join(' · ') || 'ative o Tier 1 em Idiomas'}.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="callout" style="margin-top:16px">
        <b>Direito autoral:</b> este sistema replica <b>estrutura, ângulo e embalagem</b> — nunca o arquivo, o áudio ou o vídeo de terceiros. Use material próprio, capturas com uso permitido, fontes oficiais e arte original. Copiar o vídeo alheio derruba o canal e mata o projeto.
      </div>`;
  },
};
