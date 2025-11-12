// Scene setup
const scene = new THREE.Scene();

function randomColor() {
  const hue = Math.random() * 360;
  return new THREE.Color(`hsl(${hue}, 60%, 50%)`);
}

scene.background = randomColor();
const baseColor = randomColor();
const wallColor = baseColor.clone().offsetHSL(0, 0, -0.15);
const floorColor = baseColor.clone().offsetHSL(0, 0, 0.15);
const beaconColor = randomColor();

// Camera + renderer
const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);

// Glossy material factory
function makeGlossyMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.15,
    metalness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.8
  });
}

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  makeGlossyMaterial(floorColor)
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze settings
const mazeSize = 24;
const cellSize = 2;
const wallThickness = 0.2;
const wallHeight = 2;
const walls = [];

const grid = [];
for (let x = 0; x < mazeSize; x++) {
  grid[x] = [];
  for (let z = 0; z < mazeSize; z++) {
    grid[x][z] = { visited: false, walls: { top: true, right: true, bottom: true, left: true } };
  }
}

// Maze generation
function generateMaze(x, z) {
  grid[x][z].visited = true;
  const dirs = ['top', 'right', 'bottom', 'left'].sort(() => Math.random() - 0.5);
  for (const dir of dirs) {
    let nx = x, nz = z;
    if (dir === 'top') nz -= 1;
    if (dir === 'bottom') nz += 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    if (nx >= 0 && nx < mazeSize && nz >= 0 && nz < mazeSize && !grid[nx][nz].visited) {
      grid[x][z].walls[dir] = false;
      if (dir === 'top') grid[nx][nz].walls['bottom'] = false;
      if (dir === 'bottom') grid[nx][nz].walls['top'] = false;
      if (dir === 'left') grid[nx][nz].walls['right'] = false;
      if (dir === 'right') grid[nx][nz].walls['left'] = false;
      generateMaze(nx, nz);
    }
  }
}
generateMaze(0, 0);

// Add wall helper (with overlap fix)
function addWall(x, z, width, depth) {
  const geometry = new THREE.BoxGeometry(width, wallHeight, depth);
  const wall = new THREE.Mesh(geometry, makeGlossyMaterial(wallColor));
  wall.position.set(x, wallHeight / 2, z);
  scene.add(wall);
  walls.push(wall);
}

// Wall placement with overlap
for (let x = 0; x < mazeSize; x++) {
  for (let z = 0; z < mazeSize; z++) {
    const cell = grid[x][z];
    const wx = (x - mazeSize / 2) * cellSize + cellSize / 2;
    const wz = (z - mazeSize / 2) * cellSize + cellSize / 2;

    // Slight overlap so corners fill perfectly
    const overlap = wallThickness * 0.5;
    const full = cellSize + overlap;

    if (cell.walls.top)
      addWall(wx, wz - cellSize / 2 - overlap / 2, full, wallThickness + overlap);
    if (cell.walls.bottom)
      addWall(wx, wz + cellSize / 2 + overlap / 2, full, wallThickness + overlap);
    if (cell.walls.left)
      addWall(wx - cellSize / 2 - overlap / 2, wz, wallThickness + overlap, full);
    if (cell.walls.right)
      addWall(wx + cellSize / 2 + overlap / 2, wz, wallThickness + overlap, full);
  }
}

// Camera start position
camera.position.set(
  -mazeSize / 2 * cellSize + cellSize / 2,
  1.5,
  -mazeSize / 2 * cellSize + cellSize / 2
);

// Find farthest exit
function findFarthestCell(sx, sz) {
  const distances = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(-1));
  const queue = [[sx, sz]];
  distances[sx][sz] = 0;
  let farthest = [sx, sz], maxDist = 0;
  while (queue.length) {
    const [x, z] = queue.shift();
    const dist = distances[x][z];
    if (dist > maxDist) { maxDist = dist; farthest = [x, z]; }
    const neighbors = [];
    if (!grid[x][z].walls.top && z > 0) neighbors.push([x, z - 1]);
    if (!grid[x][z].walls.bottom && z < mazeSize - 1) neighbors.push([x, z + 1]);
    if (!grid[x][z].walls.left && x > 0) neighbors.push([x - 1, z]);
    if (!grid[x][z].walls.right && x < mazeSize - 1) neighbors.push([x + 1, z]);
    for (const [nx, nz] of neighbors) {
      if (distances[nx][nz] === -1) {
        distances[nx][nz] = dist + 1;
        queue.push([nx, nz]);
      }
    }
  }
  return farthest;
}

const [exitX, exitZ] = findFarthestCell(0, 0);
const exitPos = { 
  x: (exitX - mazeSize / 2) * cellSize + cellSize / 2, 
  z: (exitZ - mazeSize / 2) * cellSize + cellSize / 2 
};

// Beacon
const beaconHeight = 100;
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.2, beaconHeight, 16),
  new THREE.MeshPhysicalMaterial({
    color: beaconColor,
    emissive: beaconColor,
    emissiveIntensity: 2,
    roughness: 0.1,
    metalness: 0.6
  })
);
beacon.position.set(exitPos.x, beaconHeight / 2, exitPos.z);
scene.add(beacon);

// Controls
const moveSpeed = 0.08, rotateSpeed = 0.06, cameraRadius = 0.3;
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Collision detection
function checkCollision(pos) {
  for (const wall of walls) {
    const dx = Math.abs(pos.x - wall.position.x);
    const dz = Math.abs(pos.z - wall.position.z);
    const hw = wall.geometry.parameters.width / 2;
    const hd = wall.geometry.parameters.depth / 2;
    if (dx < hw + cameraRadius && dz < hd + cameraRadius) return true;
  }
  return false;
}

// Background music
const tracks = ['1.mp3', '2.mp3', '3.mp3'];
const audio = new Audio(tracks[Math.floor(Math.random() * tracks.length)]);
audio.volume = 0.2;
audio.loop = true;
audio.play().catch(() => console.log("Autoplay blocked."));

// Animation
function animate(time) {
  requestAnimationFrame(animate);
  const pulse = 0.5 + Math.sin(time * 0.002) * 0.5;
  beacon.material.emissiveIntensity = 1 + pulse;

  if (keys['arrowleft']) camera.rotation.y += rotateSpeed;
  if (keys['arrowright']) camera.rotation.y -= rotateSpeed;

  const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  let newPos = camera.position.clone();
  if (keys['w']) { const pos = newPos.clone().add(forward.clone().multiplyScalar(moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['s']) { const pos = newPos.clone().add(forward.clone().multiplyScalar(-moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['a']) { const pos = newPos.clone().add(right.clone().multiplyScalar(-moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['d']) { const pos = newPos.clone().add(right.clone().multiplyScalar(moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  camera.position.copy(newPos);

  const dx = camera.position.x - exitPos.x;
  const dz = camera.position.z - exitPos.z;
  if (Math.sqrt(dx * dx + dz * dz) < 0.5) window.location.reload();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
