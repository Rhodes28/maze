// main.js (optimized - preserves all behavior/features)

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
renderer.shadowMap.enabled = false; // disable shadows for perf
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

// ---------- Title UI ----------
const titleScreen = document.createElement('div');
Object.assign(titleScreen.style, {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 99999, transition: 'opacity 1s ease', opacity: 1
});
const startBox = document.createElement('div');
Object.assign(startBox.style, {
  padding: '20px 60px', borderRadius: '0px',
  background: 'rgba(255,255,255,0.2)', color: 'white',
  fontFamily: 'sans-serif', fontSize: '28px', cursor: 'pointer', userSelect: 'none'
});
startBox.textContent = 'Start';
titleScreen.appendChild(startBox);
document.body.appendChild(titleScreen);

let gameStarted = false, audioStarted = false;
const audio = new Audio('3.mp3');
audio.volume = 0.25; audio.loop = true;
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  titleScreen.style.opacity = '0';
  setTimeout(() => titleScreen.remove(), 1000);
  if (!audioStarted) { audio.play().catch(()=>{}); audioStarted = true; }
}
startBox.addEventListener('click', startGame);

// ---------- Lighting ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.3));
scene.add(new THREE.HemisphereLight(0x88aaff, 0x080820, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 15, 10);
scene.add(dirLight);

// ---------- Colors & Materials ----------
const wallColor = new THREE.Color(0x222288);
const beaconColor = new THREE.Color(0x880808);
const floorColor = new THREE.Color(0x111122);

const reflectiveFloorMaterial = new THREE.MeshStandardMaterial({
  color: floorColor, metalness: 1, roughness: 0.05, envMap, envMapIntensity: 3
});
const reflectiveWallMaterial = new THREE.MeshStandardMaterial({
  color: wallColor, metalness: 0.9, roughness: 0.1, envMap, envMapIntensity: 3,
  emissive: wallColor, emissiveIntensity: 0.1
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), reflectiveFloorMaterial);
floor.rotation.x = -Math.PI/2;
scene.add(floor);

// ---------- Maze Generation ----------
const mazeSize = 40;
const cellSize = 2;
const wallThickness = 0.2;
const overlap = wallThickness;

const grid = Array.from({ length: mazeSize }, () => Array.from({ length: mazeSize }, () => ({
  visited: false, walls: { top: true, right: true, bottom: true, left: true }
})));

function generateMaze(x, z) {
  grid[x][z].visited = true;
  const dirs = ['top','right','bottom','left'].sort(()=>Math.random()-0.5);
  for (const dir of dirs) {
    const nx = x + (dir === 'right') - (dir === 'left');
    const nz = z + (dir === 'bottom') - (dir === 'top');
    if (nx >= 0 && nx < mazeSize && nz >= 0 && nz < mazeSize && !grid[nx][nz].visited) {
      grid[x][z].walls[dir] = false;
      const opposite = { top:'bottom', bottom:'top', left:'right', right:'left' };
      grid[nx][nz].walls[opposite[dir]] = false;
      generateMaze(nx, nz);
    }
  }
}
generateMaze(0,0);

// ---------- Instanced Walls (performance win) ----------
const maxInstances = mazeSize * mazeSize * 4;
const wallGeo = new THREE.BoxGeometry(1, 2, 1);
const wallInstanced = new THREE.InstancedMesh(wallGeo, reflectiveWallMaterial, maxInstances);
const dummy = new THREE.Object3D();
let instIdx = 0;

for (let x = 0; x < mazeSize; x++) {
  for (let z = 0; z < mazeSize; z++) {
    const cell = grid[x][z];
    const wx = (x - mazeSize/2 + 0.5) * cellSize;
    const wz = (z - mazeSize/2 + 0.5) * cellSize;
    const add = (offX, offZ, width, depth) => {
      dummy.position.set(wx + offX, 1, wz + offZ);
      dummy.scale.set(width, 1, depth);
      dummy.updateMatrix();
      wallInstanced.setMatrixAt(instIdx++, dummy.matrix);
    };
    if (cell.walls.top) add(0, -cellSize/2, cellSize + overlap, wallThickness);
    if (cell.walls.bottom) add(0, cellSize/2, cellSize + overlap, wallThickness);
    if (cell.walls.left) add(-cellSize/2, 0, wallThickness, cellSize + overlap);
    if (cell.walls.right) add(cellSize/2, 0, wallThickness, cellSize + overlap);
  }
}
wallInstanced.instanceMatrix.needsUpdate = true;
scene.add(wallInstanced);

// ---------- Dead-ends and spawn ----------
function getDeadEnds(){
  return grid.flatMap((row,x)=>row.flatMap((cell,z)=>
    Object.values(cell.walls).filter(Boolean).length === 3 ? [[x,z]] : []
  ));
}
const deadEnds = getDeadEnds();
const [spawnX, spawnZ] = deadEnds[Math.floor(Math.random()*deadEnds.length)];

// ---------- Player and Camera ----------
const player = new THREE.Object3D();
player.position.set((spawnX - mazeSize/2 + 0.5) * cellSize, 0, (spawnZ - mazeSize/2 + 0.5) * cellSize);
player.add(camera);
camera.position.set(0, 1.5, 0);
scene.add(player);

// ---------- Pathfinding / Beacon ----------
function bfsWithParents(sx, sz, tx, tz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const parent = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(null));
  const queue = [[sx, sz]]; let qi = 0; dist[sx][sz] = 0;
  const dirs = [['top',0,-1], ['bottom',0,1], ['left',-1,0], ['right',1,0]];
  while (qi < queue.length) {
    const [x,z] = queue[qi++]; if (x === tx && z === tz) break;
    for (const [dir,dx,dz] of dirs) {
      if (!grid[x][z].walls[dir]) {
        const nx = x+dx, nz = z+dz;
        if (dist[nx][nz] === -1) {
          dist[nx][nz] = dist[x][z] + 1;
          parent[nx][nz] = [x,z];
          queue.push([nx,nz]);
        }
      }
    }
  }
  const path = []; let cur = [tx, tz];
  while (cur) { path.push(cur); cur = parent[cur[0]][cur[1]]; }
  return path.reverse();
}
function findFarthestCell(sx, sz) {
  const dist = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const queue = [[sx,sz]]; let qi = 0; dist[sx][sz] = 0;
  let farthest = [sx,sz], maxD = 0;
  const dirs = [['top',0,-1], ['bottom',0,1], ['left',-1,0], ['right',1,0]];
  while (qi < queue.length) {
    const [x,z] = queue[qi++], d = dist[x][z];
    if (d > maxD) { maxD = d; farthest = [x,z]; }
    for (const [dir,dx,dz] of dirs) {
      if (!grid[x][z].walls[dir]) {
        const nx = x+dx, nz = z+dz;
        if (dist[nx][nz] === -1) {
          dist[nx][nz] = d + 1;
          queue.push([nx,nz]);
        }
      }
    }
  }
  return farthest;
}
const [exitX, exitZ] = findFarthestCell(spawnX, spawnZ);
const exitPos = { x: (exitX - mazeSize/2 + 0.5) * cellSize, z: (exitZ - mazeSize/2 + 0.5) * cellSize };

