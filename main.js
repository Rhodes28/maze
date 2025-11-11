import * as THREE from "three";

/* ============================================
   Minimal maze + robust input debug + movement
   ============================================ */

/* --- Scene setup --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

/* --- Maze parameters --- */
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;
const CELL_SIZE = 4;

/* --- Simple maze generator --- */
function generateMaze(w, h) {
  const maze = Array.from({ length: h }, () => Array(w).fill(0));
  const visited = Array.from({ length: h }, () => Array(w).fill(false));

  function carve(cx, cy) {
    visited[cy][cx] = true;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
    for (const [dx,dy] of dirs) {
      const nx = cx + dx*2, ny = cy + dy*2;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx]) {
        maze[cy + dy][cx + dx] = 1;
        maze[ny][nx] = 1;
        carve(nx, ny);
      }
    }
  }

  maze[0][0] = 1;
  carve(0,0);
  return maze;
}
const maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);

/* --- Build walls & floor --- */
const walls = [];
const wallGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
const wallMat = new THREE.MeshLambertMaterial({ color: 0x006600 });

for (let y = 0; y < MAZE_HEIGHT; y++) {
  for (let x = 0; x < MAZE_WIDTH; x++) {
    if (maze[y][x] === 0) {
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.position.set((x - MAZE_WIDTH/2) * CELL_SIZE, CELL_SIZE/2, (y - MAZE_HEIGHT/2)*CELL_SIZE);
      scene.add(m);
      walls.push({ x: m.position.x, z: m.position.z, half: CELL_SIZE/2 });
    }
  }
}

const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_WIDTH*CELL_SIZE, MAZE_HEIGHT*CELL_SIZE), new THREE.MeshLambertMaterial({ color: 0x404040 }));
floor.rotation.x = -Math.PI/2;
scene.add(floor);

/* --- Player object --- */
const player = {
  x: (-MAZE_WIDTH/2) * CELL_SIZE + CELL_SIZE*0.75, // start slightly inside cell
  z: (-MAZE_HEIGHT/2) * CELL_SIZE + CELL_SIZE*0.75,
  y: 1.5,
  yaw: 0,
  radius: 0.35, // slightly smaller to fit passages
  speed: 3.2
};
camera.position.set(player.x, player.y, player.z);
camera.rotation.order = "YXZ";

/* --- Input state + HUD refs for debug --- */
const state = {
  forward: false, back: false, left: false, right: false,
  turnLeft: false, turnRight: false
};
const hud = {
  kW: document.getElementById("kW"),
  kA: document.getElementById("kA"),
  kS: document.getElementById("kS"),
  kD: document.getElementById("kD"),
  kLeft: document.getElementById("kLeft"),
  kRight: document.getElementById("kRight"),
  centerHint: document.getElementById("centerHint")
};

/* Allow focusing by click (important in Firefox) */
document.body.addEventListener("click", () => {
  document.body.focus();
  if(hud.centerHint) hud.centerHint.style.display = "none";
});

/* Key handlers: accept both e.code and e.key (layout-safe) */
function handleKey(e, down) {
  const code = e.code || "";
  const key = (e.key || "").toLowerCase();

  if (code === "KeyW" || key === "w") state.forward = down;
  if (code === "KeyS" || key === "s") state.back = down;
  if (code === "KeyA" || key === "a") state.left = down;
  if (code === "KeyD" || key === "d") state.right = down;

  if (code === "ArrowLeft" || key === "arrowleft" || key === "←") state.turnLeft = down;
  if (code === "ArrowRight" || key === "arrowright" || key === "→") state.turnRight = down;

  // update HUD visuals if present
  if(hud.kW) hud.kW.classList.toggle("active", state.forward);
  if(hud.kA) hud.kA.classList.toggle("active", state.left);
  if(hud.kS) hud.kS.classList.toggle("active", state.back);
  if(hud.kD) hud.kD.classList.toggle("active", state.right);
  if(hud.kLeft) hud.kLeft.classList.toggle("active", state.turnLeft);
  if(hud.kRight) hud.kRight.classList.toggle("active", state.turnRight);
}

window.addEventListener("keydown", e => handleKey(e,true));
window.addEventListener("keyup",   e => handleKey(e,false));

/* --- Collision helpers --- */
function sphereIntersectsBox(sx, sz, box) {
  const shrink = 0.1;
  const half = box.half - shrink;
  const cx = box.x, cz = box.z;
  const closestX = Math.max(cx - half, Math.min(sx, cx + half));
  const closestZ = Math.max(cz - half, Math.min(sz, cz + half));
  const dx = sx - closestX, dz = sz - closestZ;
  return (dx*dx + dz*dz) < (player.radius * player.radius);
}
function collidesAny(x, z) {
  for (let i=0;i<walls.length;i++) if (sphereIntersectsBox(x, z, walls[i])) return true;
  return false;
}

/* --- Movement loop --- */
const clock = new THREE.Clock();
function update(dt) {
  // rotation
  if (state.turnLeft) player.yaw += 2.6 * dt;
  if (state.turnRight) player.yaw -= 2.6 * dt;

  // WASD movement
  let mx=0, mz=0;
  if (state.forward) mz -= 1;
  if (state.back) mz += 1;
  if (state.left) mx -= 1;
  if (state.right) mx += 1;

  const mag = Math.hypot(mx,mz);
  if (mag>0){ mx/=mag; mz/=mag; }

  const forward = new THREE.Vector2(Math.sin(player.yaw), Math.cos(player.yaw));
  const right   = new THREE.Vector2(Math.cos(player.yaw), -Math.sin(player.yaw));

  const dx = (forward.x*mz + right.x*mx) * player.speed * dt;
  const dz = (forward.y*mz + right.y*mx) * player.speed * dt;

  const targetX = player.x + dx;
  const targetZ = player.z + dz;

  // sliding: full, x-only, z-only
  if (!collidesAny(targetX, targetZ)) {
    player.x = targetX; player.z = targetZ;
  } else {
    if (!collidesAny(player.x + dx, player.z)) player.x += dx;
    else if (!collidesAny(player.x, player.z + dz)) player.z += dz;
  }

  camera.position.set(player.x, player.y, player.z);
  camera.rotation.y = player.yaw;
}

/* --- Render loop --- */
function animate() {
  const dt = Math.min(clock.getDelta(),0.05);
  update(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();

/* --- Resize --- */
window.addEventListener("resize", ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* --- Debug console --- */
window.addEventListener("keydown", e => console.debug("keydown debug:", {code:e.code,key:e.key}));
window.addEventListener("keyup", e => console.debug("keyup debug:", {code:e.code,key:e.key}));
