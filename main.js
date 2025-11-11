// Set up scene, camera, renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88cc88);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshPhongMaterial({ color: 0x228822 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze parameters
const mazeSize = 10;
const cellSize = 2;
const wallThickness = 0.2;
const walls = [];

// Grid for maze generation
const grid = [];
for (let x = 0; x < mazeSize; x++) {
  grid[x] = [];
  for (let z = 0; z < mazeSize; z++) {
    grid[x][z] = {
      visited: false,
      walls: { top: true, right: true, bottom: true, left: true }
    };
  }
}

// Recursive backtracker
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

// Add walls
function addWall(x, z, width, depth) {
  const geometry = new THREE.BoxGeometry(width, 2, depth);
  const wall = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0x006600 }));
  wall.position.set(x, 1, z);
  scene.add(wall);
  walls.push(wall);
}

// Place walls
for (let x = 0; x < mazeSize; x++) {
  for (let z = 0; z < mazeSize; z++) {
    const cell = grid[x][z];
    const worldX = (x - mazeSize / 2) * cellSize + cellSize / 2;
    const worldZ = (z - mazeSize / 2) * cellSize + cellSize / 2;
    if (cell.walls.top) addWall(worldX, worldZ - cellSize / 2, cellSize, wallThickness);
    if (cell.walls.bottom) addWall(worldX, worldZ + cellSize / 2, cellSize, wallThickness);
    if (cell.walls.left) addWall(worldX - cellSize / 2, worldZ, wallThickness, cellSize);
    if (cell.walls.right) addWall(worldX + cellSize / 2, worldZ, wallThickness, cellSize);
  }
}

// Camera start
camera.position.set(
  -mazeSize / 2 * cellSize + cellSize / 2,
  1.5,
  -mazeSize / 2 * cellSize + cellSize / 2
);

// Exit
const exitCell = { x: mazeSize - 1, z: mazeSize - 1 };
const exitPos = {
  x: (exitCell.x - mazeSize / 2) * cellSize + cellSize / 2,
  z: (exitCell.z - mazeSize / 2) * cellSize + cellSize / 2
};

// Controls
const moveSpeed = 0.1;
const rotateSpeed = 0.03;
const cameraRadius = 0.3;
const keys = {};

document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Collision detection
function checkCollision(pos) {
  for (const wall of walls) {
    const dx = Math.abs(pos.x - wall.position.x);
    const dz = Math.abs(pos.z - wall.position.z);
    const halfWidth = wall.geometry.parameters.width / 2;
    const halfDepth = wall.geometry.parameters.depth / 2;
    if (dx < halfWidth + cameraRadius && dz < halfDepth + cameraRadius) return true;
  }
  return false;
}

// Mini-map
const miniMap = document.createElement('canvas');
miniMap.width = 200;
miniMap.height = 200;
miniMap.style.position = 'absolute';
miniMap.style.top = '10px';
miniMap.style.right = '10px';
miniMap.style.border = '2px solid black';
miniMap.style.borderRadius = '50%';
miniMap.style.backgroundColor = 'white';
document.body.appendChild(miniMap);
const mmCtx = miniMap.getContext('2d');

function drawMiniMap() {
  const radius = miniMap.width / 2;
  mmCtx.clearRect(0, 0, miniMap.width, miniMap.height);
  mmCtx.save();
  mmCtx.translate(radius, radius);
  mmCtx.beginPath();
  mmCtx.arc(0, 0, radius, 0, Math.PI * 2);
  mmCtx.clip();

  const scale = radius / 3; // ~3 cells radius
  const px = camera.position.x;
  const pz = camera.position.z;

  // Rotate map correctly with player (forward is up)
  const angle = camera.rotation.y;

  // Draw nearby cells
  const viewCells = 3;
  const centerX = px;
  const centerZ = pz;

  for (let dx = -viewCells; dx <= viewCells; dx++) {
    for (let dz = -viewCells; dz <= viewCells; dz++) {
      const worldX = centerX + dx * cellSize;
      const worldZ = centerZ + dz * cellSize;

      const gridX = Math.floor(worldX / cellSize + mazeSize / 2);
      const gridZ = Math.floor(worldZ / cellSize + mazeSize / 2);
      if (gridX < 0 || gridX >= mazeSize || gridZ < 0 || gridZ >= mazeSize) continue;
      const cell = grid[gridX][gridZ];

      // Relative position before rotation
      let cx = dx * scale;
      let cz = dz * scale;

      // Rotate point around center by -angle
      const rotatedX = cx * Math.cos(-angle) - cz * Math.sin(-angle);
      const rotatedZ = cx * Math.sin(-angle) + cz * Math.cos(-angle);
      cx = rotatedX;
      cz = rotatedZ;

      mmCtx.strokeStyle = 'black';
      mmCtx.lineWidth = 2;
      if (cell.walls.top) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale / 2, cz - scale / 2); mmCtx.lineTo(cx + scale / 2, cz - scale / 2); mmCtx.stroke(); }
      if (cell.walls.bottom) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale / 2, cz + scale / 2); mmCtx.lineTo(cx + scale / 2, cz + scale / 2); mmCtx.stroke(); }
      if (cell.walls.left) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale / 2, cz - scale / 2); mmCtx.lineTo(cx - scale / 2, cz + scale / 2); mmCtx.stroke(); }
      if (cell.walls.right) { mmCtx.beginPath(); mmCtx.moveTo(cx + scale / 2, cz - scale / 2); mmCtx.lineTo(cx + scale / 2, cz + scale / 2); mmCtx.stroke(); }
    }
  }

  // Draw exit dot correctly rotated
  let ex = exitPos.x - px;
  let ez = exitPos.z - pz;
  const rotatedEx = ex * Math.cos(-angle) - ez * Math.sin(-angle);
  const rotatedEz = ex * Math.sin(-angle) + ez * Math.cos(-angle);
  ex = rotatedEx / cellSize * scale;
  ez = rotatedEz / cellSize * scale;

  if (Math.abs(ex) <= viewCells * scale && Math.abs(ez) <= viewCells * scale) {
    mmCtx.fillStyle = 'green';
    mmCtx.beginPath();
    mmCtx.arc(ex, ez, 5, 0, Math.PI * 2);
    mmCtx.fill();
  }

  // Draw player dot at center
  mmCtx.fillStyle = 'red';
  mmCtx.beginPath();
  mmCtx.arc(0, 0, 5, 0, Math.PI * 2);
  mmCtx.fill();

  mmCtx.restore();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

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

  // Win condition
  const dx = camera.position.x - exitPos.x;
  const dz = camera.position.z - exitPos.z;
  if (Math.sqrt(dx * dx + dz * dz) < 0.5) {
    alert("🎉 You reached the exit! You win!");
    window.location.reload();
  }

  drawMiniMap();
  renderer.render(scene, camera);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
