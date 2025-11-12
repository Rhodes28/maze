// Scene setup
const scene = new THREE.Scene();

function randomColor() {
  const hue = Math.random() * 360;
  return new THREE.Color(`hsl(${hue}, 60%, 50%)`);
}

scene.background = randomColor();
const floorColor = randomColor();
const wallColor = floorColor.clone().offsetHSL(0, 0, -0.15);
const beaconColor = randomColor();

// Camera + renderer
const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Glossy material factory
function glossyMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });
}

// Glossy floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), glossyMaterial(floorColor));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze setup
const mazeSize = 24;
const cellSize = 2;
const wallThickness = 0.2;
const grid = [];

for (let x = 0; x < mazeSize; x++) {
  grid[x] = [];
  for (let z = 0; z < mazeSize; z++) {
    grid[x][z] = { visited: false, walls: { top: true, right: true, bottom: true, left: true } };
  }
}

// Maze generation (recursive backtracking)
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
      if (dir === 'top') grid[nx][nz].walls.bottom = false;
      if (dir === 'bottom') grid[nx][nz].walls.top = false;
      if (dir === 'left') grid[nx][nz].walls.right = false;
      if (dir === 'right') grid[nx][nz].walls.left = false;
      generateMaze(nx, nz);
    }
  }
}
generateMaze(0, 0);

// Build merged walls (continuous strips)
const wallMaterial = glossyMaterial(wallColor);
const walls = [];

// Horizontal walls
for (let z = 0; z <= mazeSize; z++) {
  let start = null;
  for (let x = 0; x < mazeSize; x++) {
    const hasWall = z < mazeSize && grid[x][z]?.walls.top;
    if (hasWall && start === null) start = x;
    else if ((!hasWall || x === mazeSize - 1) && start !== null) {
      const end = hasWall ? x : x - 1;
      const length = (end - start + 1) * cellSize;
      const wx = ((start + end + 1) / 2 - mazeSize / 2) * cellSize;
      const wz = (z - mazeSize / 2) * cellSize - cellSize / 2;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(length + wallThickness, 2, wallThickness),
        wallMaterial
      );
      wall.position.set(wx, 1, wz);
      scene.add(wall);
      walls.push(wall);
      start = null;
    }
  }
}

// Vertical walls
for (let x = 0; x <= mazeSize; x++) {
  let start = null;
  for (let z = 0; z < mazeSize; z++) {
    const hasWall = x < mazeSize && grid[x][z]?.walls.left;
    if (hasWall && start === null) start = z;
    else if ((!hasWall || z === mazeSize - 1) && start !== null) {
      const end = hasWall ? z : z - 1;
      const length = (end - start + 1) * cellSize;
      const wx = (x - mazeSize / 2) * cellSize - cellSize / 2;
      const wz = ((start + end + 1) / 2 - mazeSize / 2) * cellSize;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, 2, length + wallThickness),
        wallMaterial
      );
      wall.position.set(wx, 1, wz);
      scene.add(wall);
      walls.push(wall);
      start = null;
    }
  }
}

// Camera start
camera.position.set(-mazeSize / 2 * cellSize + cellSize / 2, 1.5, -mazeSize / 2 * cellSize + cellSize / 2);

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
  new THREE.MeshPhongMaterial({
    color: beaconColor,
    emissive: beaconColor,
    emissiveIntensity: 1
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

// Music
const tracks = ['1.mp3', '2.mp3', '3.mp3'];
const audio = new Audio(tracks[Math.floor(Math.random() * tracks.length)]);
audio.volume = 0.2;
audio.loop = true;
audio.play().catch(() => console.log("Autoplay blocked by browser."));

// Animate
function animate(time) {
  requestAnimationFrame(animate);

  // Beacon pulse
  const pulse = 0.5 + Math.sin(time * 0.002) * 0.5;
  beacon.material.emissiveIntensity = 0.5 + pulse * 1.5;

  // Controls
  if (keys['arrowleft']) camera.rotation.y += rotateSpeed;
  if (keys['arrowright']) camera.rotation.y -= rotateSpeed;

  const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  let newPos = camera.position.clone();

  if (keys['w']) {
    const pos = newPos.clone().add(forward.clone().multiplyScalar(moveSpeed));
    if (!checkCollision(pos)) newPos.copy(pos);
  }
  if (keys['s']) {
    const pos = newPos.clone().add(forward.clone().multiplyScalar(-moveSpeed));
    if (!checkCollision(pos)) newPos.copy(pos);
  }
  if (keys['a']) {
    const pos = newPos.clone().add(right.clone().multiplyScalar(-moveSpeed));
    if (!checkCollision(pos)) newPos.copy(pos);
  }
  if (keys['d']) {
    const pos = newPos.clone().add(right.clone().multiplyScalar(moveSpeed));
    if (!checkCollision(pos)) newPos.copy(pos);
  }

  camera.position.copy(newPos);

  const dx = camera.position.x - exitPos.x;
  const dz = camera.position.z - exitPos.z;
  if (Math.sqrt(dx * dx + dz * dz) < 0.5) window.location.reload();

  renderer.render(scene, camera);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
