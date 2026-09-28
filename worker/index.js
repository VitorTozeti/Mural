/**
 * Servidor do Mural (Cloudflare Pages Function em /data) — guarda as notas num banco D1.
 *
 * Configuração no painel do Pages (Settings → Bindings):
 *   D1 database  nome da variável: DB
 * Opcional (Settings → Variables and Secrets):
 *   ALLOWED_ORIGINS  outros sites liberados além do próprio endereço
 *   MURAL_PASSWORD   se existir, o site precisa da senha
 */

const EMPTY = { version: 1, postits: [], links: [] };
let tableReady = false;

function requestOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin;
  const referer = request.headers.get('Referer');
  try {
    return referer ? new URL(referer).origin : '';
  } catch {
    return '';
  }
}

async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS mural (id INTEGER PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL)'
  ).run();
  tableReady = true;
}

export default {
  async fetch(request, env) {
    const origin = requestOrigin(request);
    const allowed = [
      new URL(request.url).origin,
      ...(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    ];
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
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

    if (!env.DB) return json({ error: 'server_not_configured', hint: 'ligue o banco D1 com o nome DB' }, 500);
    if (env.MURAL_PASSWORD) {
      if (!safeEqual(request.headers.get('X-Mural-Key') || '', env.MURAL_PASSWORD)) {
        return json({ error: 'unauthorized' }, 401);
      }
    } else if (!allowed.includes(origin)) {
      return json({ error: 'forbidden_origin' }, 403);
    }

    await ensureTable(env.DB);

    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, version FROM mural WHERE id = 1').first();
      if (!row) return json({ sha: '0', data: EMPTY });
      return json({ sha: String(row.version), data: JSON.parse(row.data) });
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

      const expected = Number(sha) || 0;
      const text = JSON.stringify(data);

      if (expected === 0) {
        const inserted = await env.DB.prepare(
          'INSERT OR IGNORE INTO mural (id, data, version) VALUES (1, ?, 1)'
        ).bind(text).run();
        if (inserted.meta.changes === 1) return json({ sha: '1' });
        return json({ error: 'conflict' }, 409);
      }

      const updated = await env.DB.prepare(
        'UPDATE mural SET data = ?, version = version + 1 WHERE id = 1 AND version = ?'
      ).bind(text, expected).run();
      if (updated.meta.changes !== 1) return json({ error: 'conflict' }, 409);
      return json({ sha: String(expected + 1) });
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
