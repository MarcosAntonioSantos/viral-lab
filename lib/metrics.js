export const daysSince = (iso) => Math.max(0.35, (Date.now() - new Date(iso).getTime()) / 86_400_000);

export const viewsPerDay = (v) => (v.views || 0) / daysSince(v.publishedAt);

export const engagement = (v) => {
  const views = v.views || 0;
  if (!views) return 0;
  return ((v.likes || 0) + (v.comments || 0)) / views * 100;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Score 0-100. Combina velocidade (views/dia), engajamento e, quando existe,
 * o quanto o vídeo superou a mediana do próprio canal.
 */
export function viralScore(v) {
  const speed = Math.min(Math.sqrt(viewsPerDay(v) / 1_000_000) * 55, 55);
  const eng = Math.min(engagement(v) / 8, 1) * 25;
  const outlier = v.outlierRatio ? Math.min(v.outlierRatio / 8, 1) * 20 : 0;
  return Math.round(clamp(speed + eng + outlier, 0, 100));
}

export function median(values) {
  const arr = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
