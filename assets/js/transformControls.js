import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cameraPersp, cameraOrtho, currentCamera;
let scene, renderer, control, orbit;

// Variables para el sistema interactivo
let raycaster, mouse;
const objects = []; 

// Variables para la luz interactiva
let spotLight, lightHandle, spotLightHelper;

init();
render();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById('container-transform').appendChild(renderer.domElement);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 5;

    cameraPersp = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    cameraOrtho = new THREE.OrthographicCamera(-frustumSize * aspect, frustumSize * aspect, frustumSize, -frustumSize, 0.1, 100);
    currentCamera = cameraPersp;

    currentCamera.position.set(5, 4, 8);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); 

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.GridHelper(10, 20, 0x888888, 0x444444));

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // -- 1. LABORATORIO DE MATERIALES FÍSICOS --
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.5, ior: 1.5
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), glassMaterial);
    sphere.position.set(-2.5, 1, 0);
    sphere.castShadow = true;
    scene.add(sphere);
    objects.push(sphere);

    const goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700, metalness: 1, roughness: 0.15
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.3, 32, 64), goldMaterial);
    torus.position.set(2.5, 1, 0);
    torus.castShadow = true;
    scene.add(torus);
    objects.push(torus);

    const plasticMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3366, metalness: 0, roughness: 0.8
    });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2, 32), plasticMaterial);
    cylinder.position.set(0, 1, 0);
    cylinder.castShadow = true;
    scene.add(cylinder);
    objects.push(cylinder);

    // -- 2. MANIPULACIÓN DE LUCES EN TIEMPO REAL --
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    spotLight = new THREE.SpotLight(0xffffff, 150);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.3;
    spotLight.castShadow = true;
    scene.add(spotLight);

    lightHandle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
    );
    lightHandle.position.set(0, 5, 4);
    scene.add(lightHandle);
    objects.push(lightHandle); 

    spotLightHelper = new THREE.SpotLightHelper(spotLight);
    scene.add(spotLightHelper);


    // -- 3. CONTROLES Y COLISIONES AABB --
    orbit = new OrbitControls(currentCamera, renderer.domElement);
    orbit.update();
    orbit.addEventListener('change', render);

    control = new TransformControls(currentCamera, renderer.domElement);
    control.addEventListener('change', render);
    
    // Al empezar a arrastrar, bloqueamos la cámara y guardamos los estados seguros
    control.addEventListener('dragging-changed', function (event) {
        orbit.enabled = !event.value;
        if (event.value && control.object) {
            control.object.userData.prevPosition = control.object.position.clone();
            control.object.userData.prevScale = control.object.scale.clone();
            control.object.userData.prevRotation = control.object.rotation.clone();
        }
    });

    // Detectar colisiones mientras se manipula el objeto
    control.addEventListener('objectChange', function () {
        const obj = control.object;
        if (!obj) return;

        obj.updateMatrixWorld();
        const draggedBox = new THREE.Box3().setFromObject(obj);
        let collision = false;

        // Comparamos el objeto actual contra el resto de figuras
        for (let i = 0; i < objects.length; i++) {
            if (objects[i] !== obj) {
                const otherBox = new THREE.Box3().setFromObject(objects[i]);
                if (draggedBox.intersectsBox(otherBox)) {
                    collision = true;
                    break;
                }
            }
        }

        // También evitamos que crucen el suelo hacia abajo
        if (draggedBox.min.y < 0) {
            collision = true;
        }

        if (collision) {
            // Si choca, revertimos a la última posición/tamaño seguro según la herramienta usada
            if (control.mode === 'translate' && obj.userData.prevPosition) {
                obj.position.copy(obj.userData.prevPosition);
            } else if (control.mode === 'scale' && obj.userData.prevScale) {
                obj.scale.copy(obj.userData.prevScale);
            } else if (control.mode === 'rotate' && obj.userData.prevRotation) {
                obj.rotation.copy(obj.userData.prevRotation);
            }
        } else {
            // Si está libre, actualizamos la memoria de posición segura
            if(!obj.userData.prevPosition) obj.userData.prevPosition = obj.position.clone();
            else obj.userData.prevPosition.copy(obj.position);
            
            if(!obj.userData.prevScale) obj.userData.prevScale = obj.scale.clone();
            else obj.userData.prevScale.copy(obj.scale);
            
            if(!obj.userData.prevRotation) obj.userData.prevRotation = obj.rotation.clone();
            else obj.userData.prevRotation.copy(obj.rotation);
        }
    });

    scene.add(control.getHelper());

    // -- SISTEMA DE SELECCIÓN POR CLIC (RAYCASTER) --
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', function(event) {
        if (control.axis !== null) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, currentCamera);
        const intersects = raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            control.attach(intersects[0].object);
        } else {
            control.detach();
        }
        render();
    });

    window.addEventListener('resize', onWindowResize);

    window.addEventListener('keydown', function (event) {
        switch (event.key) {
            case 'q': control.setSpace(control.space === 'local' ? 'world' : 'local'); break;
            case 'Shift':
                control.setTranslationSnap(1);
                control.setRotationSnap(THREE.MathUtils.degToRad(15));
                control.setScaleSnap(0.25);
                break;
            case 'w': control.setMode('translate'); break;
            case 'e': control.setMode('rotate'); break;
            case 'r': control.setMode('scale'); break;
            case 'c':
                const position = currentCamera.position.clone();
                currentCamera = currentCamera.isPerspectiveCamera ? cameraOrtho : cameraPersp;
                currentCamera.position.copy(position);
                orbit.object = currentCamera;
                control.camera = currentCamera;
                currentCamera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);
                onWindowResize();
                break;
            case 'v':
                const randomFoV = Math.random() + 0.1;
                const randomZoom = Math.random() + 0.1;
                cameraPersp.fov = randomFoV * 160;
                cameraOrtho.bottom = -randomFoV * 500;
                cameraOrtho.top = randomFoV * 500;
                cameraPersp.zoom = randomZoom * 5;
                cameraOrtho.zoom = randomZoom * 5;
                onWindowResize();
                break;
            case '+': case '=': control.setSize(control.size + 0.1); break;
            case '-': case '_': control.setSize(Math.max(control.size - 0.1, 0.1)); break;
            case 'x': control.showX = !control.showX; break;
            case 'y': control.showY = !control.showY; break;
            case 'z': control.showZ = !control.showZ; break;
            case ' ': control.enabled = !control.enabled; break;
            case 'Escape': control.reset(); break;
        }
    });

    window.addEventListener('keyup', function (event) {
        if (event.key === 'Shift') {
            control.setTranslationSnap(null);
            control.setRotationSnap(null);
            control.setScaleSnap(null);
        }
    });
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    cameraPersp.aspect = aspect;
    cameraPersp.updateProjectionMatrix();
    cameraOrtho.left = cameraOrtho.bottom * aspect;
    cameraOrtho.right = cameraOrtho.top * aspect;
    cameraOrtho.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function render() {
    if (spotLight && lightHandle) {
        spotLight.position.copy(lightHandle.position);
        spotLightHelper.update();
    }
    
    renderer.render(scene, currentCamera);
}