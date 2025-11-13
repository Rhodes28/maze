import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { BufferGeometryUtils } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.min.js';

// --- Scene + Renderer ---
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

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Title Screen ---
const titleScreen = document.createElement('div');
Object.assign(titleScreen.style, {
  position: 'fixed',
  top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'black',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 99999,
  transition: 'opacity 1s ease',
  opacity: 1
});
const startBox = document.createElement('div');
Object.assign(startBox.style, {
  padding: '20px 60px',
  borderRadius: '0px',
  background: 'rgba(255,255,255,0.2)',
  color: 'white',
  fontFamily: 'sans-serif',
  fontSize: '28px',
  cursor: 'pointer',
  userSelect: 'none'
});
startBox.textContent = 'Start';
titleScreen.appendChild(startBox);
document.body.appendChild(titleScreen);

let gameStarted = false;
let audioStarted = false;
const audio = new Audio('3.mp3');
audio.volume = 0.25;
audio.loop = true;

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  titleScreen.style.opacity = '0';
  setTimeout(() => { titleScreen.remove(); }, 1000);
  if (!audioStarted) {
    audio.play().catch(() => {});
    audioStarted = true;
  }
}
startBox.addEventListener('click', startGame);

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
scene.add(new THREE.HemisphereLight(0x88aaff, 0x080820, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 15, 10);
scene.add(dirLight);

// --- Materials ---
const wallColor = new THREE.Color(0x222288);
const beaconColor = new THREE.Color(0x880808);
const floorColor = new THREE.Color(0x111122);

const reflectiveFloorMaterial = new THREE.MeshStandardMaterial({
  color: floorColor, metalness: 0.8, roughness: 0.2, envMap, envMapIntensity: 2.5
});
const reflectiveWallMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, metalness: 0.7, roughness: 0.15, envMap, envMapIntensity: 2,
  emissive: wallColor, emissiveIntensity: 0.1
});

// --- Floor ---
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), reflectiveFloorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// --- Maze Generation ---
const mazeSize = 40;
const cellSize = 2;
const wallThickness = 0.2;
const overlap = wallThickness;
const grid = Array.from({ length: mazeSize }, () => Array.from({ length: mazeSize }, () => ({
  visited: false, walls: { top: true, right: true, bottom: true, left: true }
})));

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

// --- Merge Walls for Performance ---
const boxGeo = new THREE.BoxGeometry(1, 2, 1);
const wallGeos = [];
function addWall(x, z, width, depth) {
  const geo = boxGeo.clone();
  geo.scale(width, 1, depth);
  geo.translate(x, 1, z);
  wallGeos.push(geo);
}
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
const merged = BufferGeometryUtils.mergeGeometries(wallGeos, false);
const mergedWalls = new THREE.Mesh(merged, reflectiveWallMaterial);
scene.add(mergedWalls);

// --- Helper Functions ---
function getDeadEnds() {
  return grid.flatMap((row, x) => row.flatMap((cell, z) =>
    Object.values(cell.walls).filter(Boolean).length === 3 ? [[x, z]] : []
  ));
}
const deadEnds = getDeadEnds();
const [spawnX, spawnZ] = deadEnds[Math.floor(Math.random() * deadEnds.length)];

