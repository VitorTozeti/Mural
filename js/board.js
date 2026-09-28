/**
 * board.js - Controle do mural, movimentação e arrastar/soltar
 */

const BoardModule = {
  boardEl: null,
  activeDrag: null,

  init(boardElement, onPositionChange) {
    this.boardEl = boardElement;
    this.onPositionChange = onPositionChange;

    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
  },

  startDrag(e, element, postitData) {
    if (e.target.closest('button') || e.target.closest('input')) return;

    this.activeDrag = {
      element: element,
      id: postitData.id,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: parseInt(element.style.left, 10) || 0,
      initialTop: parseInt(element.style.top, 10) || 0,
      hasMoved: false
    };
  },

  handleMouseMove(e) {
    if (!this.activeDrag) return;

    const dx = e.clientX - this.activeDrag.startX;
    const dy = e.clientY - this.activeDrag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.activeDrag.hasMoved = true;
    }

    const newLeft = Math.max(0, this.activeDrag.initialLeft + dx);
    const newTop = Math.max(0, this.activeDrag.initialTop + dy);

    this.activeDrag.element.style.left = `${newLeft}px`;
    this.activeDrag.element.style.top = `${newTop}px`;
  },

  handleMouseUp() {
    if (!this.activeDrag) return;

    if (this.activeDrag.hasMoved && this.onPositionChange) {
      const finalX = parseInt(this.activeDrag.element.style.left, 10);
      const finalY = parseInt(this.activeDrag.element.style.top, 10);
      this.onPositionChange(this.activeDrag.id, finalX, finalY);
    }

    this.activeDrag = null;
  },

  renderBoard(postits, handlers) {
    this.boardEl.innerHTML = '';
    postits.forEach(p => {
      const el = PostItModule.createPostItElement(
        p,
        handlers.onDragStart,
        handlers.onEdit,
        handlers.onDelete,
        handlers.onUnlock
      );
      this.boardEl.appendChild(el);
    });
  }
};

window.BoardModule = BoardModule;
