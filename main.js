import * as THREE from "three";

// ===== Scene & Renderer =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

// ===== Maze parameters =====
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;
const CELL_SIZE = 4;

// ===== Maze generation (recursive backtracker on odd grid) =====
function generateMaze(w, h) {
  // ensure odd dimensions for carving pairs approach (works fine with given params)
  const maze = Array.from({ length: h }, () => Array(w).fill(0));
  const visited = Array.from({ length: h }, () => Array(w).fill(false));

  function carve(cx, cy) {
    visited[cy][cx] = true;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx * 2;
      const ny = cy + dy * 2;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx]) {
        maze[cy + dy][cx + dx] = 1; // path between
        maze[ny][nx] = 1;           // new cell
        carve(nx, ny);
      }
    }
  }

  // Start at (0,0) cell and mark it open
  maze[0][0] = 1;
  carve(0, 0);
  return maze;
}

const maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);

// ===== Build walls (keep reference list) =====
const walls = [];
const wallGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
const wallMat = new THREE.MeshLambertMaterial({ color: 0x006600 });

for (let y = 0; y < MAZE_HEIGHT; y++) {
  for (let x = 0; x < MAZE_WIDTH; x++) {
    if (maze[y][x] === 0) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(
        (x - MAZE_WIDTH / 2) * CELL_SIZE,
        CELL_SIZE / 2,
        (y - MAZE_HEIGHT / 2) * CELL_SIZE
      );
      scene.add(wall);
      // store only x,z and half size for collision math
      walls.push({ x: wall.position.x, z: wall.position.z, half: CELL_SIZE / 2 });
    }
  }
}

// Floor
const floorGeo = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x404040 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ===== Player (sphere approximated in xz plane) =====
const player = {
  x: (-MAZE_WIDTH / 2) * CELL_SIZE + CELL_SIZE / 2,
  z: (-MAZE_HEIGHT / 2) * CELL_SIZE + CELL_SIZE / 2,
  y: 1.5,
  yaw: 0,
  radius: 0.48,     // collision radius in world units (tweak if needed)
  speed: 3.2        // units per second (world units)
};
camera.position.set(player.x, player.y, player.z);
camera.rotation.order = "YXZ"; // yaw then pitch if needed

// ===== Input handling (use e.code for consistency) =====
const state = {
  forward: false,
  back: false,
  left: false,
  right: false,
  turnLeft: false,
  turnRight: false
};

window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": state.forward = true; break;
    case "KeyS": state.back = true; break;
    case "KeyA": state.left = true; break;
    case "KeyD": state.right = true; break;
    case "ArrowLeft": state.turnLeft = true; break;
    case "ArrowRight": state.turnRight = true; break;
  }
});

window.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": state.forward = false; break;
    case "KeyS": state.back = false; break;
    case "KeyA": state.left = false; break;
    case "KeyD": state.right = false; break;
    case "ArrowLeft": state.turnLeft = false; break;
    case "ArrowRight": state.turnRight = false; break;
  }
});

// ===== Collision: sphere (x,z) vs axis-aligned box (x,z) =====
function sphereIntersectsBox(sx, sz, box) {
  const cx = box.x;
  const cz = box.z;
  const half = box.half;

  // closest point on box to sphere center
  const closestX = Math.max(cx - half, Math.min(sx, cx + half));
  const closestZ = Math.max(cz - half, Math.min(sz, cz + half));

  const dx = sx - closestX;
  const dz = sz - closestZ;
  return (dx * dx + dz * dz) < (player.radius * player.radius);
}

// Check if a proposed (x,z) collides any wall
function collidesAny(x, z) {
  for (let i = 0; i < walls.length; i++) {
    if (sphereIntersectsBox(x, z, walls[i])) return true;
  }
  return false;
}

// ===== Movement & rotation update (frame-rate independent) =====
const clock = new THREE.Clock();

function update(dt) {
  // Rotation (arrow keys)
  if (state.turnLeft) player.yaw += 2.6 * dt;     // radians/sec
  if (state.turnRight) player.yaw -= 2.6 * dt;

  // Compute movement vector in local space
  let mx = 0, mz = 0;
  if (state.forward) mz -= 1;
  if (state.back) mz += 1;
  if (state.left) mx -= 1;
  if (state.right) mx += 1;

  // Normalize so diagonal isn't faster
  const mag = Math.hypot(mx, mz);
  if (mag > 0) { mx /= mag; mz /= mag; }

  // Convert local movement to world XZ
  const forward = new THREE.Vector2(Math.sin(player.yaw), Math.cos(player.yaw)); // forward vector on XZ
  const right = new THREE.Vector2(Math.cos(player.yaw), -Math.sin(player.yaw));  // right vector on XZ

  // Desired movement delta in world units for this frame
  const moveSpeedWorld = player.speed; // units per second
  const dx = (forward.x * mz + right.x * mx) * moveSpeedWorld * dt;
  const dz = (forward.y * mz + right.y * mx) * moveSpeedWorld * dt;

  // Sliding: attempt full move, then x-only, then z-only
  const targetX = player.x + dx;
  const targetZ = player.z + dz;

  if (!collidesAny(targetX, targetZ)) {
    player.x = targetX; player.z = targetZ;
  } else {
    // try X-only
    if (!collidesAny(player.x + dx, player.z)) {
      player.x += dx;
    } else if (!collidesAny(player.x, player.z + dz)) {
      // try Z-only
      player.z += dz;
    } else {
      // blocked; do nothing (small epsilon pushback would be optional)
    }
  }

  // Apply to camera
  camera.position.set(player.x, player.y, player.z);
  camera.rotation.y = player.yaw;
}

// ===== Render loop =====
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp dt to avoid huge jumps
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ===== Resize =====
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
