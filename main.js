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

// Generate maze
generateMaze(0, 0);

// Add walls to scene
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

// Start camera in first cell
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

    if (dx < halfWidth + cameraRadius && dz < halfDepth + cameraRadius) {
      return true;
    }
  }
  return false;
}

// Mini-map canvas
const miniMap = document.createElement('canvas');
miniMap.width = 150;
miniMap.height = 150;
miniMap.style.position = 'absolute';
miniMap.style.top = '10px';
miniMap.style.right = '10px';
miniMap.style.border = '2px solid black';
miniMap.style.borderRadius = '50%';
miniMap.style.backgroundColor = 'white';
document.body.appendChild(miniMap);
const mmCtx = miniMap.getContext('2d');

function drawMiniMap() {
  mmCtx.clearRect(0, 0, miniMap.width, miniMap.height);

  const scale = 10; // pixels per cell
  const radius = miniMap.width / 2;

  mmCtx.save();
  mmCtx.translate(radius, radius);
  mmCtx.rotate(-camera.rotation.y); // rotate with player

  const playerX = 0;
  const playerZ = 0;

  // Draw visible cells around player
  const viewCells = 3; // number of cells radius
  const px = Math.floor((camera.position.x + mazeSize / 2 * cellSize - cellSize / 2) / cellSize);
  const pz = Math.floor((camera.position.z + mazeSize / 2 * cellSize - cellSize / 2) / cellSize);

  for (let dx = -viewCells; dx <= viewCells; dx++) {
    for (let dz = -viewCells; dz <= viewCells; dz++) {
      const x = px + dx;
      const z = pz + dz;
      if (x < 0 || x >= mazeSize || z < 0 || z >= mazeSize) continue;
      const cell = grid[x][z];
      const cx = dx * cellSize * scale / cellSize;
      const cz = dz * cellSize * scale / cellSize;

      mmCtx.strokeStyle = 'black';
      mmCtx.lineWidth = 2;
      if (cell.walls.top) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale/2, cz - scale/2); mmCtx.lineTo(cx + scale/2, cz - scale/2); mmCtx.stroke(); }
      if (cell.walls.bottom) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale/2, cz + scale/2); mmCtx.lineTo(cx + scale/2, cz + scale/2); mmCtx.stroke(); }
      if (cell.walls.left) { mmCtx.beginPath(); mmCtx.moveTo(cx - scale/2, cz - scale/2); mmCtx.lineTo(cx - scale/2, cz + scale/2); mmCtx.stroke(); }
      if (cell.walls.right) { mmCtx.beginPath(); mmCtx.moveTo(cx + scale/2, cz - scale/2); mmCtx.lineTo(cx + scale/2, cz + scale/2); mmCtx.stroke(); }
    }
  }

  // Draw exit relative to player
  const exitDx = exitCell.x - px;
  const exitDz = exitCell.z - pz;
  if (Math.abs(exitDx) <= viewCells && Math.abs(exitDz) <= viewCells) {
    mmCtx.fillStyle = 'green';
    mmCtx.beginPath();
    mmCtx.arc(exitDx * scale, exitDz * scale, 5, 0, Math.PI * 2);
    mmCtx.fill();
  }

  // Draw player
  mmCtx.fillStyle = 'red';
  mmCtx.beginPath();
  mmCtx.arc(playerX, playerZ, 5, 0, Math.PI*2);
  mmCtx.fill();

  mmCtx.restore();

  // Circular clipping
  mmCtx.globalCompositeOperation = 'destination-in';
  mmCtx.beginPath();
  mmCtx.arc(radius, radius, radius, 0, Math.PI*2);
  mmCtx.fill();
  mmCtx.globalCompositeOperation = 'source-over';
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (keys['arrowleft']) camera.rotation.y += rotateSpeed;
  if (keys['arrowright']) camera.rotation.y -= rotateSpeed;

  const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0));

  let newPos = camera.position.clone();
  if (keys['w']) { const pos = newPos.clone().add(forward.clone().multiplyScalar(moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['s']) { const pos = newPos.clone().add(forward.clone().multiplyScalar(-moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['a']) { const pos = newPos.clone().add(right.clone().multiplyScalar(-moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }
  if (keys['d']) { const pos = newPos.clone().add(right.clone().multiplyScalar(moveSpeed)); if (!checkCollision(pos)) newPos.copy(pos); }

  camera.position.copy(newPos);

  // Win condition
  const dx = camera.position.x - exitPos.x;
  const dz = camera.position.z - exitPos.z;
  if (Math.sqrt(dx*dx + dz*dz) < 0.5) {
    alert("🎉 You reached the exit! You win!");
    window.location.reload();
  }

  drawMiniMap();
  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
