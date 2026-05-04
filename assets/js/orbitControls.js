import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let camera, controls, scene, renderer;
const objects = [];
const objectBoxes = []; 

// Variables para evitar que la cámara atraviese las figuras
let prevCamPos = new THREE.Vector3();
let prevTarget = new THREE.Vector3();

init();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.0005); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    
    document.getElementById('container-orbit').appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(400, 200, 0);

    // -- CONTROLES ORBITALES --
    controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window); 

    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;

    controls.minDistance = 50;
    controls.maxDistance = 3000; 
    controls.cursorStyle = "grab";
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    // -- SUELO VISIBLE --
    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // -- CATÁLOGO DE GEOMETRÍAS VARIADAS --
    // A todas se les aplica un translate en "Y" equivalente a la mitad de su altura o radio
    // para que su punto de anclaje (pivote) quede exactamente en la base.
    const geometriesList = [
        new THREE.BoxGeometry(30, 40, 30).translate(0, 20, 0),               // Cubo / Rectángulo
        new THREE.CylinderGeometry(15, 15, 40, 16).translate(0, 20, 0),      // Cilindro
        new THREE.SphereGeometry(20, 16, 16).translate(0, 20, 0),            // Esfera
        new THREE.ConeGeometry(20, 40, 4, 1).translate(0, 20, 0),            // Pirámide 4 lados
        new THREE.ConeGeometry(20, 40, 8, 1).translate(0, 20, 0),            // Pirámide 8 lados
        new THREE.DodecahedronGeometry(20).translate(0, 20, 0),              // Dodecaedro
        new THREE.TorusGeometry(15, 5, 10, 24).translate(0, 20, 0)           // Dona (Torus)
    ];

    // -- GENERACIÓN DE FIGURAS --
    for (let i = 0; i < 1500; i++) {
        // Seleccionar una geometría aleatoria del catálogo
        const randomGeoIndex = Math.floor(Math.random() * geometriesList.length);
        const geometry = geometriesList[randomGeoIndex];
        
        const material = new THREE.MeshPhongMaterial({ flatShading: true });
        material.color.setHSL(Math.random(), 0.1 + Math.random() * 0.2, 0.4 + Math.random() * 0.2);

        const mesh = new THREE.Mesh(geometry, material);

        let collision = true;
        let attempts = 0;

        while (collision && attempts < 100) {
            mesh.position.x = Math.random() * 8000 - 4000;
            mesh.position.y = 0;
            mesh.position.z = Math.random() * 8000 - 4000;

            mesh.scale.x = Math.random() * 2 + 0.5;
            mesh.scale.y = Math.random() * 3 + 0.5;
            mesh.scale.z = mesh.scale.x; 

            mesh.updateMatrixWorld();
            const newBox = new THREE.Box3().setFromObject(mesh);

            collision = false;
            for (let j = 0; j < objectBoxes.length; j++) {
                if (newBox.intersectsBox(objectBoxes[j])) {
                    collision = true;
                    break;
                }
            }
            attempts++;
        }

        if (!collision) {
            scene.add(mesh);
            objects.push(mesh);
            objectBoxes.push(new THREE.Box3().setFromObject(mesh));
        }
    }

    // -- LUCES --
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(-1, -1, -1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

    window.addEventListener("resize", onWindowResize);

    prevCamPos.copy(camera.position);
    prevTarget.copy(controls.target);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    if (controls.maxPolarAngle > Math.PI / 2 - 0.05) {
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
    }

    controls.update();

    let collision = false;
    const camBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(15, 15, 15));

    for (let i = 0; i < objectBoxes.length; i++) {
        if (objectBoxes[i].intersectsBox(camBox)) {
            collision = true;
            break;
        }
    }

    if (collision) {
        camera.position.copy(prevCamPos);
        controls.target.copy(prevTarget);
        controls.update();
    } else {
        prevCamPos.copy(camera.position);
        prevTarget.copy(controls.target);
    }

    render();
}

function render() {
    renderer.render(scene, camera);
}