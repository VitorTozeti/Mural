/**
 * board.js - Gerenciamento do mural, drag-and-drop avançado com suporte a mouse e touch (mobile)
 */

const BoardModule = {
  boardEl: null,
  activeDrag: null,
  onPositionChange: null,

  init(boardElement, onPositionChange) {
    this.boardEl = boardElement;
    this.onPositionChange = onPositionChange;

    // Listeners globais de movimentação (Mouse)
    window.addEventListener('mousemove', (e) => this.handlePointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => this.handlePointerEnd());

    // Listeners globais de movimentação (Touch para celulares/tablets)
    window.addEventListener('touchmove', (e) => {
      if (this.activeDrag && e.touches.length > 0) {
        e.preventDefault(); // Impede scroll indesejado ao arrastar post-it
        this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => this.handlePointerEnd());
  },

  startDrag(e, element, postitData) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    element.classList.add('is-dragging');

    this.activeDrag = {
      element: element,
      id: postitData.id,
      startX: clientX,
      startY: clientY,
      initialLeft: parseInt(element.style.left, 10) || 0,
      initialTop: parseInt(element.style.top, 10) || 0,
      hasMoved: false
    };
  },

  handlePointerMove(clientX, clientY) {
    if (!this.activeDrag) return;

    const dx = clientX - this.activeDrag.startX;
    const dy = clientY - this.activeDrag.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this.activeDrag.hasMoved = true;
    }

    const newLeft = Math.max(0, this.activeDrag.initialLeft + dx);
    const newTop = Math.max(0, this.activeDrag.initialTop + dy);

    this.activeDrag.element.style.left = `${newLeft}px`;
    this.activeDrag.element.style.top = `${newTop}px`;
  },

  handlePointerEnd() {
    if (!this.activeDrag) return;

    this.activeDrag.element.classList.remove('is-dragging');

    if (this.activeDrag.hasMoved && this.onPositionChange) {
      const finalX = parseInt(this.activeDrag.element.style.left, 10);
      const finalY = parseInt(this.activeDrag.element.style.top, 10);
      this.onPositionChange(this.activeDrag.id, finalX, finalY);
    }

    this.activeDrag = null;
  },

  renderBoard(postits, filterStatus, handlers) {
    this.boardEl.innerHTML = '';

    const filtered = postits.filter(p => {
      if (!filterStatus || filterStatus === 'all') {
        // Na visão geral "Todos", post-its resolvidos ficam escondidos no histórico
        return p.status !== 'resolvido';
      }
      return p.status === filterStatus;
    });

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.position = 'absolute';
      emptyNotice.style.left = '60px';
      emptyNotice.style.top = '60px';
      emptyNotice.style.fontSize = '1.2rem';
      emptyNotice.style.color = 'rgba(0,0,0,0.5)';
      emptyNotice.style.fontStyle = 'italic';
      emptyNotice.innerHTML = '✨ Nenhum post-it nesta categoria. Clique em <strong>+ Novo Post-it</strong> para começar uma conversa!';
      this.boardEl.appendChild(emptyNotice);
      return;
    }

    filtered.forEach(p => {
      const el = PostItModule.createPostItElement(p, {
        onDragStart: (e, element, data) => this.startDrag(e, element, data),
        onEdit: handlers.onEdit,
        onDelete: handlers.onDelete,
        onUnlock: handlers.onUnlock,
        onReaction: handlers.onReaction,
        onToggleResolved: handlers.onToggleResolved
      });
      this.boardEl.appendChild(el);
    });
  }
};

window.BoardModule = BoardModule;
