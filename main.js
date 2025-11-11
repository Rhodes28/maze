import * as THREE from "three";

// === Basic scene setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 1);
directional.position.set(10, 10, 10);
scene.add(directional);

// === Test cube ===
const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
const cubeMat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(cubeGeo, cubeMat);
scene.add(cube);

// === Floor ===
const floorGeo = new THREE.PlaneGeometry(100, 100);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x404040 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// === Animate ===
function animate() {
  requestAnimationFrame(animate);
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// === Handle resize ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
