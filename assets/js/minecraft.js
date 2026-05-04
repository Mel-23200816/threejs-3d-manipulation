import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { FirstPersonControls } from "three/addons/controls/FirstPersonControls.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

let container, stats;
let camera, controls, scene, renderer;

// 1. TERRENO MUCHO MÁS GRANDE (256x256)
const worldWidth = 256, worldDepth = 256;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight(worldWidth, worldDepth);

// --- SISTEMA DE BLOQUES 3D ---
const blocks = new Map();

function setBlock(x, y, z, type) {
    blocks.set(`${x},${y},${z}`, type);
}

function getBlock(x, y, z) {
    if (x < 0 || x >= worldWidth || z < 0 || z >= worldDepth) return 0;
    
    const groundHeight = getY(x, z);
    if (y <= groundHeight) return 1; // 1 = Bloque de Suelo
    
    return blocks.get(`${x},${y},${z}`) || 0; // Árboles (2 = Tronco, 3 = Hojas)
}

const timer = new THREE.Timer();
timer.connect(document);

init();

function init() {
    container = document.getElementById( 'container-minecraft' );

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.y = getY(worldHalfWidth, worldHalfDepth) * 100 + 100;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    const matrix = new THREE.Matrix4();

    // -- GEOMETRÍAS PARA EL SUELO (Recortan el atlas.png) --
    const pxG = new THREE.PlaneGeometry(100, 100); pxG.attributes.uv.array[1] = 0.5; pxG.attributes.uv.array[3] = 0.5; pxG.rotateY(Math.PI / 2); pxG.translate(50, 0, 0);
    const nxG = new THREE.PlaneGeometry(100, 100); nxG.attributes.uv.array[1] = 0.5; nxG.attributes.uv.array[3] = 0.5; nxG.rotateY(-Math.PI / 2); nxG.translate(-50, 0, 0);
    const pyG = new THREE.PlaneGeometry(100, 100); pyG.attributes.uv.array[5] = 0.5; pyG.attributes.uv.array[7] = 0.5; pyG.rotateX(-Math.PI / 2); pyG.translate(0, 50, 0);
    const nyG = new THREE.PlaneGeometry(100, 100); nyG.attributes.uv.array[5] = 0.5; nyG.attributes.uv.array[7] = 0.5; nyG.rotateX(Math.PI / 2); nyG.translate(0, -50, 0);
    const pzG = new THREE.PlaneGeometry(100, 100); pzG.attributes.uv.array[1] = 0.5; pzG.attributes.uv.array[3] = 0.5; pzG.translate(0, 0, 50);
    const nzG = new THREE.PlaneGeometry(100, 100); nzG.attributes.uv.array[1] = 0.5; nzG.attributes.uv.array[3] = 0.5; nzG.rotateY(Math.PI); nzG.translate(0, 0, -50);

    // -- GEOMETRÍAS ESTÁNDAR (Para hojas y troncos que usan texturas completas) --
    const pxS = new THREE.PlaneGeometry(100, 100); pxS.rotateY(Math.PI / 2); pxS.translate(50, 0, 0);
    const nxS = new THREE.PlaneGeometry(100, 100); nxS.rotateY(-Math.PI / 2); nxS.translate(-50, 0, 0);
    const pyS = new THREE.PlaneGeometry(100, 100); pyS.rotateX(-Math.PI / 2); pyS.translate(0, 50, 0);
    const nyS = new THREE.PlaneGeometry(100, 100); nyS.rotateX(Math.PI / 2); nyS.translate(0, -50, 0);
    const pzS = new THREE.PlaneGeometry(100, 100); pzS.translate(0, 0, 50);
    const nzS = new THREE.PlaneGeometry(100, 100); nzS.rotateY(Math.PI); nzS.translate(0, 0, -50);

    // -- GENERACIÓN DE ÁRBOLES ALEATORIOS --
    for (let z = 4; z < worldDepth - 4; z++) {
        for (let x = 4; x < worldWidth - 4; x++) {
            if (Math.random() < 0.015) {
                const h = getY(x, z);
                
                // Asegurar que plantamos sobre el suelo
                if (getBlock(x, h + 1, z) === 0) {
                    const trunkHeight = Math.floor(Math.random() * 3) + 4;
                    
                    // Tronco (Tipo 2)
                    for (let y = 1; y <= trunkHeight; y++) setBlock(x, h + y, z, 2); 
                    
                    // Hojas (Tipo 3)
                    const leafYStart = h + trunkHeight - 2;
                    for (let lx = x - 2; lx <= x + 2; lx++) {
                        for (let ly = leafYStart; ly <= leafYStart + 3; ly++) {
                            for (let lz = z - 2; lz <= z + 2; lz++) {
                                const dist = Math.abs(lx - x) + Math.abs(lz - z) + Math.abs(ly - (leafYStart + 1));
                                if (dist < 4 && getBlock(lx, ly, lz) === 0) setBlock(lx, ly, lz, 3);
                            }
                        }
                    }
                }
            }
        }
    }

    // -- ARREGLOS SEPARADOS POR TIPO DE MATERIAL --
    const geometriesGround = [];
    const geometriesTrunk = [];
    const geometriesLeaves = [];

    let maxHeight = 0;
    for(let i=0; i<data.length; i++) {
        const h = getY(i % worldWidth, Math.floor(i / worldWidth));
        if(h > maxHeight) maxHeight = h;
    }
    maxHeight += 15; 

    for (let z = 0; z < worldDepth; z++) {
        for (let x = 0; x < worldWidth; x++) {
            
            let topY = getY(x, z);
            for(let y = topY + 1; y < maxHeight; y++) {
                if (getBlock(x, y, z) !== 0) topY = y;
            }

            for (let y = 0; y <= topY; y++) {
                const blockType = getBlock(x, y, z);
                if (blockType === 0) continue;

                matrix.makeTranslation(
                    x * 100 - worldHalfWidth * 100,
                    y * 100,
                    z * 100 - worldHalfDepth * 100
                );

                const getAdj = (dx, dy, dz) => getBlock(x + dx, y + dy, z + dz);
                
                // Dibujar si colinda con aire (0) o si colinda con hojas (3) y no somos hojas
                const drawFace = (adjType) => adjType === 0 || (blockType !== 3 && adjType === 3);

                // Escoger la plantilla correcta según el material
                const tPx = blockType === 1 ? pxG : pxS;
                const tNx = blockType === 1 ? nxG : nxS;
                const tPy = blockType === 1 ? pyG : pyS;
                const tNy = blockType === 1 ? nyG : nyS;
                const tPz = blockType === 1 ? pzG : pzS;
                const tNz = blockType === 1 ? nzG : nzS;

                const targetArray = blockType === 1 ? geometriesGround : (blockType === 2 ? geometriesTrunk : geometriesLeaves);

                if (drawFace(getAdj(1, 0, 0))) targetArray.push(tPx.clone().applyMatrix4(matrix));
                if (drawFace(getAdj(-1, 0, 0))) targetArray.push(tNx.clone().applyMatrix4(matrix));
                if (drawFace(getAdj(0, 1, 0))) targetArray.push(tPy.clone().applyMatrix4(matrix));
                if (drawFace(getAdj(0, -1, 0))) targetArray.push(tNy.clone().applyMatrix4(matrix));
                if (drawFace(getAdj(0, 0, 1))) targetArray.push(tPz.clone().applyMatrix4(matrix));
                if (drawFace(getAdj(0, 0, -1))) targetArray.push(tNz.clone().applyMatrix4(matrix));
            }
        }
    }

    // -- CARGA DE TEXTURAS MÚLTIPLES --
    const loader = new THREE.TextureLoader();
    
    const textureGround = loader.load("./assets/img/atlas.png");
    textureGround.colorSpace = THREE.SRGBColorSpace;
    textureGround.magFilter = THREE.NearestFilter;

    const textureTrunk = loader.load("./assets/img/tronco.jpg");
    textureTrunk.colorSpace = THREE.SRGBColorSpace;
    textureTrunk.magFilter = THREE.NearestFilter;

    const textureLeaves = loader.load("./assets/img/hojas.jpg");
    textureLeaves.colorSpace = THREE.SRGBColorSpace;
    textureLeaves.magFilter = THREE.NearestFilter;

    // -- EMPAQUETADO DE LAS 3 MALLAS SEPARADAS --
    if(geometriesGround.length > 0) {
        const geomGround = BufferGeometryUtils.mergeGeometries(geometriesGround);
        geomGround.computeBoundingSphere();
        scene.add(new THREE.Mesh(geomGround, new THREE.MeshLambertMaterial({ map: textureGround, side: THREE.DoubleSide })));
    }

    if(geometriesTrunk.length > 0) {
        const geomTrunk = BufferGeometryUtils.mergeGeometries(geometriesTrunk);
        geomTrunk.computeBoundingSphere();
        scene.add(new THREE.Mesh(geomTrunk, new THREE.MeshLambertMaterial({ map: textureTrunk, side: THREE.DoubleSide })));
    }

    if(geometriesLeaves.length > 0) {
        const geomLeaves = BufferGeometryUtils.mergeGeometries(geometriesLeaves);
        geomLeaves.computeBoundingSphere();
        scene.add(new THREE.Mesh(geomLeaves, new THREE.MeshLambertMaterial({ map: textureLeaves, side: THREE.DoubleSide })));
    }

    // -- ILUMINACIÓN Y RENDER --
    const ambientLight = new THREE.AmbientLight(0xeeeeee, 3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
    directionalLight.position.set(1, 1, 0.5).normalize();
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    controls = new FirstPersonControls(camera, renderer.domElement);
    controls.movementSpeed = 1000;
    controls.lookSpeed = 0.125;
    controls.lookVertical = true;

    stats = new Stats();
    container.appendChild(stats.dom);

    window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateHeight(width, height) {
    const data = [], perlin = new ImprovedNoise(), size = width * height, z = Math.random() * 100;
    let quality = 2;

    for (let j = 0; j < 4; j++) {
        if (j === 0) for (let i = 0; i < size; i++) data[i] = 0;

        for (let i = 0; i < size; i++) {
            const x = i % width, y = (i / width) | 0;
            data[i] += perlin.noise(x / quality, y / quality, z) * quality;
        }
        quality *= 4;
    }
    return data;
}

function getY(x, z) {
    return Math.floor(data[x + z * worldWidth] * 0.15) + 15;
}

function animate() {
    timer.update();
    render();
    stats.update();
}

function render() {
    const prevPos = camera.position.clone();
    
    controls.update(timer.getDelta());

    // 2. PAREDES INVISIBLES (Limitar al área generada)
    const minX = -worldHalfWidth * 100 + 50;
    const maxX = (worldHalfWidth - 1) * 100 - 50;
    const minZ = -worldHalfDepth * 100 + 50;
    const maxZ = (worldHalfDepth - 1) * 100 - 50;

    camera.position.x = Math.max(minX, Math.min(maxX, camera.position.x));
    camera.position.z = Math.max(minZ, Math.min(maxZ, camera.position.z));
    // ------------------------------------------------
    
    const getGridCoord = (val, offset) => Math.round((val + offset * 100) / 100);
    
    const gridY_head = Math.round(camera.position.y / 100);
    const gridY_feet = Math.round((camera.position.y - 150) / 100); 
    
    const nextX = camera.position.x;
    const nextZ = camera.position.z;
    
    const gridNextX = getGridCoord(nextX, worldHalfWidth);
    const gridPrevZ = getGridCoord(prevPos.z, worldHalfDepth);
    
    if (getBlock(gridNextX, gridY_head, gridPrevZ) !== 0 || getBlock(gridNextX, gridY_feet + 1, gridPrevZ) !== 0) {
        camera.position.x = prevPos.x;
    }
    
    const gridPrevX = getGridCoord(camera.position.x, worldHalfWidth);
    const gridNextZ = getGridCoord(nextZ, worldHalfDepth);
    
    if (getBlock(gridPrevX, gridY_head, gridNextZ) !== 0 || getBlock(gridPrevX, gridY_feet + 1, gridNextZ) !== 0) {
        camera.position.z = prevPos.z;
    }

    const currentGridX = getGridCoord(camera.position.x, worldHalfWidth);
    const currentGridZ = getGridCoord(camera.position.z, worldHalfDepth);
    
    let surfaceY = -999999; 
    if(currentGridX >= 0 && currentGridX < worldWidth && currentGridZ >= 0 && currentGridZ < worldDepth){
        for (let y = gridY_head + 2; y >= 0; y--) {
            if (getBlock(currentGridX, y, currentGridZ) !== 0) {
                surfaceY = y * 100 + 50; 
                break;
            }
        }
    }
    
    if (camera.position.y - 150 < surfaceY) {
        camera.position.y = surfaceY + 150;
    }

    renderer.render(scene, camera);
}