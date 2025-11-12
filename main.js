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

// Lighting
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

// Maze setup
const mazeSize = 27;
const cellSize = 2;
const wallThickness = 0.2;
const walls = [];
const grid = Array.from({ length: mazeSize }, () => Array.from({ length: mazeSize }, () => ({
  visited: false, walls: { top: true, right: true, bottom: true, left: true }
})));

// Maze generation
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

// Find dead ends
function getDeadEnds() {
  return grid.flatMap((row, x) => row.flatMap((cell, z) =>
    Object.values(cell.walls).filter(Boolean).length === 3 ? [[x, z]] : []
  ));
}
const deadEnds = getDeadEnds();
const [spawnX, spawnZ] = deadEnds[Math.floor(Math.random() * deadEnds.length)];

// Player
const player = new THREE.Object3D();
player.position.set((spawnX - mazeSize / 2 + 0.5) * cellSize, 0, (spawnZ - mazeSize / 2 + 0.5) * cellSize);
player.add(camera);
camera.position.set(0, 1.5, 0);
scene.add(player);

// BFS (with parents)
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

// Find farthest cell
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

// Beacon
const beaconHeight = 1000;
const beaconMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, emissive: wallColor, emissiveIntensity: 2, metalness: 0.8, roughness: 0.1
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, beaconHeight, 16), beaconMaterial);
beacon.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(beacon);
const glowMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, emissive: wallColor, emissiveIntensity: 1.5, transparent: true, opacity: 0.1
});
const glowCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, beaconHeight, 16), glowMaterial);
glowCylinder.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(glowCylinder);

// Movement setup
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

// Fade overlay
const fadeOverlay = document.createElement('div');
Object.assign(fadeOverlay.style, {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'black', opacity: 0, transition: 'opacity 2s ease', pointerEvents: 'none'
});
document.body.appendChild(fadeOverlay);

// Dialogue
const MESSAGE_SLOTS = [
  "...",
  "A visitor?",
  "I don't get particularly many visitors.",
  "What do you think?",
  "Isn't it nice here?",
  "...",
  "Where are you headed?",
  "That?",
  "...",
  "Want to know what will happen?",
  "I don't think you do.",
  "It's entirely pointless!",
  "...",
  "And yet you amble on?",
  "There are myriad other corners of this place to be explored.",
  "Is the prospect that unbearable?",
  "See the vast expanse above? Isn't it beautiful?",
  "If there was any place to remain, wouldn't this be it?",
  "...",
  "I guess...",
  "No. You couldn't bear to.",
  "Not here, not anywhere. That's not your nature.",
  "Or perhapse it is the nature of this setting?",
  "You could vacate here for weeks. Years. A millennium.",
  "You could know every quirk of this zone, every fascinating little detail...",
  "...",
  "...and still it would beckon.",
  "Is that your weakness?",
  "Or perhaps your strength?",
  "Why?",
  "...",
  "What do you get out of this?",
  "You humans...",
  "...",
  "Have it your way.",
  "..."
];

// Compute path
const pathCells = bfsWithParents(spawnX, spawnZ, exitX, exitZ);
const slots = MESSAGE_SLOTS.length;
const slotPathIndices = [];
for (let i = 0; i < slots; i++) {
  const idx = Math.round(i * (pathCells.length - 1) / (slots - 1));
  slotPathIndices.push(idx);
}
const slotTriggered = new Array(slots).fill(false);

// Message box
const messageBox = document.createElement('div');
Object.assign(messageBox.style, {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '70%',
  padding: '24px',
  background: 'rgba(120,0,0,0.35)',
  color: 'rgb(255,80,80)',
  fontFamily: 'sans-serif',
  fontSize: '20px',
  textAlign: 'center',
  lineHeight: '1.4',
  borderRadius: '0',
  display: 'none',
  zIndex: '9999'
});
document.body.appendChild(messageBox);

function worldPosToCell(wx, wz) {
  const fx = wx / cellSize + mazeSize / 2 - 0.5;
  const fz = wz / cellSize + mazeSize / 2 - 0.5;
  return [Math.round(fx), Math.round(fz)];
}

let messageActive = false;
function triggerSlot(i) {
  const text = MESSAGE_SLOTS[i];
  if (!text || text.trim() === '...') { slotTriggered[i] = true; return; }
  slotTriggered[i] = true;
  messageActive = true;
  messageBox.textContent = text;
  messageBox.style.display = 'block';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const duration = (2 + 0.5 * words) * 1000;
  setTimeout(() => {
    messageBox.style.display = 'none';
    messageActive = false;
  }, duration);
}

// Main loop
let pitch = 0, gameOver = false;
function animate(time) {
  requestAnimationFrame(animate);
  if (gameOver) { renderer.render(scene, camera); return; }

  const pulse = 0.5 + Math.sin(time * 0.002) * 0.5;
  beacon.material.emissiveIntensity = 0.8 + pulse * 1.5;
  glowCylinder.material.emissiveIntensity = 0.6 + pulse * 1.2;

  if (!messageActive) {
    if (keys['arrowleft']) player.rotation.y += 0.06;
    if (keys['arrowright']) player.rotation.y -= 0.06;
    if (keys['arrowup']) pitch = Math.min(pitch + 0.02, Math.PI / 2);
    if (keys['arrowdown']) pitch = Math.max(pitch - 0.02, -Math.PI / 2);
    camera.rotation.x = pitch;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    const move = new THREE.Vector3();
    if (keys['w']) move.add(forward);
    if (keys['s']) move.sub(forward);
    if (keys['a']) move.sub(right);
    if (keys['d']) move.add(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(moveSpeed);
      const newPos = resolveCollision(player.position.clone().add(move));
      const delta = newPos.distanceTo(player.position);
      if (delta > 0) {
        walkedDistance += delta;
        if (walkedDistance >= stepDistance) { playStepSound(); walkedDistance = 0; }
        player.position.copy(newPos);
      }
    }
  }

  const [cx, cz] = worldPosToCell(player.position.x, player.position.z);
  for (let i = 0; i < slotPathIndices.length; i++) {
    if (slotTriggered[i]) continue;
    const target = pathCells[slotPathIndices[i]];
    if (cx === target[0] && cz === target[1]) { triggerSlot(i); break; }
  }

  if (player.position.distanceTo(new THREE.Vector3(exitPos.x, 0, exitPos.z)) < 0.5) {
    gameOver = true;
    audio.pause();
    fadeOverlay.style.opacity = '1';
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
