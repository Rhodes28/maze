// main.js — Updated: graph-based narrative messaging, fixed redeclaration bug

// Scene & Renderer
const scene = new THREE.Scene();
const cubeLoader = new THREE.CubeTextureLoader();
const envMap = cubeLoader.load([
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_px.jpg',
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nx.jpg',
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_py.jpg',
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_ny.jpg',
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_pz.jpg',
  'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nz.jpg'
]);
scene.background = scene.environment = envMap;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.3));
scene.add(new THREE.HemisphereLight(0x88aaff, 0x080820, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 15, 10);
scene.add(dirLight);

// Materials
const wallColor = new THREE.Color(0x222288);
const floorColor = new THREE.Color(0x111122);

const reflectiveFloorMaterial = new THREE.MeshStandardMaterial({
  color: floorColor, metalness: 1, roughness: 0.05, envMap, envMapIntensity: 3
});

const reflectiveWallMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, metalness: 0.9, roughness: 0.1, envMap, envMapIntensity: 3,
  emissive: wallColor, emissiveIntensity: 0.2
});

// Floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), reflectiveFloorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze
const mazeSize = 24, cellSize = 2, wallThickness = 0.2;
const walls = [];
const grid = Array.from({ length: mazeSize }, () => Array.from({ length: mazeSize }, () => ({
  visited: false, walls: { top: true, right: true, bottom: true, left: true }
})));

// Maze generation (recursive backtracker)
function generateMaze(x, z) {
  grid[x][z].visited = true;
  const dirs = ['top', 'right', 'bottom', 'left'].sort(() => Math.random() - 0.5);
  for (const dir of dirs) {
    const nx = x + (dir === 'right') - (dir === 'left');
    const nz = z + (dir === 'bottom') - (dir === 'top');
    if (nx >= 0 && nx < mazeSize && nz >= 0 && nz < mazeSize && !grid[nx][nz].visited) {
      grid[x][z].walls[dir] = false;
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
      grid[nx][nz].walls[opposite[dir]] = false;
      generateMaze(nx, nz);
    }
  }
}
generateMaze(0, 0);

// Walls
function addWall(x, z, width, depth) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 2, depth), reflectiveWallMaterial.clone());
  wall.position.set(x, 1, z);
  scene.add(wall);
  walls.push(wall);
}
const overlap = wallThickness;
for (let x = 0; x < mazeSize; x++) {
  for (let z = 0; z < mazeSize; z++) {
    const cell = grid[x][z];
    const wx = (x - mazeSize / 2 + 0.5) * cellSize;
    const wz = (z - mazeSize / 2 + 0.5) * cellSize;
    if (cell.walls.top) addWall(wx, wz - cellSize / 2, cellSize + overlap, wallThickness);
    if (cell.walls.bottom) addWall(wx, wz + cellSize / 2, cellSize + overlap, wallThickness);
    if (cell.walls.left) addWall(wx - cellSize / 2, wz, wallThickness, cellSize + overlap);
    if (cell.walls.right) addWall(wx + cellSize / 2, wz, wallThickness, cellSize + overlap);
  }
}

// Dead ends for spawn
function getDeadEnds() {
  return grid.flatMap((row, x) => row.flatMap((cell, z) =>
    Object.values(cell.walls).filter(Boolean).length === 3 ? [[x, z]] : []
  ));
}
const deadEnds = getDeadEnds();
const [spawnX, spawnZ] = deadEnds[Math.floor(Math.random() * deadEnds.length)];

// Player & camera (yaw on player, pitch on camera)
const player = new THREE.Object3D();
player.position.set((spawnX - mazeSize / 2 + 0.5) * cellSize, 0, (spawnZ - mazeSize / 2 + 0.5) * cellSize);
player.add(camera);
camera.position.set(0, 1.5, 0);
scene.add(player);

