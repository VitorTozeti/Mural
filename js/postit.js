/**
 * postit.js - Criação, formatação, reações e renderização dos post-its
 */

const PostItModule = {
  statusLabels: {
    'quero_falar': '💬 Quero falar',
    'conversando': '⏳ Em pauta',
    'preciso_tempo': '⏸️ Mais tempo',
    'resolvido': '✨ Resolvido'
  },

  sensitivityLabels: {
    'leve': '🌱 Leve',
    'medio': '⚖️ Médio',
    'seria': '💬 Séria'
  },

  authorColors: {
    'eu': '#2563EB',
    'ela': '#EC4899'
  },

  createPostItElement(postit, handlers) {
    const el = document.createElement('div');
    el.className = `postit size-${postit.size || 'medium'}`;
    el.id = `postit-${postit.id}`;
    el.dataset.id = postit.id;
    
    // Posição e rotação leve
    el.style.left = `${postit.x || 100}px`;
    el.style.top = `${postit.y || 100}px`;
    el.style.transform = `rotate(${postit.rotation || 0}deg)`;
    el.style.backgroundColor = postit.color || '#FFF59D';
    el.style.fontFamily = postit.font ? `"${postit.font}", cursive` : 'Caveat, cursive';

    // Determinar cor do autor
    const authorColor = localStorage.getItem(`author_color_${postit.author}`) || 
                        (postit.author === 'ela' ? '#EC4899' : '#2563EB');

    // Header do Post-it
    const header = document.createElement('div');
    header.className = 'postit-header';
    
    const authorBadge = document.createElement('span');
    authorBadge.className = 'postit-author-badge';
    authorBadge.innerHTML = `
      <span class="author-dot" style="background:${authorColor}"></span>
      <span>${postit.author || 'eu'}</span>
    `;

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'postit-badges';

    if (postit.emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.innerText = postit.emoji;
      badgesContainer.appendChild(emojiSpan);
    }

    if (postit.sensitivity) {
      const sensBadge = document.createElement('span');
      sensBadge.className = `badge-sensitivity sensitivity-${postit.sensitivity}`;
      sensBadge.innerText = this.sensitivityLabels[postit.sensitivity] || postit.sensitivity;
      badgesContainer.appendChild(sensBadge);
    }

    header.appendChild(authorBadge);
    header.appendChild(badgesContainer);

    // Body do Post-it
    const body = document.createElement('div');
    body.className = 'postit-body';

    if (postit.locked) {
      const hintHtml = postit.hint ? `<div style="font-size:0.85rem; font-style:italic; margin-top:6px; opacity:0.85;">"${postit.hint}"</div>` : '';
      body.innerHTML = `
        <div style="text-align:center; padding: 18px 0;">
          <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));">🔒</div>
          <div style="font-weight: 600; margin-top: 6px;">Post-it guardado</div>
          ${hintHtml}
          <button class="btn btn-secondary btn-unlock" style="margin-top: 12px; font-size: 0.8rem; padding: 4px 10px;">Revelar</button>
        </div>
      `;
      const btnUnlock = body.querySelector('.btn-unlock');
      btnUnlock.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onUnlock(postit);
      });
    } else {
      body.innerText = postit.text || '';
    }

    // Reações rápidas (❤️, 👀, 😅)
    const reactionsRow = document.createElement('div');
    reactionsRow.className = 'postit-reactions-row';
    const reactionList = ['❤️', '👀', '😅'];
    const postitReactions = postit.reactions || {};

    reactionList.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'btn-react';
      const count = (postitReactions[emoji] || []).length;
      btn.innerHTML = `${emoji} <span class="react-count">${count > 0 ? count : ''}</span>`;
      
      const currentAuthor = localStorage.getItem('mural_author') || 'eu';
      if ((postitReactions[emoji] || []).includes(currentAuthor)) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onReaction(postit.id, emoji);
      });

      reactionsRow.appendChild(btn);
    });

    // Rodapé / Status e Ações Rápidas
    const footer = document.createElement('div');
    footer.className = 'postit-footer';
    
    const statusTag = document.createElement('span');
    statusTag.className = 'postit-status-tag';
    statusTag.innerText = this.statusLabels[postit.status || 'quero_falar'];

    const quickActions = document.createElement('div');
    quickActions.className = 'postit-quick-actions';

    // Botão de alternar status rápido (para resolvido ou em pauta)
    const btnQuickStatus = document.createElement('button');
    btnQuickStatus.className = 'btn-action-mini';
    btnQuickStatus.title = postit.status === 'resolvido' ? 'Reabrir post-it' : 'Marcar como resolvido';
    btnQuickStatus.innerText = postit.status === 'resolvido' ? '↩️' : '✅';
    btnQuickStatus.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onToggleResolved(postit.id);
    });

    // Botão editar
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-action-mini';
    btnEdit.title = 'Editar';
    btnEdit.innerText = '✏️';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onEdit(postit);
    });

    // Botão excluir
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-action-mini';
    btnDelete.title = 'Excluir';
    btnDelete.innerText = '🗑️';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onDelete(postit.id);
    });

    quickActions.appendChild(btnQuickStatus);
    quickActions.appendChild(btnEdit);
    quickActions.appendChild(btnDelete);

    footer.appendChild(statusTag);
    footer.appendChild(quickActions);

    el.appendChild(header);
    el.appendChild(body);
    if (!postit.locked) {
      el.appendChild(reactionsRow);
    }
    el.appendChild(footer);

    // Eventos de arrastar e duplo clique para editar
    el.addEventListener('mousedown', (e) => handlers.onDragStart(e, el, postit));
    el.addEventListener('touchstart', (e) => handlers.onDragStart(e, el, postit), { passive: false });
    el.addEventListener('dblclick', () => handlers.onEdit(postit));

    return el;
  },

  generateId() {
    return 'p_' + Math.random().toString(36).substring(2, 9);
  }
};

window.PostItModule = PostItModule;
