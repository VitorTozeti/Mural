/**
 * postit.js - Criação, formatação e renderização dos post-its
 */

const PostItModule = {
  createPostItElement(postit, onDragStart, onEdit, onDelete, onUnlock) {
    const el = document.createElement('div');
    el.className = 'postit';
    el.id = `postit-${postit.id}`;
    el.dataset.id = postit.id;
    
    // Posição e rotação
    el.style.left = `${postit.x || 100}px`;
    el.style.top = `${postit.y || 100}px`;
    el.style.transform = `rotate(${postit.rotation || 0}deg)`;
    el.style.backgroundColor = postit.color || '#FFF176';
    el.style.fontFamily = postit.font ? `"${postit.font}", sans-serif` : 'Caveat, cursive';

    // Header
    const header = document.createElement('div');
    header.className = 'postit-header';
    header.innerHTML = `
      <span>${postit.emoji || '📌'}</span>
      <span class="postit-author-badge">${postit.author || ''}</span>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'postit-body';

    if (postit.locked) {
      body.innerHTML = `
        <div style="text-align:center; padding: 20px 0;">
          <div style="font-size: 2rem;">🔒</div>
          <div style="font-size: 0.9rem; margin-top: 5px;">Post-it guardado</div>
          <button class="btn btn-secondary btn-unlock" style="margin-top: 10px; font-size: 0.8rem;">Desbloquear</button>
        </div>
      `;
      const btnUnlock = body.querySelector('.btn-unlock');
      btnUnlock.addEventListener('click', (e) => {
        e.stopPropagation();
        onUnlock(postit);
      });
    } else {
      body.innerText = postit.text || '';
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'postit-footer';
    const dateFormatted = postit.createdAt ? new Date(postit.createdAt).toLocaleDateString('pt-BR') : '';
    footer.innerHTML = `
      <span>${dateFormatted}</span>
      <button class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:0.9rem;" title="Excluir">🗑️</button>
    `;

    footer.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(postit.id);
    });

    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(footer);

    // Eventos
    el.addEventListener('mousedown', (e) => onDragStart(e, el, postit));
    el.addEventListener('dblclick', () => onEdit(postit));

    return el;
  },

  generateId() {
    return 'p_' + Math.random().toString(36).substring(2, 8);
  }
};

window.PostItModule = PostItModule;
