import * as THREE from "three";

// === Basic Scene Setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 10, 10);
scene.add(dirLight);

// === Maze Generation ===
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;
const CELL_SIZE = 4;

function generateMaze(w, h) {
  const maze = Array(h)
    .fill()
    .map(() => Array(w).fill(0));
  const visited = Array(h)
    .fill()
    .map(() => Array(w).fill(false));

  function carve(x, y) {
    visited[y][x] = true;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dy] of dirs) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx]) {
        maze[y + dy][x + dx] = 1;
        maze[ny][nx] = 1;
        carve(nx, ny);
      }
    }
  }

  maze[0][0] = 1;
  carve(0, 0);
  return maze;
}

const maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);

// === Build Maze Walls ===
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
      walls.push(wall);
    }
  }
}

// === Floor ===
const floorGeo = new THREE.PlaneGeometry(
  MAZE_WIDTH * CELL_SIZE,
  MAZE_HEIGHT * CELL_SIZE
);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x404040 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// === Player ===
let yaw = 0;
const moveSpeed = 0.12;
const playerRadius = 0.6;
camera.position.set(
  (-MAZE_WIDTH / 2) * CELL_SIZE + CELL_SIZE / 2,
  1.5,
  (-MAZE_HEIGHT / 2) * CELL_SIZE + CELL_SIZE / 2
);

// === Input Handling ===
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// === Collision Detection ===
function checkCollision(x, z) {
  for (const wall of walls) {
    const dx = x - wall.position.x;
    const dz = z - wall.position.z;
    const half = CELL_SIZE / 2 + playerRadius;
    if (Math.abs(dx) < half && Math.abs(dz) < half) {
      return true;
    }
  }
  return false;
}

// === Movement & Rotation ===
function updateMovement() {
  let moveX = 0;
  let moveZ = 0;

  // WASD Movement
  if (keys["w"]) moveZ -= 1;
  if (keys["s"]) moveZ += 1;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;

  const len = Math.hypot(moveX, moveZ);
  if (len > 0) {
    moveX /= len;
    moveZ /= len;
  }

  // Arrow keys rotate view
  if (keys["arrowleft"]) yaw += 0.04;
  if (keys["arrowright"]) yaw -= 0.04;

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  const step = moveSpeed * CELL_SIZE;
  let nx = camera.position.x + (forward.x * moveZ + right.x * moveX) * step;
  let nz = camera.position.z + (forward.z * moveZ + right.z * moveX) * step;

  // --- Sliding Collision ---
  // Try X movement
  if (!checkCollision(nx, camera.position.z)) {
    camera.position.x = nx;
  }
  // Try Z movement
  if (!checkCollision(camera.position.x, nz)) {
    camera.position.z = nz;
  }

  camera.rotation.y = yaw;
}

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  renderer.render(scene, camera);
}
animate();

// === Resize Handling ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
