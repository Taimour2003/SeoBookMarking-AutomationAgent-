function inferMediaKind(url) {
  if (typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:video/')) return 'video';
  if (lower.startsWith('data:audio/')) return 'audio';
  if (lower.startsWith('data:image/')) return 'image';

  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|#|$)/i.test(lower)) return 'audio';
  if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/i.test(lower)) return 'image';
  return null;
}

function isUrlLike(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:') ||
    s.startsWith('blob:') ||
    s.startsWith('/')
  );
}

function pathToString(segments) {
  let out = '';
  for (const seg of segments) {
    if (!seg) continue;
    if (seg.startsWith('[')) {
      out += seg;
      continue;
    }
    out += (out ? '.' : '') + seg;
  }
  return out;
}

function scoreUrlCandidate({ url, path, key, parent }) {
  const urlStr = typeof url === 'string' ? url.trim() : '';
  if (!urlStr) return -Infinity;
  const lowerUrl = urlStr.toLowerCase();
  const pathStr = pathToString(path).toLowerCase();
  const lowerKey = typeof key === 'string' ? key.toLowerCase() : '';

  let score = 0;

  // Strong preference: explicit result/output keys.
  const exactKeyBonuses = {
    resultimage: 260,
    resultvideo: 260,
    resultaudio: 260,
    resulturl: 240,
    outputurl: 240,
    imageurl: 200,
    videourl: 200,
    audiourl: 200,
    enhancedimage: 210,
    upscaledimage: 210,
    syncedvideo: 210,
    url: 80,
    image: 120,
    video: 120,
    audio: 120,
    images: 160,
    videos: 160,
    audios: 160,
    output: 140,
    result: 140,
  };
  if (lowerKey && exactKeyBonuses[lowerKey] != null) score += exactKeyBonuses[lowerKey];

  // Path heuristics.
  if (pathStr.includes('result')) score += 60;
  if (pathStr.includes('output')) score += 60;
  if (/(^|\.)(generated|enhanced|upscaled|synced)/.test(pathStr)) score += 80;

  // Strong de-prioritization: input/source/target/reference assets.
  if (/(^|\.)(input|inputs)\b/.test(pathStr)) score -= 160;
  if (/(^|\.)(source|target|original|reference|mask)\b/.test(pathStr)) score -= 160;
  // Catch camelCase compound keys like sourceImage, inputImage, sourceUrl
  if (/^(source|input)(image|url|video|audio|file|media)/i.test(lowerKey)) score -= 160;

  // Strong de-prioritization: UI/marketing/media catalog assets.
  if (/(^|\.)(cover|icon|thumbnail|showcase|example|preview)\b/.test(pathStr)) score -= 240;
  if (/(^|\.)(cover|icon|thumbnail|showcase|example|preview)\b/.test(lowerKey)) score -= 240;

  // URL heuristics.
  if (lowerUrl.includes('replicate.delivery')) score += 40;
  if (lowerUrl.includes('fal.media') || lowerUrl.includes('fal.ai')) score += 30;
  if (lowerUrl.startsWith('https://aitopia.ai/uploads/')) score += 20;
  if (lowerUrl.startsWith('data:image/') || lowerUrl.startsWith('data:video/') || lowerUrl.startsWith('data:audio/'))
    score += 10;

  // Strongly de-prioritize known static asset directories.
  if (lowerUrl.includes('https://aitopia.ai/agent-images/')) score -= 240;
  if (lowerUrl.includes('https://aitopia.ai/agent-images-backup/')) score -= 240;
  if (lowerUrl.includes('/marketplace/favicon')) score -= 240;

  // Artifact-style objects: { type: 'image'|'video'|'audio', url: '...' }
  if (parent && typeof parent === 'object') {
    const type = typeof parent.type === 'string' ? parent.type.toLowerCase() : null;
    if (type === 'image' || type === 'video' || type === 'audio') {
      if (lowerKey === 'url' || lowerKey.endsWith('url')) score += 160;
    }
  }

  return score;
}

function pickBestUrls(candidates) {
  if (candidates.length <= 1) return candidates;
  const sorted = candidates.slice().sort((a, b) => b.score - a.score || a.order - b.order);
  const topScore = sorted[0].score;
  const hasConfident = topScore >= 120;
  if (!hasConfident) return sorted;
  const cutoff = Math.max(1, topScore - 60);
  return sorted.filter((c) => c.score >= cutoff);
}

export function collectMediaUrls(value) {
  const candidatesByUrl = new Map();
  const stack = [{ value, path: [], key: null, parent: null }];
  const visited = new Set();
  let order = 0;

  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) continue;
    const curValue = cur.value;
    if (curValue == null) continue;

    if (typeof curValue === 'string') {
      const url = curValue.trim();
      if (!isUrlLike(url)) continue;
      const kind = inferMediaKind(url);
      if (!kind) continue;

      const score = scoreUrlCandidate({ url, path: cur.path, key: cur.key, parent: cur.parent });
      const existing = candidatesByUrl.get(url);
      if (!existing || score > existing.score) {
        candidatesByUrl.set(url, { url, kind, score, order: order++ });
      }
      continue;
    }

    if (Array.isArray(curValue)) {
      for (let i = curValue.length - 1; i >= 0; i--) {
        stack.push({
          value: curValue[i],
          path: cur.path.concat(`[${i}]`),
          key: null,
          parent: curValue,
        });
      }
      continue;
    }

    if (typeof curValue === 'object') {
      if (visited.has(curValue)) continue;
      visited.add(curValue);

      const entries = Object.entries(curValue);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [key, val] = entries[i];
        stack.push({ value: val, path: cur.path.concat(key), key, parent: curValue });
      }
    }
  }

  const all = Array.from(candidatesByUrl.values());
  const images = pickBestUrls(all.filter((c) => c.kind === 'image')).map((c) => c.url);
  const videos = pickBestUrls(all.filter((c) => c.kind === 'video')).map((c) => c.url);
  const audios = pickBestUrls(all.filter((c) => c.kind === 'audio')).map((c) => c.url);

  return { images, videos, audios };
}

