import * as THREE from "three";

/* --- Scene setup --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

/* --- Maze parameters --- */
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;
const CELL_SIZE = 4;

/* --- Maze generation --- */
function generateMaze(w,h){
    const maze = Array.from({length:h},()=>Array(w).fill(0));
    const visited = Array.from({length:h},()=>Array(w).fill(false));
    function carve(x,y){
        visited[y][x] = true;
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-0.5);
        for(const [dx,dy] of dirs){
            const nx = x + dx*2, ny = y + dy*2;
            if(nx>=0 && nx<w && ny>=0 && ny<h && !visited[ny][nx]){
                maze[y+dy][x+dx] = 1;
                maze[ny][nx] = 1;
                carve(nx,ny);
            }
        }
    }
    maze[0][0] = 1;
    carve(0,0);
    return maze;
}
const maze = generateMaze(MAZE_WIDTH,MAZE_HEIGHT);

/* --- Build walls & floor --- */
const walls=[];
const wallGeo = new THREE.BoxGeometry(CELL_SIZE,CELL_SIZE,CELL_SIZE);
const wallMat = new THREE.MeshLambertMaterial({color:0x006600});

for(let y=0;y<MAZE_HEIGHT;y++){
    for(let x=0;x<MAZE_WIDTH;x++){
        if(maze[y][x]===0){
            const m=new THREE.Mesh(wallGeo,wallMat);
            m.position.set((x-MAZE_WIDTH/2)*CELL_SIZE,CELL_SIZE/2,(y-MAZE_HEIGHT/2)*CELL_SIZE);
            scene.add(m);
            walls.push({x:m.position.x,z:m.position.z,half:CELL_SIZE/2});
        }
    }
}

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAZE_WIDTH*CELL_SIZE,MAZE_HEIGHT*CELL_SIZE),
    new THREE.MeshLambertMaterial({color:0x404040})
);
floor.rotation.x=-Math.PI/2;
scene.add(floor);

/* --- Player --- */
const player={
    pos:new THREE.Vector3((-MAZE_WIDTH/2)*CELL_SIZE + CELL_SIZE*0.75, 1.5, (-MAZE_HEIGHT/2)*CELL_SIZE + CELL_SIZE*0.75),
    yaw:0,
    radius:0.35,
    speed:3.2
};
camera.position.copy(player.pos);
camera.rotation.order="YXZ";

/* --- Input state --- */
const state={forward:false,back:false,left:false,right:false,turnLeft:false,turnRight:false};

document.body.addEventListener("click",()=>{ document.body.focus(); });

function handleKey(e,down){
    const key=(e.key||"").toLowerCase();
    const code=e.code||"";

    if(key==="w"||code==="KeyW") state.forward=down;
    if(key==="s"||code==="KeyS") state.back=down;
    if(key==="a"||code==="KeyA") state.left=down;
    if(key==="d"||code==="KeyD") state.right=down;

    if(key==="arrowleft"||code==="ArrowLeft") state.turnLeft=down;
    if(key==="arrowright"||code==="ArrowRight") state.turnRight=down;
}
window.addEventListener("keydown",e=>handleKey(e,true));
window.addEventListener("keyup",e=>handleKey(e,false));

/* --- Collision helpers --- */
function sphereIntersectsBox(pos,box){
    const half = box.half - 0.05;
    const closestX = Math.max(box.x-half,Math.min(pos.x,box.x+half));
    const closestZ = Math.max(box.z-half,Math.min(pos.z,box.z+half));
    const dx = pos.x - closestX, dz = pos.z - closestZ;
    return (dx*dx + dz*dz)<player.radius*player.radius;
}
function collidesAny(pos){
    for(let i=0;i<walls.length;i++) if(sphereIntersectsBox(pos,walls[i])) return true;
    return false;
}

/* --- Movement loop --- */
const clock=new THREE.Clock();
function update(dt){
    // rotate
    if(state.turnLeft) player.yaw += 2.6*dt;
    if(state.turnRight) player.yaw -= 2.6*dt;

    // movement vector
    const dir = new THREE.Vector3();
    if(state.forward) dir.z-=1;
    if(state.back) dir.z+=1;
    if(state.left) dir.x-=1;
    if(state.right) dir.x+=1;
    if(dir.length()>0) dir.normalize();

    // rotate dir by yaw
    const cos = Math.cos(player.yaw), sin=Math.sin(player.yaw);
    const moveX = dir.x * cos - dir.z * sin;
    const moveZ = dir.x * sin + dir.z * cos;

    const nextPos = player.pos.clone();
    nextPos.x += moveX * player.speed * dt;
    nextPos.z += moveZ * player.speed * dt;

    // collision sliding
    if(!collidesAny(nextPos)){
        player.pos.copy(nextPos);
    } else {
        const slideX = player.pos.clone();
        slideX.x += moveX * player.speed * dt;
        if(!collidesAny(slideX)) player.pos.x = slideX.x;

        const slideZ = player.pos.clone();
        slideZ.z += moveZ * player.speed * dt;
        if(!collidesAny(slideZ)) player.pos.z = slideZ.z;
    }

    camera.position.copy(player.pos);
    camera.rotation.y = player.yaw;
}

/* --- Render --- */
function animate(){
    const dt = Math.min(clock.getDelta(),0.05);
    update(dt);
    renderer.render(scene,camera);
    requestAnimationFrame(animate);
}
animate();

/* --- Resize --- */
window.addEventListener("resize",()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});
