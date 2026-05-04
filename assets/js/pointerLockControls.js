import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

let camera, scene, renderer, controls;
const platformBoxes = []; 
const objects = [];

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const vertex = new THREE.Vector3();
const color = new THREE.Color();

let gameStatus = 'idle'; 
let startTime = 0;
let maxHeightReached = 0;
let WIN_HEIGHT = 1000; // Altura máxima incrementada drásticamente
let hud; 

init();

function init() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 15000);
    camera.position.set(0, 10, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); 
    // Niebla expandida para que puedas ver más alto
    scene.fog = new THREE.Fog(0xffffff, 0, 1500);

    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 2.5);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    // -- INTERFAZ HUD --
    hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.top = '80px'; // Ajustado por debajo de la Navbar
    hud.style.left = '20px';
    hud.style.color = '#333';
    hud.style.fontSize = '24px';
    hud.style.fontFamily = 'Monospace';
    hud.style.fontWeight = 'bold';
    hud.style.zIndex = '100';
    hud.style.pointerEvents = 'none';
    document.getElementById("container-pointerlock").appendChild(hud);

    // -- CONTROLES --
    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById("blocker");
    const instructions = document.getElementById("instructions");

    instructions.addEventListener("click", function () {
        if (gameStatus === 'won' || gameStatus === 'lost') {
            resetGame(); 
        }
        controls.lock();
    });

    controls.addEventListener("lock", function () {
        instructions.style.display = "none";
        blocker.style.display = "none";
        
        if (gameStatus === 'idle') {
            gameStatus = 'playing';
            startTime = performance.now();
        }
    });

    controls.addEventListener("unlock", function () {
        blocker.style.display = "block";
        instructions.style.display = "flex"; 
    });

    scene.add(controls.object);

    // -- EVENTOS DE TECLADO --
    const onKeyDown = function (event) {
        if (gameStatus !== 'playing') return;
        switch (event.code) {
            case "ArrowUp": case "KeyW": moveForward = true; break;
            case "ArrowLeft": case "KeyA": moveLeft = true; break;
            case "ArrowDown": case "KeyS": moveBackward = true; break;
            case "ArrowRight": case "KeyD": moveRight = true; break;
            case "Space":
                if (canJump === true) velocity.y += 350;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case "ArrowUp": case "KeyW": moveForward = false; break;
            case "ArrowLeft": case "KeyA": moveLeft = false; break;
            case "ArrowDown": case "KeyS": moveBackward = false; break;
            case "ArrowRight": case "KeyD": moveRight = false; break;
        }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // -- SUELO ORIGINAL --
    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    let position = floorGeometry.attributes.position;
    for (let i = 0, l = position.count; i < l; i++) {
        vertex.fromBufferAttribute(position, i);
        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;
        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    floorGeometry = floorGeometry.toNonIndexed();

    position = floorGeometry.attributes.position;
    const colorsFloor = [];
    for (let i = 0, l = position.count; i < l; i++) {
        color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
        colorsFloor.push(color.r, color.g, color.b);
    }
    floorGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colorsFloor, 3));
    
    const floorMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    // -- GENERACIÓN DE LA RUTA DE PARKOUR --
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20).toNonIndexed();
    position = boxGeometry.attributes.position;
    const colorsBox = [];
    for (let i = 0, l = position.count; i < l; i++) {
        color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
        colorsBox.push(color.r, color.g, color.b);
    }
    boxGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colorsBox, 3));

    const numPaths = 6; 

    for (let p = 0; p < numPaths; p++) {
        let curX = (Math.random() * 80 - 40);
        let curY = 10; 
        let curZ = -40 + (Math.random() * 40 - 20);

        while (curY < WIN_HEIGHT) {
            const boxMaterial = new THREE.MeshPhongMaterial({
                specular: 0xffffff,
                flatShading: true,
                vertexColors: true,
            });
            boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);

            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            
            // REDUCCIÓN PROGRESIVA DEL TAMAÑO
            // Conforme la altura (curY) se acerca a WIN_HEIGHT, el ratio baja hasta un mínimo de 0.4 (el 40% de 20x20)
            const shrinkRatio = 1.0 - (curY / WIN_HEIGHT) * 0.6; 
            box.scale.set(shrinkRatio, 1, shrinkRatio); // Encogemos el área (X y Z) pero mantenemos la altura del bloque (Y)

            box.position.set(curX, curY, curZ);

            box.updateMatrixWorld();
            const newBox = new THREE.Box3().setFromObject(box);
            let collision = false;
            
            for (let j = 0; j < platformBoxes.length; j++) {
                if (newBox.intersectsBox(platformBoxes[j])) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                scene.add(box);
                objects.push(box);
                platformBoxes.push(newBox);
            }

            const angle = Math.random() * Math.PI * 2;
            
            // Reducimos levemente la separación horizontal para compensar que las cajas ahora son más pequeñas
            const hDist = 18 + Math.random() * 8; 
            const vDist = 10 + Math.random() * 8;  
            
            curX += Math.cos(angle) * hDist;
            curZ += Math.sin(angle) * hDist;
            curY += vDist;
        }
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    
    document.getElementById('container-pointerlock').appendChild(renderer.domElement);
    window.addEventListener("resize", onWindowResize);
}

