const keys = {};
const justPressed = {};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
}

export function isDown(code) { return !!keys[code]; }

export function wasPressed(code) {
  if (justPressed[code]) {
    justPressed[code] = false;
    return true;
  }
  return false;
}

export function clearJustPressed() {
  for (const k in justPressed) justPressed[k] = false;
}

export function left()  { return isDown('KeyA') || isDown('ArrowLeft'); }
export function right() { return isDown('KeyD') || isDown('ArrowRight'); }
export function up()    { return isDown('KeyW') || isDown('ArrowUp'); }
export function down()  { return isDown('KeyS') || isDown('ArrowDown'); }
export function interact() { return wasPressed('KeyE'); }
export function jump()  { return wasPressed('Space'); }
