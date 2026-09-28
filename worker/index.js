/**
 * Cloudflare Worker do Mural — guarda o token do GitHub em segredo e lê/grava o data.json.
 *
 * Variáveis (Settings → Variables and Secrets):
 *   REPO             texto   ex.: VitorTozeti/Mural
 *   ALLOWED_ORIGINS  texto   ex.: https://vitortozeti.github.io,http://localhost:8792
 *   GITHUB_TOKEN     segredo Fine-grained token com Contents: Read and write no REPO
 *   MURAL_PASSWORD   segredo (opcional) se existir, o site precisa da senha; sem ela, só o site em ALLOWED_ORIGINS acessa
 *   DATA_PATH        texto   (opcional) padrão: data.json
 */

const GITHUB_API = 'https://api.github.com';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Mural-Key',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/data') return json({ error: 'not_found' }, 404);

    if (!env.GITHUB_TOKEN || !env.REPO) return json({ error: 'worker_not_configured' }, 500);
    if (env.MURAL_PASSWORD) {
      if (!safeEqual(request.headers.get('X-Mural-Key') || '', env.MURAL_PASSWORD)) {
        return json({ error: 'unauthorized' }, 401);
      }
    } else if (!allowed.includes(origin)) {
      return json({ error: 'forbidden_origin' }, 403);
    }

    const path = env.DATA_PATH || 'data.json';
    const github = (method, body) => fetch(`${GITHUB_API}/repos/${env.REPO}/contents/${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'mural-worker',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (request.method === 'GET') {
      const res = await github('GET');
      if (!res.ok) return json({ error: 'github_error', status: res.status }, 502);
      const file = await res.json();
      const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      return json({ sha: file.sha, data: JSON.parse(new TextDecoder().decode(bytes)) });
    }

    if (request.method === 'PUT') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
      const { data, sha } = payload || {};
      if (!data || !Array.isArray(data.postits)) return json({ error: 'invalid_data' }, 400);

      const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
      let binary = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });

      const res = await github('PUT', {
        message: `Atualizar mural: ${new Date().toISOString()}`,
        content: btoa(binary),
        sha
      });
      if (res.status === 409 || res.status === 422) return json({ error: 'conflict' }, 409);
      if (!res.ok) return json({ error: 'github_error', status: res.status }, 502);
      const saved = await res.json();
      return json({ sha: saved.content.sha });
    }

    return json({ error: 'method_not_allowed' }, 405);
  }
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