function resetGame() {
    camera.position.set(0, 10, 0);
    velocity.set(0, 0, 0);
    gameStatus = 'idle';
    maxHeightReached = 0;
    hud.innerHTML = "";
    document.getElementById("instructions").innerHTML = `
        <p style="font-size:36px">Click to play</p>
        <p>Move: WASD<br/>Jump: SPACE<br/>Look: MOUSE</p>
    `;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Colisiones AABB (Evita atravesar figuras)
function checkCollision(pos) {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, pos.y - 5, pos.z), 
        new THREE.Vector3(4, 10, 4)
    );
    for (let i = 0; i < platformBoxes.length; i++) {
        if (playerBox.intersectsBox(platformBoxes[i])) return true;
    }
    return false;
}

function animate() {
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true && gameStatus === 'playing') {
        
        // 1. Aplicar Gravedad y Fricción
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; 

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); 

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        // 2. Movimiento Horizontal
        const prevX = camera.position.x;
        const prevZ = camera.position.z;
        
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        if (checkCollision(camera.position)) {
            camera.position.x = prevX;
            camera.position.z = prevZ;
            velocity.x = 0;
            velocity.z = 0;
        }

        // 3. Movimiento Vertical
        const prevY = camera.position.y;
        camera.position.y += velocity.y * delta;

        if (checkCollision(camera.position)) {
            camera.position.y = prevY; 
            if (velocity.y < 0) { 
                velocity.y = 0;
                canJump = true;
            } else if (velocity.y > 0) { 
                velocity.y = 0;
            }
        }

        // 4. Límite del suelo
        if (camera.position.y < 10) {
            velocity.y = 0;
            camera.position.y = 10;
            canJump = true;
        }

        // -- ESTADOS DEL JUEGO --
        let elapsed = ((time - startTime) / 1000).toFixed(1);
        hud.innerHTML = `TIEMPO: ${elapsed}s | ALTURA: ${Math.floor(camera.position.y)} / ${WIN_HEIGHT}`;
        
        if (camera.position.y > maxHeightReached) maxHeightReached = camera.position.y;

        // Condición de Victoria
        if (camera.position.y >= WIN_HEIGHT) {
            gameStatus = 'won';
            controls.unlock();
            document.getElementById("instructions").innerHTML = `
                <span style="color: #4CAF50; font-size: 60px; text-shadow: 2px 2px 0 #000;">¡VICTORIA!</span><br>
                <span style="font-size: 24px;">Escalaste hasta la cima en ${elapsed} segundos.</span><br><br>
                Clic para reiniciar
            `;
        } 
        // Condición de Derrota (Caer desde al menos una altura de 40)
        else if (camera.position.y <= 11 && maxHeightReached > 40) {
            gameStatus = 'lost';
            controls.unlock();
            document.getElementById("instructions").innerHTML = `
                <span style="color: #f44336; font-size: 60px; text-shadow: 2px 2px 0 #000;">¡DERROTA!</span><br>
                <span style="font-size: 24px;">Resbalaste y caíste al vacío.</span><br><br>
                Clic para intentar de nuevo
            `;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}