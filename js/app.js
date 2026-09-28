/**
 * app.js - Inicialização, controle de estado local/remoto e eventos de UI
 */

const App = {
  data: {
    version: 1,
    updatedAt: new Date().toISOString(),
    postits: []
  },
  editingPostItId: null,

  async init() {
    this.bindEvents();
    BoardModule.init(document.getElementById('board'), (id, x, y) => this.updatePostItPosition(id, x, y));
    await this.loadInitialData();
    this.startPolling();
  },

  bindEvents() {
    // Configurações
    document.getElementById('btn-config').addEventListener('click', () => this.openConfigModal());
    document.getElementById('btn-close-config').addEventListener('click', () => this.closeConfigModal());
    document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());

    // Sincronização manual
    document.getElementById('btn-sync').addEventListener('click', () => this.syncRemote());

    // Novo Post-it
    document.getElementById('btn-add-postit').addEventListener('click', () => this.openPostItModal());
    document.getElementById('btn-cancel-postit').addEventListener('click', () => this.closePostItModal());
    document.getElementById('btn-save-postit').addEventListener('click', () => this.savePostIt());

    // Toggle de senha no modal de post-it
    document.getElementById('postit-locked').addEventListener('change', (e) => {
      const pwdGroup = document.getElementById('group-password');
      if (e.target.checked) {
        pwdGroup.classList.remove('hidden');
      } else {
        pwdGroup.classList.add('hidden');
      }
    });

    // Seletor de cores da paleta
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
      });
    });
  },

  async loadInitialData() {
    // Tenta carregar do GitHub primeiro, fallback para localStorage ou data.json inicial
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData) {
        this.data = remoteData;
        this.render();
        return;
      }
    } catch (err) {
      console.warn("Não foi possível carregar do GitHub, carregando do cache/local:", err);
    }

    const localSaved = localStorage.getItem('mural_local_data');
    if (localSaved) {
      try {
        this.data = JSON.parse(localSaved);
      } catch (e) {
        console.error("Erro ao fazer parse dos dados locais", e);
      }
    }
    this.render();
  },

  render() {
    BoardModule.renderBoard(this.data.postits, {
      onDragStart: (e, el, p) => BoardModule.startDrag(e, el, p),
      onEdit: (p) => this.openPostItModal(p),
      onDelete: (id) => this.deletePostIt(id),
      onUnlock: (p) => this.unlockPostIt(p)
    });
  },

  async persistData() {
    this.data.updatedAt = new Date().toISOString();
    localStorage.setItem('mural_local_data', JSON.stringify(this.data));
    this.render();

    try {
      await GitHubSync.saveData(this.data);
      console.log("Mural salvo no GitHub com sucesso!");
    } catch (err) {
      if (err.message === "CONFLICT_409") {
        console.warn("Conflito de versão ao salvar no GitHub! Recarregando dados remotos...");
        await this.syncRemote();
      } else {
        console.warn("Aviso ao persistir no GitHub:", err.message);
      }
    }
  },

  updatePostItPosition(id, x, y) {
    const p = this.data.postits.find(item => item.id === id);
    if (p) {
      p.x = x;
      p.y = y;
      this.persistData();
    }
  },

  openPostItModal(postit = null) {
    this.editingPostItId = postit ? postit.id : null;
    const modal = document.getElementById('modal-postit');
    const titleEl = document.getElementById('modal-postit-title');
    const textEl = document.getElementById('postit-text');
    const fontEl = document.getElementById('postit-font');
    const sizeEl = document.getElementById('postit-size');
    const emojiEl = document.getElementById('postit-emoji');
    const lockedEl = document.getElementById('postit-locked');
    const pwdGroup = document.getElementById('group-password');

    if (postit) {
      titleEl.innerText = "Editar Post-it";
      textEl.value = postit.text || '';
      fontEl.value = postit.font || 'Caveat';
      sizeEl.value = postit.size || 'medium';
      emojiEl.value = postit.emoji || '';
      lockedEl.checked = !!postit.locked;
      lockedEl.disabled = true; // Não permite alterar trava em edição
      pwdGroup.classList.add('hidden');
    } else {
      titleEl.innerText = "Criar Post-it";
      textEl.value = '';
      fontEl.value = 'Caveat';
      sizeEl.value = 'medium';
      emojiEl.value = '💬';
      lockedEl.checked = false;
      lockedEl.disabled = false;
      pwdGroup.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  },

  closePostItModal() {
    document.getElementById('modal-postit').classList.add('hidden');
    this.editingPostItId = null;
  },

  async savePostIt() {
    const text = document.getElementById('postit-text').value.trim();
    const font = document.getElementById('postit-font').value;
    const size = document.getElementById('postit-size').value;
    const emoji = document.getElementById('postit-emoji').value.trim() || '💬';
    const isLocked = document.getElementById('postit-locked').checked;
    const password = document.getElementById('postit-password').value;

    const selectedSwatch = document.querySelector('.color-swatch.selected');
    const color = selectedSwatch ? selectedSwatch.dataset.color : '#FFF176';
    const author = localStorage.getItem('mural_author') || 'eu';

    if (this.editingPostItId) {
      const p = this.data.postits.find(item => item.id === this.editingPostItId);
      if (p) {
        p.text = text;
        p.font = font;
        p.size = size;
        p.emoji = emoji;
        p.color = color;
      }
    } else {
      let postitObj = {
        id: PostItModule.generateId(),
        author: author,
        color: color,
        font: font,
        size: size,
        rotation: Math.floor(Math.random() * 8) - 4, // -4 a +4 graus
        emoji: emoji,
        x: 100 + Math.floor(Math.random() * 200),
        y: 100 + Math.floor(Math.random() * 200),
        status: 'quero_falar',
        sensitivity: 'leve',
        locked: false,
        createdAt: new Date().toISOString()
      };

      if (isLocked) {
        if (!password) {
          alert("Por favor, digite uma senha para proteger o post-it!");
          return;
        }
        const encrypted = await CryptoModule.encryptText(text, password);
        postitObj.locked = true;
        postitObj.encrypted = encrypted;
      } else {
        postitObj.text = text;
      }

      this.data.postits.push(postitObj);
    }

    this.closePostItModal();
    await this.persistData();
  },

  async deletePostIt(id) {
    if (confirm("Tem certeza que deseja apagar este post-it?")) {
      this.data.postits = this.data.postits.filter(p => p.id !== id);
      await this.persistData();
    }
  },

  async unlockPostIt(postit) {
    const password = prompt("Digite a senha para revelar este post-it:");
    if (!password) return;

    try {
      const decrypted = await CryptoModule.decryptText(postit.encrypted, password);
      postit.text = decrypted;
      postit.locked = false;
      delete postit.encrypted;
      await this.persistData();
      alert("Post-it revelado com sucesso!");
    } catch (err) {
      alert("Senha incorreta ou erro ao descriptografar.");
    }
  },

  openConfigModal() {
    document.getElementById('cfg-author').value = localStorage.getItem('mural_author') || 'eu';
    document.getElementById('cfg-token').value = localStorage.getItem('mural_github_token') || '';
    document.getElementById('cfg-repo').value = localStorage.getItem('mural_github_repo') || '';
    document.getElementById('modal-config').classList.remove('hidden');
  },

  closeConfigModal() {
    document.getElementById('modal-config').classList.add('hidden');
  },

  saveConfig() {
    localStorage.setItem('mural_author', document.getElementById('cfg-author').value);
    localStorage.setItem('mural_github_token', document.getElementById('cfg-token').value.trim());
    localStorage.setItem('mural_github_repo', document.getElementById('cfg-repo').value.trim());
    this.closeConfigModal();
    this.syncRemote();
  },

  async syncRemote() {
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData) {
        this.data = remoteData;
        localStorage.setItem('mural_local_data', JSON.stringify(this.data));
        this.render();
      }
    } catch (e) {
      console.warn("Erro na sincronização:", e);
    }
  },

  startPolling() {
    // Polling a cada 15 segundos conforme planejamento
    setInterval(() => this.syncRemote(), 15000);
    // Sync ao focar na aba
    window.addEventListener('focus', () => this.syncRemote());
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