// BFS with parents (used to compute shortest path and later to map message slots)
function bfsWithParents(sx, sz, tx, tz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const parent = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(null));
  const queue = [[sx, sz]]; dist[sx][sz] = 0;
  const dirs = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  while (queue.length) {
    const [x, z] = queue.shift();
    if (x === tx && z === tz) break;
    for (const [dir, dx, dz] of dirs) {
      if (!grid[x][z].walls[dir]) {
        const nx = x + dx, nz = z + dz;
        if (dist[nx][nz] === -1) {
          dist[nx][nz] = dist[x][z] + 1;
          parent[nx][nz] = [x, z];
          queue.push([nx, nz]);
        }
      }
    }
  }
  if (dist[tx][tz] === -1) return [];
  const path = [];
  let cur = [tx, tz];
  while (cur) {
    path.push(cur);
    const p = parent[cur[0]][cur[1]];
    if (!p) break;
    cur = p;
  }
  return path.reverse();
}

// Find farthest cell (beacon) from spawn
function findFarthestCell(sx, sz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const queue = [[sx, sz]]; dist[sx][sz] = 0;
  let farthest = [sx, sz], maxD = 0;
  const dirs = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  while (queue.length) {
    const [x, z] = queue.shift();
    const d = dist[x][z];
    if (d > maxD) { maxD = d; farthest = [x, z]; }
    for (const [dir, dx, dz] of dirs) {
      if (!grid[x][z].walls[dir]) {
        const nx = x + dx, nz = z + dz;
        if (dist[nx][nz] === -1) {
          dist[nx][nz] = d + 1;
          queue.push([nx, nz]);
        }
      }
    }
  }
  return farthest;
}
const [exitX, exitZ] = findFarthestCell(spawnX, spawnZ);
const exitPos = { x: (exitX - mazeSize / 2 + 0.5) * cellSize, z: (exitZ - mazeSize / 2 + 0.5) * cellSize };

// Beacon (tall cylinder + glow)
const beaconHeight = 1000;
const beaconMaterial = new THREE.MeshStandardMaterial({
  color: wallColor,
  emissive: wallColor,
  emissiveIntensity: 2,
  metalness: 0.8,
  roughness: 0.1,
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, beaconHeight, 16), beaconMaterial);
beacon.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(beacon);
const glowMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, emissive: wallColor, emissiveIntensity: 1.5, metalness: 0, roughness: 0,
  transparent: true, opacity: 0.1
});
const glowCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, beaconHeight, 16), glowMaterial);
glowCylinder.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(glowCylinder);

// Movement & collision
const moveSpeed = 0.08, rotateSpeed = 0.06, pitchSpeed = 0.02, cameraRadius = 0.3;
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function resolveCollision(pos) {
  const r = pos.clone();
  for (const wall of walls) {
    const dx = r.x - wall.position.x, dz = r.z - wall.position.z;
    const hw = wall.geometry.parameters.width / 2, hd = wall.geometry.parameters.depth / 2;
    const closestX = Math.max(-hw, Math.min(dx, hw)), closestZ = Math.max(-hd, Math.min(dz, hd));
    const distX = dx - closestX, distZ = dz - closestZ;
    if (Math.abs(distX) < cameraRadius && Math.abs(distZ) < cameraRadius) {
      if (Math.abs(distX) > Math.abs(distZ)) r.x += distX > 0 ? cameraRadius - distX : -cameraRadius - distX;
      else r.z += distZ > 0 ? cameraRadius - distZ : -cameraRadius - distZ;
    }
  }
  return r;
}

// Audio
const audio = new Audio('3.mp3'); audio.volume = 0.25; audio.loop = true; audio.play().catch(()=>{});
const walkAudio = new Audio('walk.mp3'); walkAudio.volume = 0.25;
let walkedDistance = 0, stepDistance = 2;
function playStepSound() { walkAudio.cloneNode().play(); }

