// Set up scene, camera, renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88cc88); // Hedge green

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.y = 1.5; // Eye level
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);

// Floor
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x228822 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze walls (simple hedge style boxes)
const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x006600 });
const walls = [];

function addWall(x, z, width, depth) {
  const geometry = new THREE.BoxGeometry(width, 2, depth);
  const wall = new THREE.Mesh(geometry, wallMaterial);
  wall.position.set(x, 1, z);
  scene.add(wall);
  walls.push(wall); // Save wall for collision detection
}

// Simple maze layout
addWall(0, -5, 10, 1);
addWall(0, 5, 10, 1);
addWall(-5, 0, 1, 10);
addWall(5, 0, 1, 10);
addWall(-2, 0, 1, 6);
addWall(2, 0, 1, 6);

// Movement controls
const moveSpeed = 0.1;
const rotateSpeed = 0.03;
const cameraRadius = 0.3; // radius around camera for collision
const keys = {};

document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Collision detection function
function checkCollision(newPos) {
  for (const wall of walls) {
    const dx = Math.abs(newPos.x - wall.position.x);
    const dz = Math.abs(newPos.z - wall.position.z);
    const halfWidth = wall.geometry.parameters.width / 2;
    const halfDepth = wall.geometry.parameters.depth / 2;

    if (dx < halfWidth + cameraRadius && dz < halfDepth + cameraRadius) {
      return true; // collision detected
    }
  }
  return false;
}

function animate() {
  requestAnimationFrame(animate);

  // Rotation
  if (keys['arrowleft']) camera.rotation.y += rotateSpeed;
  if (keys['arrowright']) camera.rotation.y -= rotateSpeed;

  // Calculate direction vectors
  const forward = new THREE.Vector3(
    -Math.sin(camera.rotation.y),
    0,
    -Math.cos(camera.rotation.y)
  );
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

  // Proposed new positions
  let newPos = camera.position.clone();
  if (keys['w']) newPos.add(forward.clone().multiplyScalar(moveSpeed));
  if (keys['s']) newPos.add(forward.clone().multiplyScalar(-moveSpeed));
  if (keys['a']) newPos.add(right.clone().multiplyScalar(-moveSpeed));
  if (keys['d']) newPos.add(right.clone().multiplyScalar(moveSpeed));

  // Apply collision detection
  if (!checkCollision(newPos)) {
    camera.position.copy(newPos);
  }

  renderer.render(scene, camera);
}

animate();

// Handle resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