// beacon & glow
const beaconHeight = 1000;
const beaconMaterial = new THREE.MeshStandardMaterial({
  color: beaconColor, emissive: beaconColor, emissiveIntensity: 2, metalness: 0.8, roughness: 0.1
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,beaconHeight,8), beaconMaterial);
beacon.position.set(exitPos.x, beaconHeight/2, exitPos.z);
scene.add(beacon);
const glowMaterial = new THREE.MeshStandardMaterial({
  color: beaconColor, emissive: beaconColor, emissiveIntensity: 1.5, transparent: true, opacity: 0.1
});
const glowCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,beaconHeight,8), glowMaterial);
glowCylinder.position.copy(beacon.position);
scene.add(glowCylinder);

// ---------- Movement, input, audio ----------
const moveSpeed = 0.07, rotateSpeed = 0.05, pitchSpeed = 0.02, cameraRadius = 0.3;
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

const stepPool = Array.from({length:3}, () => new Audio('walk.mp3'));
stepPool.forEach(a => a.volume = 0.40);
let stepIndex = 0, walkedDistance = 0, stepDistance = 2;
function playStepSound(){ const a = stepPool[stepIndex]; a.currentTime = 0; a.play(); stepIndex = (stepIndex+1) % stepPool.length; }

// ---------- Message system ----------
const MESSAGE_SLOTS = [
"...","Oh? A visitor?","I don't get particularly many visitors.","What do you think?",
"I think it's nice here!","...","Where are you headed?","That?","...",
"Does it spark your curiosity?","Well of course it does.","However...","It will kill you! Don't approach it!",
"There are other corners of this place to explore.","...","You insist? For what purpose?",
"Why not spend some time here...","See the vast expanse above? Isn't it beautiful?",
"If there was any place to stay, wouldn't this be it?","...","I guess...","No. You couldn't bear to.",
"That is not your nature.","I hope that doesn't sound condescending...",
"It's not that there's nothing else to do, I suppose.","You could vacate here for weeks. Years. A millennium.",
"You could know every quirk of this zone, every fascinating little thing to do...","...",
"...and still it would beckon.","It's by design.","Is that weakness?","Or perhaps strength?",
"I don't get it!","...","...","You humans...","...","...","Have it your way!","..."
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
  textAlign: 'center', lineHeight: '1.4', borderRadius: '0', display: 'none', zIndex: '9999'
});
document.body.appendChild(messageBox);