// Fade overlay (end)
const fadeOverlay = document.createElement('div');
fadeOverlay.style.position = 'fixed';
fadeOverlay.style.top = '0';
fadeOverlay.style.left = '0';
fadeOverlay.style.width = '100%';
fadeOverlay.style.height = '100%';
fadeOverlay.style.backgroundColor = 'black';
fadeOverlay.style.opacity = '0';
fadeOverlay.style.transition = 'opacity 2s ease';
fadeOverlay.style.pointerEvents = 'none';
document.body.appendChild(fadeOverlay);

// --- Narrative messages setup ---
// Exact message list you provided, with an initial "..." slot as requested:
const MESSAGE_SLOTS = [
  '...', // initial buffer
  "A visitor?",
  "I don't get particularly many visitors.",
  "What do you think?",
  "Isn't it nice here?",
  '...',
  "Where are you headed?",
  "That?",
  "Do you want to know what will happen?",
  "The game will end. Fade to black.",
  "There's no point whatsoever.",
  '...',
  "And yet you amble on.",
  "There are myriad other corners of this place to be explored.",
  "Is the prospect that unbearable?",
  "See the vast expanse above? Isn't it beautiful?",
  "If there was any place to remain, wouldn't this be it?",
  '...',
  "No. You couldn't bear to.",
  "Not here, not anywhere. It's not your nature.",
  "You could vacate here for weeks. Years. A millennium.",
  "You could know every quirk of this zone, every fascinating little detail...",
  '...',
  "...and still it would beckon.",
  "Is that your weakness?",
  "Or perhaps your strength?",
  "Why?",
  "What do you get out of this?",
  "You humans...",
  "Have it your way."
];

// Compute shortest path (cell coordinates) from spawn to exit
const pathCells = bfsWithParents(spawnX, spawnZ, exitX, exitZ); // array of [x,z]
const pathLen = pathCells.length;

// Map message slots evenly onto path indices (first slot index 0, last slot pathLen-1)
const slots = MESSAGE_SLOTS.length;
const slotPathIndices = [];
if (slots === 1) slotPathIndices.push(0);
else {
  for (let i = 0; i < slots; i++) {
    const idx = Math.round(i * (pathLen - 1) / (slots - 1));
    slotPathIndices.push(Math.min(Math.max(idx, 0), pathLen - 1));
  }
}

// Track which slots triggered
const slotTriggered = new Array(slots).fill(false);

// Create message DOM element (red text in translucent red box)
const messageBox = document.createElement('div');
messageBox.style.position = 'fixed';
messageBox.style.left = '50%';
messageBox.style.top = '50%';
messageBox.style.transform = 'translate(-50%, -50%)';
messageBox.style.maxWidth = '80%';
messageBox.style.padding = '18px 24px';
messageBox.style.borderRadius = '8px';
messageBox.style.background = 'rgba(120,0,0,0.35)'; // translucent red
messageBox.style.color = 'rgb(255,80,80)'; // red text
messageBox.style.fontFamily = 'sans-serif';
messageBox.style.fontSize = '20px';
messageBox.style.textAlign = 'center';
messageBox.style.lineHeight = '1.3';
messageBox.style.display = 'none';
messageBox.style.zIndex = '9999';
messageBox.style.pointerEvents = 'auto';
document.body.appendChild(messageBox);

// Helper: convert world position to maze cell indices (x,z)
function worldPosToCell(worldX, worldZ) {
  // inverse of: wx = (x - mazeSize/2 + 0.5)*cellSize
  const fx = worldX / cellSize + mazeSize / 2 - 0.5;
  const fz = worldZ / cellSize + mazeSize / 2 - 0.5;
  const cx = Math.round(fx);
  const cz = Math.round(fz);
  // clamp
  return [
    Math.min(Math.max(cx, 0), mazeSize - 1),
    Math.min(Math.max(cz, 0), mazeSize - 1)
  ];
}

