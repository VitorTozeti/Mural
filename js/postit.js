/**
 * postit.js - Renderização dos post-its
 */

const PostItModule = {
  palette: [
    { color: '#FFF59D', name: 'Amarelo' },
    { color: '#FFCC80', name: 'Laranja' },
    { color: '#FFCCBC', name: 'Pêssego' },
    { color: '#F8BBD0', name: 'Rosa' },
    { color: '#E1BEE7', name: 'Lilás' },
    { color: '#D1C4E9', name: 'Lavanda' },
    { color: '#BBDEFB', name: 'Azul' },
    { color: '#B3E5FC', name: 'Céu' },
    { color: '#B2EBF2', name: 'Água' },
    { color: '#C8E6C9', name: 'Menta' },
    { color: '#E6EE9C', name: 'Lima' },
    { color: '#ECEFF1', name: 'Cinza' }
  ],

  statusLabels: {
    'quero_falar': '💬 Quero falar',
    'conversando': '⏳ Em pauta',
    'preciso_tempo': '⏸️ Mais tempo',
    'resolvido': '✅ Resolvido'
  },

  authorNames: { 'eu': 'Vitor', 'kemily': 'Kemily', 'ela': 'Kemily' },

  authorColor(author) {
    return localStorage.getItem(`author_color_${author}`) || (author === 'eu' ? '#2563EB' : '#EC4899');
  },

  isDark(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  },

  createPostItElement(postit, handlers, currentAuthor) {
    const el = document.createElement('div');
    el.className = `postit size-${postit.size || 'medium'}`;
    if (this.isDark(postit.color)) el.classList.add('is-dark');
    if (postit.status === 'resolvido') el.classList.add('is-resolved');
    if (postit.secret) el.classList.add('is-secret');
    el.id = `postit-${postit.id}`;
    el.dataset.id = postit.id;
    el.style.left = `${postit.x || 100}px`;
    el.style.top = `${postit.y || 100}px`;
    el.style.transform = `rotate(${postit.rotation || 0}deg)`;
    el.style.backgroundColor = postit.color || '#FFF59D';

    const header = document.createElement('div');
    header.className = 'postit-header';

    const author = document.createElement('span');
    author.className = 'postit-author';
    const dot = document.createElement('span');
    dot.className = 'author-dot';
    dot.style.background = this.authorColor(postit.author);
    const name = document.createElement('span');
    name.textContent = this.authorNames[postit.author] || postit.author || '';
    author.append(dot, name);
    header.appendChild(author);

    if (postit.secret) {
      const tag = document.createElement('span');
      tag.className = 'postit-secret-tag';
      tag.textContent = '🔒 só você vê';
      header.appendChild(tag);
    }

    const body = document.createElement('div');
    body.className = 'postit-body';
    body.textContent = postit.text || '';

    const footer = document.createElement('div');
    footer.className = 'postit-footer';

    const status = document.createElement('span');
    status.className = 'postit-status';
    status.textContent = this.statusLabels[postit.status || 'quero_falar'];

    const reactions = document.createElement('div');
    reactions.className = 'postit-reactions';
    const postitReactions = postit.reactions || {};
    ['❤️', '👀', '😅'].forEach(emoji => {
      const who = postitReactions[emoji] || [];
      const btn = document.createElement('button');
      btn.className = 'btn-react';
      if (who.includes(currentAuthor)) btn.classList.add('active');
      if (who.length === 0) btn.classList.add('empty');
      btn.textContent = who.length ? `${emoji} ${who.length}` : emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onReaction(postit.id, emoji);
      });
      reactions.appendChild(btn);
    });

    footer.append(status, reactions);

    const actions = document.createElement('div');
    actions.className = 'postit-actions';
    const mkAction = (icon, title, fn) => {
      const b = document.createElement('button');
      b.className = 'btn-action-mini';
      b.title = title;
      b.textContent = icon;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    actions.append(
      mkAction(postit.status === 'resolvido' ? '↩️' : '✅',
        postit.status === 'resolvido' ? 'Reabrir' : 'Marcar como resolvido',
        () => handlers.onToggleResolved(postit.id)),
      mkAction('✏️', 'Editar', () => handlers.onEdit(postit)),
      mkAction('🗑️', 'Excluir', () => handlers.onDelete(postit.id))
    );

    const handle = document.createElement('div');
    handle.className = 'link-handle';
    handle.title = 'Arraste até outro post-it para conectar';
    handle.textContent = '+';
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handlers.onLinkStart(e, postit.id);
    });

    el.append(actions, header, body, footer, handle);

    el.addEventListener('pointerdown', (e) => handlers.onDragStart(e, el, postit));
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); handlers.onEdit(postit); });

    return el;
  },

  generateId(prefix = 'p') {
    return `${prefix}_` + Math.random().toString(36).substring(2, 9);
  }
};

window.PostItModule = PostItModule;