let messageActive = false;
function triggerSlot(i){
  const text = MESSAGE_SLOTS[i];
  if (!text || text.trim() === '...') { slotTriggered[i] = true; return; }
  slotTriggered[i] = true;
  messageActive = true;
  messageBox.textContent = text;
  messageBox.style.display = 'block';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const duration = (1.75 + 0.25 * words) * 1000;
  setTimeout(()=>{ messageBox.style.display = 'none'; messageActive = false; }, duration);
}

// ---------- Collision helpers (grid-based, efficient) ----------
function worldPosToCell(wx, wz) {
  const fx = wx / cellSize + mazeSize / 2 - 0.5;
  const fz = wz / cellSize + mazeSize / 2 - 0.5;
  return [Math.round(fx), Math.round(fz)];
}

function collideWall(pos, wx, wz, w, d) {
  // pos is THREE.Vector3 that will be modified if collision occurs
  const dx = pos.x - wx, dz = pos.z - wz;
  const closestX = Math.max(-w/2, Math.min(dx, w/2));
  const closestZ = Math.max(-d/2, Math.min(dz, d/2));
  const distX = dx - closestX, distZ = dz - closestZ;
  if (Math.abs(distX) < cameraRadius && Math.abs(distZ) < cameraRadius) {
    if (Math.abs(distX) > Math.abs(distZ)) pos.x += distX > 0 ? cameraRadius - distX : -cameraRadius - distX;
    else pos.z += distZ > 0 ? cameraRadius - distZ : -cameraRadius - distZ;
  }
}

