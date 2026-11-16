const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const int = (n) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(n) || 0));

export const num = (n) => new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(n) || 0);

export const pct = (n, digits = 1) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;

export const durFmt = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

export const ago = (iso) => {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return 'hoje';
  if (days < 2) return 'ontem';
  if (days < 30) return `há ${Math.floor(days)} d`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} ano(s)`;
};

export const dateBR = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const dateShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

export const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const toDateTimeInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'VL';

export function thumb(v, size = 88) {
  return `<div class="thumb" style="--w:${size}px">
    <span class="thumb-fallback">${esc(initials(v.channelTitle || v.title))}</span>
    ${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    ${v.duration ? `<i>${durFmt(v.duration)}</i>` : ''}
  </div>`;
}

export function avatar(url, name) {
  return `<span class="avatar">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc(initials(name))}</b></span>`;
}

export function scoreBar(score) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return `<div class="score" title="Score viral (velocidade + engajamento + outlier)">
    <span class="score-num">${value}</span>
    <span class="score-track"><i style="width:${value}%"></i></span>
  </div>`;
}

export function tags(list = [], max = 3) {
  return `<span class="tags">${list.slice(0, max).map((t) => `<em>${esc(t)}</em>`).join('')}${
    list.length > max ? `<em class="more">+${list.length - max}</em>` : ''
  }</span>`;
}

export function openSheet({ kicker = '', title, body, wide = false, onMount }) {
  const d = document.createElement('dialog');
  d.className = `sheet${wide ? ' wide' : ''}`;
  d.innerHTML = `
    <div class="sheet-head">
      <div>
        ${kicker ? `<span class="eyebrow">${esc(kicker)}</span>` : ''}
        <h2>${esc(title)}</h2>
      </div>
      <button class="btn-icon" data-close aria-label="Fechar"><svg class="ico"><use href="#i-x"/></svg></button>
    </div>
    <div class="sheet-body">${body}</div>`;
  document.body.append(d);
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener('close', () => d.remove());
  d.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => d.close());
  });
  d.showModal();
  onMount?.(d);
  return d;
}

export function toast(message, type = 'ok') {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="ico"><use href="#i-${type === 'error' ? 'x' : 'check'}"/></svg><span>${esc(message)}</span>`;
  root.append(el);
  const life = type === 'error' ? 6500 : 3400;
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, life);
}

export async function copyText(text, label = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(label);
  }
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export const words = (text) => String(text || '').trim().split('\n').map((s) => s.trim()).filter(Boolean);