function bfsWithParents(sx, sz, tx, tz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const parent = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(null));
  const queue = [[sx, sz]]; 
  let qi = 0;
  dist[sx][sz] = 0;
  const dirs = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  while (qi < queue.length) {
    const [x, z] = queue[qi++];
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
function findFarthestCell(sx, sz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const queue = [[sx, sz]]; let qi = 0;
  dist[sx][sz] = 0;
  let farthest = [sx, sz], maxD = 0;
  const dirs = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  while (qi < queue.length) {
    const [x, z] = queue[qi++];
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

// --- Beacon ---
const beaconHeight = 1000;
const beaconMaterial = new THREE.MeshStandardMaterial({
  color: beaconColor, emissive: beaconColor, emissiveIntensity: 2, metalness: 0.8, roughness: 0.1
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, beaconHeight, 8), beaconMaterial);
beacon.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(beacon);

// --- Player ---
const player = new THREE.Object3D();
player.position.set((spawnX - mazeSize / 2 + 0.5) * cellSize, 0, (spawnZ - mazeSize / 2 + 0.5) * cellSize);
player.add(camera);
camera.position.set(0, 1.5, 0);
scene.add(player);

// --- Dialogue Setup ---
const MESSAGE_SLOTS = [
"...","Oh? A visitor?","I don't get particularly many visitors.","What do you think?","I think it's nice here!","...","Where are you headed?","That?","...","Does it spark your curiosity?","Well of course it does.","However...","It will kill you! Don't approach it!","There are other corners of this place to explore.","...","You insist? For what purpose?","Why not spend some time here...","See the vast expanse above? Isn't it beautiful?","If there was any place to stay, wouldn't this be it?","...","I guess...","No. You couldn't bear to.","That is not your nature.","I hope that doesn't sound condescending...","It's not that there's nothing else to do, I suppose.","You could vacate here for weeks. Years. A millennium.","You could know every quirk of this zone, every fascinating little thing to do...","...","...and still it would beckon.","It's by design.","Is that weakness?","Or perhaps strength?","I don't get it!","...","...","You humans...","...","...","Have it your way!","..."
];
const pathCells = bfsWithParents(spawnX, spawnZ, exitX, exitZ);
const slots = MESSAGE_SLOTS.length;
const slotPathIndices = Array.from({ length: slots }, (_, i) =>
  Math.round(i * (pathCells.length - 1) / (slots - 1))
);
const slotTriggered = new Array(slots).fill(false);

const messageBox = document.createElement('div');
Object.assign(messageBox.style, {
  position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
  maxWidth: '70%', padding: '24px', background: 'rgba(120,0,0,0.35)',
  color: 'rgb(255,80,80)', fontFamily: 'sans-serif', fontSize: '20px',
  textAlign: 'center', borderRadius: '0', display: 'none', zIndex: '9999'
});
document.body.appendChild(messageBox);

// --- Overlay ---
const fadeOverlay = document.createElement('div');
Object.assign(fadeOverlay.style, {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'black', opacity: 0, transition: 'opacity 2s ease', pointerEvents: 'none'
});
document.body.appendChild(fadeOverlay);

// --- Movement ---
const moveSpeed = 0.07, rotateSpeed = 0.05;
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// --- Step Sounds ---
const stepPool = Array.from({ length: 3 }, () => new Audio('walk.mp3'));
stepPool.forEach(a => a.volume = 0.4);
let stepIndex = 0, walkedDistance = 0, stepDistance = 2;
function playStepSound() {
  const a = stepPool[stepIndex];
  a.currentTime = 0; a.play();
  stepIndex = (stepIndex + 1) % stepPool.length;
}

// --- Helper ---
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
  const words = text.trim().split(/\s+/).length;
  const duration = (1.75 + 0.25 * words) * 1000;
  setTimeout(() => { messageBox.style.display = 'none'; messageActive = false; }, duration);
}

// --- Animation ---
let pulse = 0, frameSkip = 0;
let gameOver = false;
function animate() {
  requestAnimationFrame(animate);
  if (!gameStarted) return;

  // pulse update every few frames
  if (frameSkip++ % 3 === 0) {
    pulse += 0.05;
    const s = 0.5 + Math.sin(pulse) * 0.5;
    beacon.material.emissiveIntensity = 1.2 + s * 1.2;
    reflectiveWallMaterial.emissiveIntensity = 0.08 + s * 0.25;
    floor.material.envMapIntensity = 2.7 + Math.sin(pulse * 0.5) * 0.3;
  }

  if (!gameOver && !messageActive) {
    if (keys['arrowleft']) player.rotation.y += rotateSpeed;
    if (keys['arrowright']) player.rotation.y -= rotateSpeed;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    const move = new THREE.Vector3();
    if (keys['w']) move.add(forward);
    if (keys['s']) move.sub(forward);
    if (keys['a']) move.sub(right);
    if (keys['d']) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(moveSpeed);
      player.position.add(move);
      walkedDistance += move.length();
      if (walkedDistance >= stepDistance) { playStepSound(); walkedDistance = 0; }
    }
  }

  const [cx, cz] = worldPosToCell(player.position.x, player.position.z);
  for (let i = 0; i < slotPathIndices.length; i++) {
    if (slotTriggered[i]) continue;
    const target = pathCells[slotPathIndices[i]];
    if (cx === target[0] && cz === target[1]) { triggerSlot(i); break; }
  }

  if (!gameOver && player.position.distanceTo(new THREE.Vector3(exitPos.x, 0, exitPos.z)) < 0.5) {
    gameOver = true;
    audio.pause();
    fadeOverlay.style.opacity = '1';
  }

  renderer.render(scene, camera);
}
animate();

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