function resolveCollision(pos) {
  // pos is a THREE.Vector3 (clone of player.position)
  const r = pos; // modify in place
  const [cx, cz] = worldPosToCell(pos.x, pos.z);
  // only check the 3x3 neighborhood (fast)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx >= 0 && nx < mazeSize && nz >= 0 && nz < mazeSize) {
        const cell = grid[nx][nz];
        const wx = (nx - mazeSize/2 + 0.5) * cellSize;
        const wz = (nz - mazeSize/2 + 0.5) * cellSize;
        if (cell.walls.top) collideWall(r, wx, wz - cellSize/2, cellSize + overlap, wallThickness);
        if (cell.walls.bottom) collideWall(r, wx, wz + cellSize/2, cellSize + overlap, wallThickness);
        if (cell.walls.left) collideWall(r, wx - cellSize/2, wz, wallThickness, cellSize + overlap);
        if (cell.walls.right) collideWall(r, wx + cellSize/2, wz, wallThickness, cellSize + overlap);
      }
    }
  }
  return r;
}

// ---------- Fade overlay ----------
const fadeOverlay = document.createElement('div');
Object.assign(fadeOverlay.style, {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'black', opacity: 0, transition: 'opacity 2s ease', pointerEvents: 'none'
});
document.body.appendChild(fadeOverlay);

// ---------- Animation loop (optimized allocations) ----------
let pitch = 0, gameOver = false;
let pulseProgress = 0, floorPulseProgress = 0;

const vForward = new THREE.Vector3();
const vRight = new THREE.Vector3();
const vMove = new THREE.Vector3();

function animate() {
  if (!gameStarted) { requestAnimationFrame(animate); return; }
  if (gameOver) { renderer.render(scene, camera); requestAnimationFrame(animate); return; }

  if (!messageActive) {
    // use a fixed dt factor to keep existing feel; avoids creating new numbers each frame
    const dt = 0.016; // ~60fps fixed step
    pulseProgress += dt * 60 * 0.002;
    floorPulseProgress += dt * 60 * 0.001;
    const pulse = 0.5 + Math.sin(pulseProgress) * 0.5;

    beacon.material.emissiveIntensity = 0.8 + pulse * 1.5;
    glowCylinder.material.emissiveIntensity = 0.6 + pulse * 1.2;
    reflectiveWallMaterial.emissiveIntensity = 0.08 + pulse * 0.26;
    floor.material.envMapIntensity = 3 + Math.sin(floorPulseProgress) * 0.3;

    if (keys['arrowleft']) player.rotation.y += rotateSpeed;
    if (keys['arrowright']) player.rotation.y -= rotateSpeed;
    if (keys['arrowup']) pitch = Math.min(pitch + pitchSpeed, Math.PI/2);
    if (keys['arrowdown']) pitch = Math.max(pitch - pitchSpeed, -Math.PI/2);
    camera.rotation.x = pitch;

    vForward.set(0,0,-1).applyEuler(player.rotation);
    vRight.set(1,0,0).applyEuler(player.rotation);
    vMove.set(0,0,0);
    if (keys['w']) vMove.add(vForward);
    if (keys['s']) vMove.sub(vForward);
    if (keys['a']) vMove.sub(vRight);
    if (keys['d']) vMove.add(vRight);

    if (vMove.lengthSq() > 0) {
      vMove.normalize().multiplyScalar(moveSpeed);
      const candidate = resolveCollision(player.position.clone().add(vMove));
      const delta = candidate.distanceTo(player.position);
      if (delta > 0) {
        walkedDistance += delta;
        if (walkedDistance >= stepDistance) { playStepSound(); walkedDistance = 0; }
        player.position.copy(candidate);
      }
    }
  }

  // dialogue triggering based on path progress
  const [cx, cz] = worldPosToCell(player.position.x, player.position.z);
  for (let i = 0; i < slotPathIndices.length; i++) {
    if (slotTriggered[i]) continue;
    const target = pathCells[slotPathIndices[i]];
    if (cx === target[0] && cz === target[1]) { triggerSlot(i); break; }
  }

  // exit check
  const dx = player.position.x - exitPos.x, dz = player.position.z - exitPos.z;
  if (Math.sqrt(dx*dx + dz*dz) < 0.5) {
    gameOver = true;
    audio.pause();
    fadeOverlay.style.opacity = '1';
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
