// Keyboard and mouse input for Emberlight.
//
// One Input instance listens on the window and the canvas. It tracks three things the game
// reads every frame: the set of keys currently held, the mouse position translated into the
// game's logical coordinates, and a latch of one-shot presses (Enter, P, M, clicks) that the
// game consumes exactly once, so a held key never re-triggers a menu action.

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas the surface mouse positions are read against
   * @param {(clientX: number, clientY: number) => {x: number, y: number}} toLogical
   *   maps a mouse event's client position into logical playfield coordinates
   */
  constructor(canvas, toLogical) {
    this.canvas = canvas;
    this.toLogical = toLogical;
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.clicked = false;

    window.addEventListener('keydown', (event) => this.#onKeyDown(event));
    window.addEventListener('keyup', (event) => this.held.delete(event.code));
    window.addEventListener('blur', () => this.#clearAll());
    canvas.addEventListener('mousemove', (event) => this.#onMouseMove(event));
    canvas.addEventListener('mousedown', (event) => this.#onMouseDown(event));
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  #onKeyDown(event) {
    // Keep the page still: arrows and space would otherwise scroll it.
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (!event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  }

  #onMouseMove(event) {
    const point = this.toLogical(event.clientX, event.clientY);
    this.mouse.x = point.x;
    this.mouse.y = point.y;
  }

  #onMouseDown(event) {
    this.#onMouseMove(event);
    if (event.button === 0) {
      this.mouse.down = true;
      this.clicked = true;
    }
  }

  #clearAll() {
    this.held.clear();
    this.mouse.down = false;
  }

  /** Movement axis from WASD or the arrow keys: each component in -1, 0 or 1. */
  axis() {
    const left = this.held.has('KeyA') || this.held.has('ArrowLeft');
    const right = this.held.has('KeyD') || this.held.has('ArrowRight');
    const up = this.held.has('KeyW') || this.held.has('ArrowUp');
    const down = this.held.has('KeyS') || this.held.has('ArrowDown');
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
  }

  /** True while the player means to fire: mouse button held, or Space held. */
  get firing() {
    return this.mouse.down || this.held.has('Space');
  }

  /** True once per physical press of the given key code; consumes the press. */
  consumePress(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** True once per mouse click since the last check; consumes the click. */
  consumeClick() {
    const was = this.clicked;
    this.clicked = false;
    return was;
  }

  /** Drop every latched press, so a press spent on one screen never leaks into the next. */
  drainPresses() {
    this.pressed.clear();
    this.clicked = false;
  }
}
