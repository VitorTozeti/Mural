/**
 * github.js - Leitura e escrita do data.json via GitHub REST API
 */

const GitHubSync = {
  lastSha: null,

  getConfig() {
    return {
      token: localStorage.getItem('mural_github_token') || '',
      repo: localStorage.getItem('mural_github_repo') || '',
      path: 'data.json'
    };
  },

  async loadData() {
    const config = this.getConfig();
    if (!config.token || !config.repo) {
      console.warn("GitHub token ou repositório não configurados.");
      return null;
    }

    const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do GitHub: ${response.statusText}`);
    }

    const json = await response.json();
    this.lastSha = json.sha;

    // Decodifica conteúdo em base64 com suporte UTF-8
    const content = decodeURIComponent(escape(window.atob(json.content)));
    return JSON.parse(content);
  },

  async saveData(dataObject) {
    const config = this.getConfig();
    if (!config.token || !config.repo) {
      throw new Error("GitHub token ou repositório não configurados.");
    }

    const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
    const contentStr = JSON.stringify(dataObject, null, 2);
    const contentBase64 = window.btoa(unescape(encodeURIComponent(contentStr)));

    const body = {
      message: `Atualizar mural: ${new Date().toISOString()}`,
      content: contentBase64,
      sha: this.lastSha
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.status === 409) {
      // Conflito: precisa reler e reaplicar
      throw new Error("CONFLICT_409");
    }

    if (!response.ok) {
      throw new Error(`Erro ao salvar no GitHub: ${response.statusText}`);
    }

    const resJson = await response.json();
    this.lastSha = resJson.content.sha;
    return true;
  }
};

window.GitHubSync = GitHubSync;
