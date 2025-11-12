import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js';

let camera, scene, renderer;
let walls = [];
const mazeSize = 24;
const cellSize = 2;

// --- Pick song + environment ---
const songIndex = Math.ceil(Math.random() * 3);
const song = new Audio(`${songIndex}.mp3`);
song.loop = true;
song.volume = 0.3;

// Environment map loader
const cubeLoader = new THREE.CubeTextureLoader();
let envMap;
if (songIndex === 1) {
  envMap = cubeLoader.load([
    'https://threejs.org/examples/textures/cube/Park2/posx.jpg',
    'https://threejs.org/examples/textures/cube/Park2/negx.jpg',
    'https://threejs.org/examples/textures/cube/Park2/posy.jpg',
    'https://threejs.org/examples/textures/cube/Park2/negy.jpg',
    'https://threejs.org/examples/textures/cube/Park2/posz.jpg',
    'https://threejs.org/examples/textures/cube/Park2/negz.jpg'
  ]);
} else if (songIndex === 2) {
  envMap = cubeLoader.load([
    'https://threejs.org/examples/textures/cube/Bridge2/posx.jpg',
    'https://threejs.org/examples/textures/cube/Bridge2/negx.jpg',
    'https://threejs.org/examples/textures/cube/Bridge2/posy.jpg',
    'https://threejs.org/examples/textures/cube/Bridge2/negy.jpg',
    'https://threejs.org/examples/textures/cube/Bridge2/posz.jpg',
    'https://threejs.org/examples/textures/cube/Bridge2/negz.jpg'
  ]);
} else {
  envMap = cubeLoader.load([
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/px.jpg',
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/nx.jpg',
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/py.jpg',
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/ny.jpg',
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/pz.jpg',
    'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/nz.jpg'
  ]);
}

init();
animate();

// --- Initialization ---
function init() {
  scene = new THREE.Scene();
  scene.background = envMap;

  camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(-mazeSize, 1.5, -mazeSize);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(10, 15, 10);
  scene.add(ambient, directional);

  // Floor (reflective)
  const reflectiveMaterial = new THREE.MeshStandardMaterial({
    envMap: envMap,
    metalness: 1.0,
    roughness: 0.05
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), reflectiveMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Generate maze
  const grid = generateMaze(mazeSize, mazeSize);
  const wallGeometry = new THREE.BoxGeometry(cellSize, 2, cellSize);

  for (let x = 0; x < mazeSize; x++) {
    for (let z = 0; z < mazeSize; z++) {
      if (grid[x][z] === 1) {
        const wall = new THREE.Mesh(wallGeometry, reflectiveMaterial);
        wall.position.set(
          (x - mazeSize / 2) * cellSize,
          1,
          (z - mazeSize / 2) * cellSize
        );
        scene.add(wall);
        walls.push(wall);
      }
    }
  }

  // Autoplay song (may require user interaction)
  song.play().catch(() => {
    console.log('Autoplay blocked; user must interact first.');
  });

  window.addEventListener('resize', onWindowResize);
}

// --- Simple random maze generation ---
function generateMaze(width, height) {
  const grid = Array.from({ length: width }, () => Array(height).fill(1));

  function carve(x, y) {
    const dirs = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0]
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = y + dz;
      if (nx > 0 && nx < width - 1 && nz > 0 && nz < height - 1 && grid[nx][nz] === 1) {
        grid[nx - dx / 2][nz - dz / 2] = 0;
        grid[nx][nz] = 0;
        carve(nx, nz);
      }
    }
  }

  grid[1][1] = 0;
  carve(1, 1);
  return grid;
}

// --- Resize handler ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
