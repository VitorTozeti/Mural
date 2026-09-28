/**
 * board.js - Mural: arrastar post-its, conexões (linhas) entre post-its e duplo clique para criar
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const BoardModule = {
  boardEl: null,
  svgEl: null,
  callbacks: {},
  links: [],
  drag: null,
  linkDrag: null,

  init(boardEl, callbacks) {
    this.boardEl = boardEl;
    this.containerEl = boardEl.parentElement;
    this.callbacks = callbacks;
    this.pan = null;

    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    boardEl.addEventListener('dblclick', (e) => {
      if (e.target.closest('.postit') || e.target.closest('.link-hit')) return;
      const { x, y } = this.toBoardCoords(e.clientX, e.clientY);
      callbacks.onBoardDoubleClick(x, y);
    });

    if (this.containerEl) {
      this.containerEl.addEventListener('pointerdown', (e) => this.startPan(e));
    }
  },

  startPan(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this.drag || this.linkDrag) return;
    // Só inicia o pan se o clique começou em área vazia do mural (não num post-it,
    // botão, input ou outro elemento interativo).
    if (e.target.closest('.postit') || e.target.closest('.link-hit') ||
        e.target.closest('button') || e.target.closest('input') ||
        e.target.closest('select') || e.target.closest('textarea') ||
        e.target.closest('#composer') || e.target.closest('.link-handle')) {
      return;
    }
    this.pan = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: this.containerEl.scrollLeft,
      startScrollTop: this.containerEl.scrollTop,
      moved: false
    };
    this.containerEl.classList.add('is-panning');
  },

  toBoardCoords(clientX, clientY) {
    const r = this.boardEl.getBoundingClientRect();
    return { x: Math.round(clientX - r.left), y: Math.round(clientY - r.top) };
  },

  startDrag(e, element, postit) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('.link-handle')) return;
    e.preventDefault();
    element.classList.add('is-dragging');
    this.drag = {
      element,
      id: postit.id,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: parseInt(element.style.left, 10) || 0,
      initialTop: parseInt(element.style.top, 10) || 0,
      hasMoved: false
    };
  },

  startLink(e, fromId) {
    this.linkDrag = { fromId, ...this.toBoardCoords(e.clientX, e.clientY), targetEl: null };
    document.body.classList.add('is-linking');
    this.drawLinks();
  },

  onPointerMove(e) {
    if (this.pan) {
      const dx = e.clientX - this.pan.startX;
      const dy = e.clientY - this.pan.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.pan.moved = true;
      this.containerEl.scrollLeft = this.pan.startScrollLeft - dx;
      this.containerEl.scrollTop = this.pan.startScrollTop - dy;
      return;
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.drag.hasMoved = true;
      this.drag.element.style.left = `${Math.max(0, this.drag.initialLeft + dx)}px`;
      this.drag.element.style.top = `${Math.max(0, this.drag.initialTop + dy)}px`;
      this.drawLinks();
    } else if (this.linkDrag) {
      Object.assign(this.linkDrag, this.toBoardCoords(e.clientX, e.clientY));
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under ? under.closest('.postit') : null;
      const valid = target && target.dataset.id !== this.linkDrag.fromId ? target : null;
      if (this.linkDrag.targetEl !== valid) {
        if (this.linkDrag.targetEl) this.linkDrag.targetEl.classList.remove('link-target');
        if (valid) valid.classList.add('link-target');
        this.linkDrag.targetEl = valid;
      }
      this.drawLinks();
    }
  },

  onPointerUp() {
    if (this.pan) {
      this.containerEl.classList.remove('is-panning');
      this.pan = null;
      return;
    }
    if (this.drag) {
      const { element, id, hasMoved } = this.drag;
      element.classList.remove('is-dragging');
      this.drag = null;
      if (hasMoved) {
        this.callbacks.onMove(id, parseInt(element.style.left, 10), parseInt(element.style.top, 10));
      }
    } else if (this.linkDrag) {
      const { fromId, targetEl } = this.linkDrag;
      if (targetEl) targetEl.classList.remove('link-target');
      this.linkDrag = null;
      document.body.classList.remove('is-linking');
      this.drawLinks();
      if (targetEl) this.callbacks.onLink(fromId, targetEl.dataset.id);
    }
  },

  center(el) {
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
  },

  makeLine(a, b, cls) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('class', cls);
    return line;
  },

  drawLinks() {
    if (!this.svgEl) return;
    this.svgEl.replaceChildren();

    this.links.forEach(link => {
      const fromEl = document.getElementById(`postit-${link.from}`);
      const toEl = document.getElementById(`postit-${link.to}`);
      if (!fromEl || !toEl) return;
      const a = this.center(fromEl);
      const b = this.center(toEl);

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'link');
      const hit = this.makeLine(a, b, 'link-hit');
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = 'Clique para remover a conexão';
      hit.appendChild(title);
      hit.addEventListener('click', () => this.callbacks.onUnlink(link.id));
      group.append(this.makeLine(a, b, 'link-line'), hit);
      this.svgEl.appendChild(group);
    });

    if (this.linkDrag) {
      const fromEl = document.getElementById(`postit-${this.linkDrag.fromId}`);
      if (fromEl) {
        const end = this.linkDrag.targetEl ? this.center(this.linkDrag.targetEl) : this.linkDrag;
        this.svgEl.appendChild(this.makeLine(this.center(fromEl), end, 'link-line link-temp'));
      }
    }
  },

  renderBoard(postits, links, handlers, currentAuthor) {
    this.boardEl.replaceChildren();

    this.svgEl = document.createElementNS(SVG_NS, 'svg');
    this.svgEl.setAttribute('class', 'links-layer');
    this.boardEl.appendChild(this.svgEl);

    postits.forEach(p => {
      const el = PostItModule.createPostItElement(p, {
        ...handlers,
        onDragStart: (e, element, data) => this.startDrag(e, element, data),
        onLinkStart: (e, id) => this.startLink(e, id)
      }, currentAuthor);
      this.boardEl.appendChild(el);
    });

    const visible = new Set(postits.map(p => p.id));
    this.links = links.filter(l => visible.has(l.from) && visible.has(l.to));
    this.drawLinks();
  }
};

window.BoardModule = BoardModule;