// Trigger a message slot (pauses movement/looking for duration)
let messageActive = false;
function triggerSlot(i) {
  if (i < 0 || i >= MESSAGE_SLOTS.length) return;
  const text = MESSAGE_SLOTS[i];
  if (!text || text.trim() === '...') {
    slotTriggered[i] = true; // it's a blank slot; mark as consumed silently
    return;
  }

  slotTriggered[i] = true;
  messageActive = true;
  // Calculate duration: 2 + number of words (words split by whitespace)
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const durationMs = (2 + wordCount) * 1000;

  messageBox.textContent = text;
  messageBox.style.display = 'block';
  messageBox.style.pointerEvents = 'auto';

  // Hide cursor while message active (optional)
  document.body.style.cursor = 'default';

  // After duration, hide and resume
  setTimeout(() => {
    messageBox.style.display = 'none';
    messageActive = false;
  }, durationMs);
}

// Animation & main loop
let pitch = 0;
let gameOver = false;

function animate(time) {
  requestAnimationFrame(animate);

  // If gameOver (fade done) we still render a final frame; stop updates
  // But we keep rendering so overlay is visible
  if (gameOver) {
    renderer.render(scene, camera);
    return;
  }

  // Beacon pulse & dynamic materials
  const pulse = 0.5 + Math.sin(time * 0.002) * 0.5;
  beacon.material.emissiveIntensity = 0.8 + pulse * 1.5;
  glowCylinder.material.emissiveIntensity = 0.6 + pulse * 1.2;
  walls.forEach(w => w.material.emissiveIntensity = 0.1 + pulse * 0.4);
  floor.material.envMapIntensity = 3 + Math.sin(time * 0.001) * 0.3;

  // Camera rotation (disabled while messageActive)
  if (!messageActive) {
    if (keys['arrowleft']) player.rotation.y += rotateSpeed;
    if (keys['arrowright']) player.rotation.y -= rotateSpeed;
    if (keys['arrowup']) pitch = Math.min(pitch + pitchSpeed, Math.PI / 2);
    if (keys['arrowdown']) pitch = Math.max(pitch - pitchSpeed, -Math.PI / 2);
    camera.rotation.x = pitch;
  }

  // Movement (disabled while messageActive)
  if (!messageActive) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    const moveVector = new THREE.Vector3();
    if (keys['w']) moveVector.add(forward);
    if (keys['s']) moveVector.add(forward.clone().multiplyScalar(-1));
    if (keys['a']) moveVector.add(right.clone().multiplyScalar(-1));
    if (keys['d']) moveVector.add(right);
    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(moveSpeed);
      const newPos = resolveCollision(player.position.clone().add(moveVector));
      const delta = newPos.distanceTo(player.position);
      if (delta > 0) {
        walkedDistance += delta;
        if (walkedDistance >= stepDistance) { playStepSound(); walkedDistance = 0; }
        player.position.copy(newPos);
      }
    }
  }

  // Find which cell player is currently in (graph node)
  const [cellX, cellZ] = worldPosToCell(player.position.x, player.position.z);

  // Check path slots: if current cell matches any slot index along path and slot not yet triggered => trigger
  for (let si = 0; si < slotPathIndices.length; si++) {
    if (slotTriggered[si]) continue;
    const targetIndex = slotPathIndices[si];
    const targetCell = pathCells[targetIndex];
    if (!targetCell) continue;
    if (cellX === targetCell[0] && cellZ === targetCell[1]) {
      triggerSlot(si);
      break; // only handle one slot per frame
    }
  }

  // Exit check → fade to black and stop the game
  if (player.position.distanceTo(new THREE.Vector3(exitPos.x, player.position.y, exitPos.z)) < 0.5) {
    gameOver = true;
    audio.pause();
    fadeOverlay.style.pointerEvents = 'auto';
    fadeOverlay.style.opacity = '1';
    // hide any active message box
    messageBox.style.display = 'none';
    messageActive = false;
  }

  renderer.render(scene, camera);
}

// Start
requestAnimationFrame(animate);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
