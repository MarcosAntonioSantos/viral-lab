# Viral Lab

Central local para estudar o que performa no nicho, transformar em formato replicável, produzir derivados e distribuir em várias plataformas e idiomas. Primeiro nicho: **GTA VI**.

Interface dark, sem login, sem banco de dados. Tudo fica no `localStorage` do navegador.

## Rodar

```bash
cd viral-lab
npm start
```

Abra http://localhost:4173. Não há build nem dependências.

## Chave da YouTube Data API (gratuita)

1. Abra https://console.cloud.google.com/ e crie um projeto.
2. **APIs e serviços → Biblioteca** → ative **YouTube Data API v3**.
3. **Credenciais → Criar credenciais → Chave de API**.
4. Cole a chave em **Configurações** no app (ou defina `YOUTUBE_API_KEY` antes de iniciar o servidor).

Cota padrão: **10.000 unidades/dia**, sem cartão de crédito.

| Operação | Custo |
| --- | --- |
| `search.list` (cada termo buscado) | 100 |
| `videos.list` (até 50 ids) | 1 |
| `channels.list` (até 50 ids) | 1 |
| `playlistItems.list` | 1 |

Uma atualização do radar com 6 buscas ≈ 600 unidades. Analisar um canal ≈ 4 unidades. A cota renova à meia-noite no horário do Pacífico.

## O que tem dentro

- **Radar** — vídeos do nicho por período, ordenados por score (views/dia + engajamento). A ficha de replicação já gera roteiro, títulos, thumbnail e sugestões, com atalho para criar no pipeline ou mesclar com outro vídeo.
- **Canais** — mediana do canal e outliers (vídeos com 2× ou mais views que a mediana). É o sinal mais confiável de formato vencedor.
- **Formatos** — biblioteca de moldes de produção, editável e reutilizável. “→ Pipeline” já entrega o roteiro montado.
- **Estúdio de roteiro** — roteiros em blocos (hook → contexto → prova → desenvolvimento → virada → CTA), tempo por bloco, humanização do texto, sugestões do que aplicar, mesclagem de dois ou mais vídeos e biblioteca de blocos reutilizáveis.
- **Pipeline** — kanban de Ideia → Roteiro → Produção → Localização → Pronto → Publicado, com editor por abas (roteiro, embalagem, checklist e histórico de versões).
- **Calendário** — agenda de publicação por dia, ligada ao pipeline.
- **Plataformas** — YouTube, Shorts, TikTok, Reels, Facebook, Rumble, X, Kwai, Bilibili e Douyin, com formato, monetização e papel na rede.
- **Idiomas** — 16 mercados em três tiers, com pacote de localização.
- **Método** — o ciclo de replicação e o playbook de GTA VI.
- **Configurações** — nichos, import/export JSON, export CSV do radar.

## Estrutura

```
server.mjs          proxy da YouTube API + arquivos estáticos (zero dependências)
public/
  index.html        shell, sidebar, topbar, ícones SVG
  styles.css        design system dark
  app.js            rotas, estado de UI, busca global
  lib/seed.js       plataformas, idiomas, formatos e dados de demonstração
  lib/store.js      persistência em localStorage
  lib/api.js        cliente da API e cálculo de outliers
  lib/metrics.js    score viral, views/dia, mediana
  lib/script.js     roteiro em blocos, humanização, sugestões, mesclagem e pacote
  lib/script-ui.js  prévia de blocos e diálogo de mesclagem
  lib/autopilot.js  criação automática de roteiros no pipeline
  lib/ui.js         helpers de DOM, sheets, toasts
  views/            uma view por arquivo
```

## Modelo de dados

`state` é um objeto único persistido em `viral-lab-v2`:

- `niches[]` — nome e termos de busca
- `feeds[nicho]` — vídeos coletados + origem (`api` ou `demo`)
- `channels[]` — canais analisados, com mediana e outliers
- `formats[]` — moldes de produção
- `blocks[]` — biblioteca de blocos reutilizáveis, com tokens `{tema}`, `{canal}`, `{numero}` e `{praca}`
- `pipeline[]` — itens com estágio, plataformas, idiomas, roteiro em `beats`, referências, embalagem e checklist
- `platforms[]` / `languages[]` — configuração da rede

## Roteiro assistido

A geração é local e determinística: não chama nenhum modelo externo. O app infere o ângulo pelo título/tags, escolhe blocos da biblioteca do nicho e distribui o tempo conforme a duração alvo. A humanização aplica regras de reescrita (remove clichês, travessões e frases infladas). Tudo pode ser editado bloco por bloco, reaproveitado em outro item ou mesclado com outra referência.

O pacote exportado em Markdown traz título, alternativas, roteiro com tempos, descrição, tags, thumbnail, referências e checklist.

## Publicação (padrão manual)

O app prepara o pacote; o upload é feito pelo usuário, manualmente, plataforma por plataforma. Padrão de preenchimento:

| Campo | Padrão |
|---|---|
| **Título** | Use o vencedor do pacote (`## Títulos`), respeitando 60 caracteres (desktop) / 40 (mobile). Não repita o título no thumbnail. |
| **Descrição** | Cole o texto de `## Descrição` do pacote. Inclua capítulos com tempos e as referências usadas. Não invente receita, RPM ou visualizações. |
| **Tags** | Use as tags de `## Tags` do pacote, separadas por vírgula. Máximo de tags úteis; não encha com palavras irrelevantes. |
| **Categoria** | Jogos (ou a categoria equivalente na plataforma de destino). |
| **Visibilidade** | **Não listado** até revisar. Só mude para Público após confirmar que o roteório, thumbnail e descrição estão alinhados com o pacote aprovado. |
| **Thumbnail** | Até 3 palavras, nunca repete o título, número/nome/data batem qualquer adjetivo. Contraste alto para feed pequeno. |

A publicação continua manual: o app não faz upload automático para nenhuma plataforma.

## Empacotamento (yt-package + yt-viral)

Título e thumbnail são tratados como uma unidade, não peças separadas. As regras aplicadas no pacote:

- **Truncamento:** 60 caracteres (desktop) / 40 (mobile feed), ambos reportados.
- **ALL-CAPS:** no máximo 2 palavras em maiúsculas acima disso soa como spam.
- **Thumbnail:** até 3 palavras, nunca repete o título; número/nome/data batem qualquer adjetivo.
- **Score de título:** penaliza ALL-CAPS excedente e truncamento; premia número e pontuação de promessa (: ! ?).

O outlier é detectado por múltiplo sobre a mediana do próprio canal (`findOutliers`), não por views brutas — um vídeo com menos views mas desempenho acima da mediana do canal vale mais como referência de formato.

## Dados de demonstração

O botão **Carregar demo** preenche o radar com 14 itens fictícios, apenas para validar o layout sem gastar cota. Estão marcados como `demo` na interface e no CSV.

## Direito autoral

O sistema replica **estrutura, ângulo e embalagem**, nunca o arquivo de terceiros. Use material próprio, capturas permitidas, fontes oficiais e arte original. Reupload derruba canal e plataforma.
