import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { MapControls } from "three/addons/controls/MapControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";

let camera, controls, scene, renderer, dragControls;
const objects = []; 

// Variables para el sistema de colisión de la cámara
let prevCamPos = new THREE.Vector3();
let prevTarget = new THREE.Vector3();

// Variables para las teclas de modificación
let isModifyingHeight = false;
let isModifyingWidth = false;

init();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.0005);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    
    document.getElementById('container-map').appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 400, -400);

    // -- CONTROLES DEL MAPA --
    controls = new MapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = 3000;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    // -- SUELO VISIBLE --
    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // -- GENERACIÓN DE FIGURAS INDEPENDIENTES --
    const geometry = new THREE.BoxGeometry();
    geometry.translate(0, 0.5, 0); // Pivote en la base para que crezcan hacia arriba

    for (let i = 0; i < 800; i++) {
        const material = new THREE.MeshPhongMaterial({ flatShading: true });
        material.color.setHSL(Math.random(), 0.1 + Math.random() * 0.2, 0.4 + Math.random() * 0.2);

        const mesh = new THREE.Mesh(geometry, material);
        
        let collision = true;
        let attempts = 0; // Evitamos un bucle infinito si el mapa se llena
        
        // Repetir hasta encontrar un espacio libre (o intentar 100 veces máximo por figura)
        while (collision && attempts < 100) {
            mesh.position.x = Math.random() * 8000 - 4000;
            mesh.position.y = 0;
            mesh.position.z = Math.random() * 8000 - 4000;
            
            mesh.scale.x = Math.random() * 60 + 20;
            mesh.scale.y = Math.random() * 200 + 20;
            mesh.scale.z = Math.random() * 60 + 20;

            mesh.updateMatrixWorld();
            const newBox = new THREE.Box3().setFromObject(mesh);
            
            collision = false;
            // Verificar contra todas las figuras ya aprobadas y guardadas
            for (let j = 0; j < objects.length; j++) {
                const existingBox = new THREE.Box3().setFromObject(objects[j]);
                if (newBox.intersectsBox(existingBox)) {
                    collision = true;
                    break; // Chocó, salir de este for y volver a intentar en el while
                }
            }
            attempts++;
        }

        // Si encontró un lugar sin colisiones, lo agregamos oficialmente
        if (!collision) {
            scene.add(mesh);
            objects.push(mesh); 
        }
    }

    // -- EVENTOS DE TECLADO PARA MODO ESCALA --
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'h') isModifyingHeight = true;
        if (e.key.toLowerCase() === 'w') isModifyingWidth = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 'h') isModifyingHeight = false;
        if (e.key.toLowerCase() === 'w') isModifyingWidth = false;
    });

    // -- SISTEMA DRAG & DROP Y ESCALADO --
    dragControls = new DragControls(objects, camera, renderer.domElement);
    
    let rawDragPos = new THREE.Vector3();
    let prevRawDragPos = new THREE.Vector3();
    let realPosition = new THREE.Vector3();

    dragControls.addEventListener('dragstart', function (event) {
        controls.enabled = false; 
        event.object.material.emissive.set(0x333333); 
        
        // Capturamos las posiciones iniciales
        rawDragPos.copy(event.object.position);
        prevRawDragPos.copy(event.object.position);
        realPosition.copy(event.object.position);
    });

    dragControls.addEventListener('drag', function (event) {
        // DragControls intentará mover el objeto por defecto. Capturamos ese intento.
        rawDragPos.copy(event.object.position);
        
        // Calculamos cuánto se movió el ratón en este frame
        const deltaX = rawDragPos.x - prevRawDragPos.x;
        const deltaZ = rawDragPos.z - prevRawDragPos.z;

        if (isModifyingHeight) {
            // -- MODO CAMBIAR ALTURA --
            // Signos invertidos para que al arrastrar hacia arriba crezca, y hacia abajo se encoja
            const scaleChange = (deltaZ - deltaX) * 0.5; 
            event.object.scale.y = Math.max(5, event.object.scale.y + scaleChange);
            event.object.position.copy(realPosition); // Anclamos la figura para que no se mueva

        } else if (isModifyingWidth) {
            // -- MODO CAMBIAR ANCHO --
            const scaleChange = (Math.abs(deltaX) > Math.abs(deltaZ) ? deltaX : -deltaZ) * 0.3;
            
            // Guardamos la escala previa por si al crecer choca con algo
            const prevScaleX = event.object.scale.x;
            const prevScaleZ = event.object.scale.z;
            
            event.object.scale.x = Math.max(5, event.object.scale.x + scaleChange);
            event.object.scale.z = Math.max(5, event.object.scale.z + scaleChange);
            event.object.position.copy(realPosition); // Anclamos la figura

            // Colisión al escalar a lo ancho
            event.object.updateMatrixWorld();
            const scaledBox = new THREE.Box3().setFromObject(event.object);
            let collision = false;

            for (let i = 0; i < objects.length; i++) {
                if (objects[i] !== event.object) {
                    const otherBox = new THREE.Box3().setFromObject(objects[i]);
                    if (scaledBox.intersectsBox(otherBox)) {
                        collision = true;
                        break;
                    }
                }
            }

            if (collision) {
                // Si choca, revertimos el crecimiento de este frame
                event.object.scale.x = prevScaleX;
                event.object.scale.z = prevScaleZ;
            }

        } else {
            // -- MODO MOVER FIGURA NORMAL --
            event.object.position.y = 0; 
            event.object.updateMatrixWorld();
            const draggedBox = new THREE.Box3().setFromObject(event.object);
            let collision = false;

            for (let i = 0; i < objects.length; i++) {
                if (objects[i] !== event.object) {
                    const otherBox = new THREE.Box3().setFromObject(objects[i]);
                    if (draggedBox.intersectsBox(otherBox)) {
                        collision = true;
                        break;
                    }
                }
            }

            if (collision) {
                event.object.position.copy(realPosition); // Rebote
            } else {
                realPosition.copy(event.object.position); // Movimiento exitoso
            }
        }

        prevRawDragPos.copy(rawDragPos); // Preparamos el siguiente frame
    });

    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true; 
        event.object.material.emissive.set(0x000000); 
    });

    // -- ILUMINACIÓN --
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(-1, -1, -1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

    window.addEventListener("resize", onWindowResize);

    // -- GUI --
    const gui = new GUI({ container: document.getElementById('container-map') });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '80px'; // Ajustado por debajo de la Navbar
    gui.domElement.style.right = '10px';
    
    gui.add(controls, "zoomToCursor");
    gui.add(controls, "screenSpacePanning");
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
    const camBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(10, 10, 10));

    for (let i = 0; i < objects.length; i++) {
        const box = new THREE.Box3().setFromObject(objects[i]);
        if (box.intersectsBox(camBox)) {
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