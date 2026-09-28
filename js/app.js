/**
 * app.js - Controlador principal: estado, criação rápida de post-its, conexões e sincronização
 */

const THEMES = [
  { id: 'claro', name: 'Branco', board: '#fafafa' },
  { id: 'creme', name: 'Creme', board: '#faf7f2' },
  { id: 'cinza', name: 'Cinza', board: '#f1f3f5' },
  { id: 'azulado', name: 'Azulado', board: '#f2f6fc' },
  { id: 'rosado', name: 'Rosado', board: '#fcf4f6' },
  { id: 'escuro', name: 'Escuro', board: '#1e1e24' }
];

const App = {
  data: { version: 1, updatedAt: new Date().toISOString(), postits: [], links: [] },
  currentFilter: 'all',
  composer: { editingId: null, x: 0, y: 0, color: '#FFF59D', size: 'medium' },

  get currentAuthor() {
    const saved = localStorage.getItem('mural_author');
    return saved === 'eu' ? 'eu' : 'kemily';
  },

  normalize(data) {
    if (!data) return data;
    data.postits = data.postits || [];
    data.links = data.links || [];
    return data;
  },

  async init() {
    this.initTheme();
    this.buildComposerColors();
    this.bindEvents();
    BoardModule.init(document.getElementById('board'), {
      onMove: (id, x, y) => this.updatePostItPosition(id, x, y),
      onLink: (from, to) => this.addLink(from, to),
      onUnlink: (id) => this.removeLink(id),
      onBoardDoubleClick: (x, y) => this.openComposer({ x, y })
    });
    await this.loadInitialData();
    this.startPolling();
  },

  // ---------- Tema / paletas do mural ----------

  initTheme() {
    const menu = document.getElementById('theme-menu');
    const options = document.getElementById('theme-options');
    THEMES.forEach(t => {
      const item = document.createElement('button');
      item.className = 'theme-option';
      item.dataset.theme = t.id;
      const sw = document.createElement('span');
      sw.className = 'theme-swatch';
      sw.style.background = t.board;
      const label = document.createElement('span');
      label.textContent = t.name;
      item.append(sw, label);
      item.addEventListener('click', () => {
        this.applyTheme(t.id);
        menu.classList.add('hidden');
      });
      options.appendChild(item);
    });

    const custom = this.getCustomTheme();
    const inputs = {
      board: document.getElementById('custom-board-color'),
      dot: document.getElementById('custom-dot-color'),
      link: document.getElementById('custom-link-color'),
      noDots: document.getElementById('custom-no-dots')
    };
    inputs.board.value = custom.board;
    inputs.dot.value = custom.dot;
    inputs.link.value = custom.link;
    inputs.noDots.checked = custom.noDots;
    const onCustomChange = () => {
      localStorage.setItem('mural_custom_theme', JSON.stringify({
        board: inputs.board.value,
        dot: inputs.dot.value,
        link: inputs.link.value,
        noDots: inputs.noDots.checked
      }));
      this.applyTheme('custom');
    };
    ['board', 'dot', 'link'].forEach(k => inputs[k].addEventListener('input', onCustomChange));
    inputs.noDots.addEventListener('change', onCustomChange);

    const saved = localStorage.getItem('mural_theme');
    this.applyTheme(saved === 'custom' || THEMES.some(t => t.id === saved) ? saved : 'claro');
  },

  getCustomTheme() {
    const defaults = { board: '#ffffff', dot: '#e3e3e3', link: '#94a3b8', noDots: false };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('mural_custom_theme') || '{}') };
    } catch {
      return defaults;
    }
  },

  applyTheme(id) {
    const style = document.body.style;
    if (id === 'custom') {
      const c = this.getCustomTheme();
      style.setProperty('--bg-board-color', c.board);
      style.setProperty('--bg-dot-color', c.noDots ? 'transparent' : c.dot);
      style.setProperty('--link-color', c.link);
    } else {
      ['--bg-board-color', '--bg-dot-color', '--link-color'].forEach(v => style.removeProperty(v));
    }
    document.body.setAttribute('data-theme', id);
    localStorage.setItem('mural_theme', id);
    document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('active', o.dataset.theme === id));
  },

  // ---------- Eventos ----------

  bindEvents() {
    const themeMenu = document.getElementById('theme-menu');
    document.getElementById('btn-theme').addEventListener('click', (e) => {
      e.stopPropagation();
      themeMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.theme-picker')) themeMenu.classList.add('hidden');
    });

    document.getElementById('btn-config').addEventListener('click', () => this.openConfigModal());
    document.getElementById('btn-close-config').addEventListener('click', () => this.closeConfigModal());
    document.getElementById('btn-close-config-modal').addEventListener('click', () => this.closeConfigModal());
    document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());
    document.getElementById('btn-sync').addEventListener('click', () => this.manualSync());

    document.getElementById('btn-add-postit').addEventListener('click', () => this.openComposerInView());
    document.getElementById('composer-save').addEventListener('click', () => this.saveComposer());
    document.getElementById('composer-cancel').addEventListener('click', () => this.closeComposer());

    const textEl = document.getElementById('composer-text');
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveComposer();
      }
    });

    document.querySelectorAll('#composer-size button').forEach(btn => {
      btn.addEventListener('click', () => this.setComposerSize(btn.dataset.size));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeComposer();
        this.closeConfigModal();
        themeMenu.classList.add('hidden');
        return;
      }
      const typing = e.target.closest('input, textarea, select');
      if (!typing && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.openComposerInView();
      }
    });

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        this.render();
      });
    });

    document.querySelectorAll('#author-color-palette .color-swatch-author').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('#author-color-palette .color-swatch-author').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
      });
    });
  },

  // ---------- Compositor (criar / editar no próprio mural) ----------

  getCustomColors() {
    try {
      return JSON.parse(localStorage.getItem('mural_custom_colors') || '[]');
    } catch {
      return [];
    }
  },

  saveCustomColors(colors) {
    localStorage.setItem('mural_custom_colors', JSON.stringify(colors));
  },

  buildComposerColors() {
    const wrap = document.getElementById('composer-colors');
    wrap.replaceChildren();
    const presets = PostItModule.palette.map(p => ({ ...p, custom: false }));
    const customs = this.getCustomColors().map(color => ({ color, name: 'Sua cor', custom: true }));

    [...presets, ...customs].forEach(({ color, name, custom }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-swatch' + (custom ? ' is-custom' : '');
      b.dataset.color = color;
      b.title = custom ? `${color} — clique direito para remover` : name;
      b.style.background = color;
      b.addEventListener('click', () => this.setComposerColor(color));
      if (custom) {
        b.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.saveCustomColors(this.getCustomColors().filter(c => c !== color));
          this.buildComposerColors();
          this.setComposerColor(this.composer.color);
        });
      }
      wrap.appendChild(b);
    });

    if (!this.customColorBound) {
      this.customColorBound = true;
      const picker = document.getElementById('composer-custom-color');
      picker.addEventListener('input', () => this.setComposerColor(picker.value));
      picker.addEventListener('change', () => {
        const color = picker.value.toUpperCase();
        const isPreset = PostItModule.palette.some(p => p.color.toUpperCase() === color);
        const list = this.getCustomColors().filter(c => c !== color);
        if (!isPreset) {
          list.push(color);
          this.saveCustomColors(list.slice(-12));
          this.buildComposerColors();
        }
        this.setComposerColor(color);
      });
    }
  },

  setComposerColor(color) {
    this.composer.color = color;
    const composer = document.getElementById('composer');
    composer.style.backgroundColor = color;
    composer.classList.toggle('is-dark', PostItModule.isDark(color));
    document.getElementById('composer-custom-color').value = color.length === 7 ? color.toLowerCase() : '#fff59d';
    document.querySelectorAll('#composer-colors .color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color.toUpperCase() === color.toUpperCase());
    });
  },

  setComposerSize(size) {
    this.composer.size = size;
    document.querySelectorAll('#composer-size button').forEach(b => {
      b.classList.toggle('active', b.dataset.size === size);
    });
  },

  openComposerInView() {
    const c = document.getElementById('board-container');
    this.openComposer({
      x: c.scrollLeft + Math.max(20, c.clientWidth / 2 - 150),
      y: c.scrollTop + Math.max(20, c.clientHeight / 2 - 150)
    });
  },

  openComposer({ x, y, postit = null }) {
    const composer = document.getElementById('composer');
    const secretEl = document.getElementById('composer-secret');
    this.composer.editingId = postit ? postit.id : null;
    this.composer.x = Math.max(0, x);
    this.composer.y = Math.max(0, y);

    const lastColor = localStorage.getItem('mural_last_color') || '#FFF59D';
    document.getElementById('composer-text').value = postit ? (postit.text || '') : '';
    document.getElementById('composer-status').value = postit ? (postit.status || 'quero_falar') : 'quero_falar';
    secretEl.checked = postit ? !!postit.secret : false;
    secretEl.disabled = !!postit && postit.author !== this.currentAuthor;
    this.setComposerColor(postit ? (postit.color || lastColor) : lastColor);
    this.setComposerSize(postit ? (postit.size || 'medium') : 'medium');

    composer.style.left = `${this.composer.x}px`;
    composer.style.top = `${this.composer.y}px`;
    composer.classList.remove('hidden');
    document.getElementById('empty-hint').classList.add('hidden');
    document.getElementById('composer-text').focus();
  },

  closeComposer() {
    const composer = document.getElementById('composer');
    if (composer.classList.contains('hidden')) return;
    composer.classList.add('hidden');
    this.composer.editingId = null;
    this.updateEmptyHint();
  },

  async saveComposer() {
    const text = document.getElementById('composer-text').value.trim();
    if (!text) {
      document.getElementById('composer-text').focus();
      this.showToast('Escreva algo no post-it antes de salvar', 'error');
      return;
    }
    const status = document.getElementById('composer-status').value;
    const secret = document.getElementById('composer-secret').checked;
    const { color, size, editingId, x, y } = this.composer;
    localStorage.setItem('mural_last_color', color);

    if (editingId) {
      const p = this.data.postits.find(item => item.id === editingId);
      if (p) {
        Object.assign(p, { text, color, size, status });
        if (p.author === this.currentAuthor) p.secret = secret;
        if (status === 'resolvido' && !p.resolvedAt) p.resolvedAt = new Date().toISOString();
      }
    } else {
      this.data.postits.push({
        id: PostItModule.generateId(),
        author: this.currentAuthor,
        text,
        color,
        size,
        status,
        secret,
        rotation: Math.floor(Math.random() * 5) - 2,
        x,
        y,
        createdAt: new Date().toISOString(),
        reactions: {}
      });
    }

    this.closeComposer();
    await this.persistData();
  },

  // ---------- Render ----------

  visiblePostits() {
    return this.data.postits.filter(p => {
      if (p.secret && p.author !== this.currentAuthor) return false;
      if (this.currentFilter === 'all') return true;
      return (p.status || 'quero_falar') === this.currentFilter;
    });
  },

  render() {
    BoardModule.renderBoard(this.visiblePostits(), this.data.links, {
      onEdit: (p) => this.openComposer({ x: p.x, y: p.y, postit: p }),
      onDelete: (id) => this.deletePostIt(id),
      onReaction: (id, emoji) => this.toggleReaction(id, emoji),
      onToggleResolved: (id) => this.toggleResolved(id)
    }, this.currentAuthor);
    this.updateEmptyHint();
  },

  updateEmptyHint() {
    const composerOpen = !document.getElementById('composer').classList.contains('hidden');
    const empty = this.visiblePostits().length === 0;
    document.getElementById('empty-hint').classList.toggle('hidden', !empty || composerOpen);
  },

  // ---------- Ações nos post-its ----------

  updatePostItPosition(id, x, y) {
    const p = this.data.postits.find(item => item.id === id);
    if (!p) return;
    p.x = x;
    p.y = y;
    this.persistData();
  },

  toggleReaction(id, emoji) {
    const p = this.data.postits.find(item => item.id === id);
    if (!p) return;
    p.reactions = p.reactions || {};
    const list = p.reactions[emoji] = p.reactions[emoji] || [];
    const i = list.indexOf(this.currentAuthor);
    if (i > -1) list.splice(i, 1); else list.push(this.currentAuthor);
    this.persistData();
  },

  toggleResolved(id) {
    const p = this.data.postits.find(item => item.id === id);
    if (!p) return;
    if (p.status === 'resolvido') {
      p.status = 'quero_falar';
    } else {
      p.status = 'resolvido';
      p.resolvedAt = new Date().toISOString();
      this.showToast('Assunto resolvido! 🎉', 'success');
    }
    this.persistData();
  },

  async deletePostIt(id) {
    if (!confirm('Apagar este post-it?')) return;
    this.data.postits = this.data.postits.filter(p => p.id !== id);
    this.data.links = this.data.links.filter(l => l.from !== id && l.to !== id);
    await this.persistData();
  },

  addLink(from, to) {
    const exists = this.data.links.some(l => (l.from === from && l.to === to) || (l.from === to && l.to === from));
    if (exists) return;
    this.data.links.push({ id: PostItModule.generateId('l'), from, to });
    this.persistData();
  },

  removeLink(id) {
    if (!confirm('Remover esta conexão?')) return;
    this.data.links = this.data.links.filter(l => l.id !== id);
    this.persistData();
  },

  // ---------- Persistência / sync ----------

  setSyncState(state, text) {
    const pill = document.getElementById('sync-status-indicator');
    pill.className = `sync-pill ${state}`;
    pill.querySelector('.sync-text').innerText = text;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  async loadInitialData() {
    this.setSyncState('syncing', 'Buscando...');
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData && remoteData.postits) {
        this.data = this.normalize(remoteData);
        localStorage.setItem('mural_local_data', JSON.stringify(this.data));
        this.setSyncState('online', 'Sincronizado');
        this.render();
        return;
      }
    } catch (err) {
      console.warn('GitHub offline ou não configurado:', err);
    }

    const localSaved = localStorage.getItem('mural_local_data');
    if (localSaved) {
      try {
        this.data = this.normalize(JSON.parse(localSaved));
      } catch (e) {
        console.error('Erro local data:', e);
      }
    }
    this.setSyncState('offline', 'Modo local');
    this.render();
  },

  async persistData() {
    this.data.updatedAt = new Date().toISOString();
    localStorage.setItem('mural_local_data', JSON.stringify(this.data));
    this.render();

    try {
      this.setSyncState('syncing', 'Salvando...');
      await GitHubSync.saveData(this.data);
      this.setSyncState('online', 'Salvo');
    } catch (err) {
      if (err.message === 'CONFLICT_409') {
        this.showToast('Edição simultânea detectada, sincronizando...', 'error');
        await this.manualSync();
      } else {
        this.setSyncState('offline', 'Salvo localmente');
      }
    }
  },

  openConfigModal() {
    const author = this.currentAuthor;
    document.getElementById('cfg-author').value = author;
    document.getElementById('cfg-token').value = localStorage.getItem('mural_github_token') || '';
    document.getElementById('cfg-repo').value = localStorage.getItem('mural_github_repo') || '';
    const savedAuthorColor = PostItModule.authorColor(author);
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
    const selectedColor = document.querySelector('#author-color-palette .color-swatch-author.selected');
    if (selectedColor) localStorage.setItem(`author_color_${author}`, selectedColor.dataset.authorColor);
    localStorage.setItem('mural_author', author);
    localStorage.setItem('mural_github_token', document.getElementById('cfg-token').value.trim());
    localStorage.setItem('mural_github_repo', document.getElementById('cfg-repo').value.trim());
    this.closeConfigModal();
    this.showToast('Configurações salvas!', 'success');
    this.render();
    this.manualSync();
  },

  async manualSync() {
    this.setSyncState('syncing', 'Sincronizando...');
    try {
      const remoteData = await GitHubSync.loadData();
      if (remoteData) {
        this.data = this.normalize(remoteData);
        localStorage.setItem('mural_local_data', JSON.stringify(this.data));
        this.render();
        this.setSyncState('online', 'Sincronizado');
      } else {
        this.setSyncState('offline', 'Modo local');
      }
    } catch (e) {
      console.warn('Erro no sync:', e);
      this.setSyncState('offline', 'Offline');
    }
  },

  isBusy() {
    return BoardModule.drag || BoardModule.linkDrag ||
      !document.getElementById('composer').classList.contains('hidden');
  },

  startPolling() {
    setInterval(() => {
      if (this.isBusy()) return;
      GitHubSync.loadData().then(remoteData => {
        const incoming = this.normalize(remoteData);
        if (incoming && JSON.stringify(incoming) !== JSON.stringify(this.data)) {
          this.data = incoming;
          localStorage.setItem('mural_local_data', JSON.stringify(this.data));
          this.render();
          this.showToast('Mural atualizado', 'info');
        }
      }).catch(() => {});
    }, 15000);

    window.addEventListener('focus', () => {
      if (!this.isBusy()) this.manualSync();
    });
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
