/**
 * app.js - Controlador principal da aplicação, ciclo de sincronização e interações
 */

const App = {
  data: {
    version: 1,
    updatedAt: new Date().toISOString(),
    postits: []
  },
  currentFilter: 'all',
  editingPostItId: null,
  pendingUnlockPostIt: null,

  async init() {
    this.initTheme();
    this.bindEvents();
    BoardModule.init(document.getElementById('board'), (id, x, y) => this.updatePostItPosition(id, x, y));
    await this.loadInitialData();
    this.startPolling();
  },

  initTheme() {
    const savedTheme = localStorage.getItem('mural_theme') || 'claro';
    document.body.setAttribute('data-theme', savedTheme);
  },

  toggleTheme() {
    const themes = ['claro', 'creme', 'escuro'];
    const current = document.body.getAttribute('data-theme') || 'claro';
    const nextIndex = (themes.indexOf(current) + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('mural_theme', nextTheme);
    this.showToast(`Tema alterado para: ${nextTheme}`, 'info');
  },

  bindEvents() {
    // Tema
    document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());

    // Configurações
    document.getElementById('btn-config').addEventListener('click', () => this.openConfigModal());
    document.getElementById('btn-close-config').addEventListener('click', () => this.closeConfigModal());
    document.getElementById('btn-close-config-modal').addEventListener('click', () => this.closeConfigModal());
    document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());

    // Histórico
    document.getElementById('btn-history').addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btn-close-history').addEventListener('click', () => this.closeHistoryModal());
    document.getElementById('btn-close-history-modal').addEventListener('click', () => this.closeHistoryModal());

    // Sincronização manual
    document.getElementById('btn-sync').addEventListener('click', () => this.manualSync());

    // Novo Post-it
    document.getElementById('btn-add-postit').addEventListener('click', () => this.openPostItModal());
    document.getElementById('btn-cancel-postit').addEventListener('click', () => this.closePostItModal());
    document.getElementById('btn-close-postit-modal').addEventListener('click', () => this.closePostItModal());
    document.getElementById('btn-save-postit').addEventListener('click', () => this.savePostIt());

    // Desbloqueio de Guardado
    document.getElementById('btn-close-unlock-modal').addEventListener('click', () => this.closeUnlockModal());
    document.getElementById('btn-cancel-unlock').addEventListener('click', () => this.closeUnlockModal());
    document.getElementById('btn-confirm-unlock').addEventListener('click', () => this.confirmUnlock());

    // Filtros de Status
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.render();
      });
    });

    // Checkbox de Post-it Guardado
    document.getElementById('postit-locked').addEventListener('change', (e) => {
      const lockedGroup = document.getElementById('group-locked-options');
      if (e.target.checked) {
        lockedGroup.classList.remove('hidden');
      } else {
        lockedGroup.classList.add('hidden');
      }
    });

    // Paleta de cores do Post-it
    document.querySelectorAll('#color-palette .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        document.querySelectorAll('#color-palette .color-swatch').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
      });
    });

    // Paleta de cor da etiqueta do autor
    document.querySelectorAll('#author-color-palette .color-swatch-author').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        document.querySelectorAll('#author-color-palette .color-swatch-author').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
      });
    });
  },

  setSyncState(state, text) {
    const pill = document.getElementById('sync-status-indicator');
    const textEl = pill.querySelector('.sync-text');
    pill.className = `sync-pill ${state}`;
    textEl.innerText = text;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  },

  async loadInitialData() {
    this.setSyncState('syncing', 'Buscando...');
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData && remoteData.postits) {
        this.data = remoteData;
        localStorage.setItem('mural_local_data', JSON.stringify(this.data));
        this.setSyncState('online', 'Sincronizado');
        this.render();
        return;
      }
    } catch (err) {
      console.warn("GitHub offline ou não configurado:", err);
    }

    const localSaved = localStorage.getItem('mural_local_data');
    if (localSaved) {
      try {
        this.data = JSON.parse(localSaved);
      } catch (e) {
        console.error("Erro local data:", e);
      }
    }
    this.setSyncState('offline', 'Modo Local');
    this.render();
  },

  render() {
    BoardModule.renderBoard(this.data.postits, this.currentFilter, {
      onEdit: (p) => this.openPostItModal(p),
      onDelete: (id) => this.deletePostIt(id),
      onUnlock: (p) => this.openUnlockModal(p),
      onReaction: (id, emoji) => this.toggleReaction(id, emoji),
      onToggleResolved: (id) => this.toggleResolved(id)
    });
  },

  async persistData() {
    this.data.updatedAt = new Date().toISOString();
    localStorage.setItem('mural_local_data', JSON.stringify(this.data));
    this.render();

    try {
      this.setSyncState('syncing', 'Salvando...');
      await GitHubSync.saveData(this.data);
      this.setSyncState('online', 'Salvo no GitHub');
    } catch (err) {
      if (err.message === "CONFLICT_409") {
        this.showToast("Conflito de edição simultânea detectado! Sincronizando...", "error");
        await this.manualSync();
      } else {
        this.setSyncState('offline', 'Salvo localmente');
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

  toggleReaction(id, emoji) {
    const p = this.data.postits.find(item => item.id === id);
    if (!p) return;

    if (!p.reactions) p.reactions = {};
    if (!p.reactions[emoji]) p.reactions[emoji] = [];

    const currentAuthor = localStorage.getItem('mural_author') || 'eu';
    const index = p.reactions[emoji].indexOf(currentAuthor);

    if (index > -1) {
      p.reactions[emoji].splice(index, 1);
    } else {
      p.reactions[emoji].push(currentAuthor);
    }

    this.persistData();
  },

  toggleResolved(id) {
    const p = this.data.postits.find(item => item.id === id);
    if (!p) return;

    if (p.status === 'resolvido') {
      p.status = 'quero_falar';
      this.showToast("Post-it reaberto no mural!", "info");
    } else {
      p.status = 'resolvido';
      p.resolvedAt = new Date().toISOString();
      this.showToast("Assunto marcado como resolvido! 🎉", "success");
    }
    this.persistData();
  },

  openPostItModal(postit = null) {
    this.editingPostItId = postit ? postit.id : null;
    const modal = document.getElementById('modal-postit');
    const titleEl = document.getElementById('modal-postit-title');
    const textEl = document.getElementById('postit-text');
    const fontEl = document.getElementById('postit-font');
    const sizeEl = document.getElementById('postit-size');
    const emojiEl = document.getElementById('postit-emoji');
    const statusEl = document.getElementById('postit-status');
    const sensEl = document.getElementById('postit-sensitivity');
    const lockedEl = document.getElementById('postit-locked');
    const lockedGroup = document.getElementById('group-locked-options');
    const hintEl = document.getElementById('postit-hint');
    const pwdEl = document.getElementById('postit-password');

    if (postit) {
      titleEl.innerText = "Editar Post-it";
      textEl.value = postit.text || '';
      fontEl.value = postit.font || 'Caveat';
      sizeEl.value = postit.size || 'medium';
      emojiEl.value = postit.emoji || '';
      statusEl.value = postit.status || 'quero_falar';
      sensEl.value = postit.sensitivity || 'leve';
      lockedEl.checked = !!postit.locked;
      lockedEl.disabled = true;
      hintEl.value = postit.hint || '';
      pwdEl.value = '';
      lockedGroup.classList.add('hidden');

      // Seleciona a cor salva
      document.querySelectorAll('#color-palette .color-swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.color === postit.color);
      });
    } else {
      titleEl.innerText = "Criar Post-it";
      textEl.value = '';
      fontEl.value = 'Caveat';
      sizeEl.value = 'medium';
      emojiEl.value = '💬';
      statusEl.value = 'quero_falar';
      sensEl.value = 'leve';
      lockedEl.checked = false;
      lockedEl.disabled = false;
      hintEl.value = '';
      pwdEl.value = '';
      lockedGroup.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    textEl.focus();
  },

  closePostItModal() {
    document.getElementById('modal-postit').classList.add('hidden');
    this.editingPostItId = null;
  },

  async savePostIt() {
    const text = document.getElementById('postit-text').value.trim();
    const font = document.getElementById('postit-font').value;
    const size = document.getElementById('postit-size').value;
    const emoji = document.getElementById('postit-emoji').value.trim();
    const status = document.getElementById('postit-status').value;
    const sensitivity = document.getElementById('postit-sensitivity').value;
    const isLocked = document.getElementById('postit-locked').checked;
    const hint = document.getElementById('postit-hint').value.trim();
    const password = document.getElementById('postit-password').value;

    const selectedSwatch = document.querySelector('#color-palette .color-swatch.selected');
    const color = selectedSwatch ? selectedSwatch.dataset.color : '#FFF59D';
    const author = localStorage.getItem('mural_author') || 'eu';

    if (!isLocked && !text) {
      alert("Por favor, digite o conteúdo do post-it.");
      return;
    }

    if (this.editingPostItId) {
      const p = this.data.postits.find(item => item.id === this.editingPostItId);
      if (p) {
        p.text = text;
        p.font = font;
        p.size = size;
        p.emoji = emoji;
        p.color = color;
        p.status = status;
        p.sensitivity = sensitivity;
      }
    } else {
      let postitObj = {
        id: PostItModule.generateId(),
        author: author,
        color: color,
        font: font,
        size: size,
        rotation: Math.floor(Math.random() * 8) - 4,
        emoji: emoji,
        x: 80 + Math.floor(Math.random() * 260),
        y: 80 + Math.floor(Math.random() * 260),
        status: status,
        sensitivity: sensitivity,
        locked: false,
        createdAt: new Date().toISOString(),
        reactions: {}
      };

      if (isLocked) {
        if (!password) {
          alert("Por favor, defina uma senha para criptografar este post-it guardado.");
          return;
        }
        const encrypted = await CryptoModule.encryptText(text || '(guardado)', password);
        postitObj.locked = true;
        postitObj.encrypted = encrypted;
        if (hint) postitObj.hint = hint;
      } else {
        postitObj.text = text;
      }

      this.data.postits.push(postitObj);
    }

    this.closePostItModal();
    await this.persistData();
    this.showToast("Post-it salvo no mural!", "success");
  },

  async deletePostIt(id) {
    if (confirm("Tem certeza que deseja apagar este post-it?")) {
      this.data.postits = this.data.postits.filter(p => p.id !== id);
      await this.persistData();
      this.showToast("Post-it removido", "info");
    }
  },

  openUnlockModal(postit) {
    this.pendingUnlockPostIt = postit;
    const modal = document.getElementById('modal-unlock');
    const hintText = document.getElementById('unlock-hint-text');
    if (postit.hint) {
      hintText.style.display = 'block';
      hintText.innerText = `Dica de quem guardou: "${postit.hint}"`;
    } else {
      hintText.style.display = 'none';
    }
    document.getElementById('unlock-password').value = '';
    modal.classList.remove('hidden');
    document.getElementById('unlock-password').focus();
  },

  closeUnlockModal() {
    document.getElementById('modal-unlock').classList.add('hidden');
    this.pendingUnlockPostIt = null;
  },

  async confirmUnlock() {
    if (!this.pendingUnlockPostIt) return;
    const password = document.getElementById('unlock-password').value;
    if (!password) {
      alert("Digite a senha para desbloquear.");
      return;
    }

    try {
      const decrypted = await CryptoModule.decryptText(this.pendingUnlockPostIt.encrypted, password);
      this.pendingUnlockPostIt.text = decrypted;
      this.pendingUnlockPostIt.locked = false;
      delete this.pendingUnlockPostIt.encrypted;
      delete this.pendingUnlockPostIt.hint;
      
      this.closeUnlockModal();
      await this.persistData();
      this.showToast("Post-it revelado com sucesso! ✨", "success");
    } catch (err) {
      alert("Senha incorreta. Não foi possível descriptografar.");
    }
  },

  openHistoryModal() {
    const modal = document.getElementById('modal-history');
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    const resolved = this.data.postits.filter(p => p.status === 'resolvido');
    if (resolved.length === 0) {
      list.innerHTML = '<p class="description-text" style="text-align:center; padding: 20px;">Nenhuma conversa resolvida ainda. Quando terminarem uma pauta, marquem com ✅!</p>';
    } else {
      resolved.forEach(p => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const dateStr = p.resolvedAt ? new Date(p.resolvedAt).toLocaleDateString('pt-BR') : '';
        item.innerHTML = `
          <div class="history-item-content">
            <strong>${p.emoji || '📌'} ${p.text || '(guardado)'}</strong>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 4px;">
              Criado por <strong>${p.author}</strong> ${dateStr ? `• Concluído em ${dateStr}` : ''}
            </div>
          </div>
          <button class="btn btn-secondary btn-reopen" style="font-size:0.8rem;">↩️ Reabrir</button>
        `;
        item.querySelector('.btn-reopen').addEventListener('click', () => {
          this.toggleResolved(p.id);
          this.openHistoryModal(); // Atualiza a lista
        });
        list.appendChild(item);
      });
    }

    modal.classList.remove('hidden');
  },

  closeHistoryModal() {
    document.getElementById('modal-history').classList.add('hidden');
  },

  openConfigModal() {
    const author = localStorage.getItem('mural_author') || 'eu';
    document.getElementById('cfg-author').value = author;
    document.getElementById('cfg-token').value = localStorage.getItem('mural_github_token') || '';
    document.getElementById('cfg-repo').value = localStorage.getItem('mural_github_repo') || '';

    const savedAuthorColor = localStorage.getItem(`author_color_${author}`) || '#2563EB';
    document.querySelectorAll('#author-color-palette .color-swatch-author').forEach(s => {
      s.classList.toggle('selected', s.dataset.authorColor === savedAuthorColor);
    });

    document.getElementById('modal-config').classList.remove('hidden');
  },

  closeConfigModal() {
    document.getElementById('modal-config').classList.add('hidden');
  },

  saveConfig() {
    const author = document.getElementById('cfg-author').value;
    const token = document.getElementById('cfg-token').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();

    const selectedColor = document.querySelector('#author-color-palette .color-swatch-author.selected');
    if (selectedColor) {
      localStorage.setItem(`author_color_${author}`, selectedColor.dataset.authorColor);
    }

    localStorage.setItem('mural_author', author);
    localStorage.setItem('mural_github_token', token);
    localStorage.setItem('mural_github_repo', repo);

    this.closeConfigModal();
    this.showToast("Configurações salvas!", "success");
    this.manualSync();
  },

  async manualSync() {
    this.setSyncState('syncing', 'Sincronizando...');
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData) {
        this.data = remoteData;
        localStorage.setItem('mural_local_data', JSON.stringify(this.data));
        this.render();
        this.setSyncState('online', 'Sincronizado');
        this.showToast("Mural sincronizado com o GitHub!", "success");
      } else {
        this.setSyncState('offline', 'Modo Local');
      }
    } catch (e) {
      console.warn("Erro no sync:", e);
      this.setSyncState('offline', 'Offline');
      this.showToast("Não foi possível conectar ao GitHub", "error");
    }
  },

  startPolling() {
    // Polling a cada 15s conforme planejado
    setInterval(() => {
      GitHubSync.loadData().then(remoteData => {
        if (remoteData && JSON.stringify(remoteData) !== JSON.stringify(this.data)) {
          this.data = remoteData;
          localStorage.setItem('mural_local_data', JSON.stringify(this.data));
          this.render();
          this.showToast("Mural atualizado com novidades!", "info");
        }
      }).catch(() => {});
    }, 15000);

    // Sync ao focar na janela
    window.addEventListener('focus', () => {
      this.manualSync();
    });
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
