/**
 * github.js - Lê e grava o data.json através do Cloudflare Worker (o token do GitHub fica só no Worker)
 */

const WORKER_URL = '';

const GitHubSync = {
  lastSha: null,

  getConfig() {
    return {
      url: (localStorage.getItem('mural_server_url') || WORKER_URL).trim().replace(/\/+$/, ''),
      key: localStorage.getItem('mural_key') || ''
    };
  },

  async request(method, body) {
    const { url, key } = this.getConfig();
    const res = await fetch(`${url}/data`, {
      method,
      headers: {
        'X-Mural-Key': key,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status === 409) throw new Error('CONFLICT_409');
    if (!res.ok) throw new Error(`Erro no servidor do mural: ${res.status}`);
    return res.json();
  },

  async loadData() {
    if (!this.getConfig().url) return null;
    const res = await this.request('GET');
    this.lastSha = res.sha;
    return res.data;
  },

  async saveData(dataObject) {
    if (!this.getConfig().url) throw new Error('Servidor do mural não configurado.');
    const res = await this.request('PUT', { data: dataObject, sha: this.lastSha });
    this.lastSha = res.sha;
    return true;
  }
};

window.GitHubSync = GitHubSync;
