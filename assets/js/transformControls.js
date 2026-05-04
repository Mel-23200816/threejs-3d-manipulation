import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; // Para reflejos realistas

let cameraPersp, cameraOrtho, currentCamera;
let scene, renderer, control, orbit;

// Variables para el sistema interactivo
let raycaster, mouse;
const objects = []; // Aquí guardaremos todo lo que se puede seleccionar

// Variables para la luz interactiva
let spotLight, lightHandle, spotLightHelper;

init();
render();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Habilitar sombras
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById('container-transform').appendChild(renderer.domElement);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 5;

    cameraPersp = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    cameraOrtho = new THREE.OrthographicCamera(-frustumSize * aspect, frustumSize * aspect, frustumSize, -frustumSize, 0.1, 100);
    currentCamera = cameraPersp;

    currentCamera.position.set(5, 4, 8);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); // Fondo oscuro para resaltar la iluminación

    // -- ENTORNO DE REFLEJOS REALISTAS (Para el oro y el cristal) --
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.GridHelper(10, 20, 0x888888, 0x444444));

    // Suelo receptor de sombras
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // -- 1. LABORATORIO DE MATERIALES FÍSICOS --

    // A. Esfera de Cristal Refractante
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.05,
        transmission: 1, // Hace que parezca cristal
        thickness: 0.5,
        ior: 1.5 // Índice de refracción
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), glassMaterial);
    sphere.position.set(-2.5, 1, 0);
    sphere.castShadow = true;
    scene.add(sphere);
    objects.push(sphere);

    // B. Toroide de Oro Metálico
    const goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 1,
        roughness: 0.15
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.3, 32, 64), goldMaterial);
    torus.position.set(2.5, 1, 0);
    torus.castShadow = true;
    scene.add(torus);
    objects.push(torus);

    // C. Cilindro de Plástico Mate
    const plasticMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        metalness: 0,
        roughness: 0.8
    });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2, 32), plasticMaterial);
    cylinder.position.set(0, 1, 0);
    cylinder.castShadow = true;
    scene.add(cylinder);
    objects.push(cylinder);

    // -- 2. MANIPULACIÓN DE LUCES EN TIEMPO REAL --
    
    // Luz ambiental base para que no sea totalmente negro
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    // Reflector principal
    spotLight = new THREE.SpotLight(0xffffff, 150);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.3;
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Objeto físico (una pequeña estructura de alambre) para poder hacerle clic y mover la luz
    lightHandle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
    );
    lightHandle.position.set(0, 5, 4);
    scene.add(lightHandle);
    objects.push(lightHandle); // Permitir que sea seleccionable

    // Ayudante visual que dibuja el cono de luz
    spotLightHelper = new THREE.SpotLightHelper(spotLight);
    scene.add(spotLightHelper);


    // -- CONTROLES --
    orbit = new OrbitControls(currentCamera, renderer.domElement);
    orbit.update();
    orbit.addEventListener('change', render);

    control = new TransformControls(currentCamera, renderer.domElement);
    control.addEventListener('change', render);
    control.addEventListener('dragging-changed', function (event) {
        orbit.enabled = !event.value; // Desactiva la órbita al usar las flechas
    });
    scene.add(control.getHelper());

    // -- 3. SISTEMA DE SELECCIÓN POR CLIC (RAYCASTER) --
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', function(event) {
        // PREVENCIÓN: Si el ratón está sobre el gizmo (las flechas), no hacemos nada
        // Esto evita que al intentar arrastrar una flecha, se deseleccione el objeto
        if (control.axis !== null) return;

        // Calcular coordenadas normalizadas del ratón
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, currentCamera);

        // Buscar colisiones solo con los objetos de nuestra lista
        const intersects = raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            // Anclar el control al objeto clickeado
            control.attach(intersects[0].object);
        } else {
            // Clic al vacío = deseleccionar
            control.detach();
        }
        render();
    });

    window.addEventListener('resize', onWindowResize);

    // EVENTOS TECLADO ORIGINALES
    window.addEventListener('keydown', function (event) {
        switch (event.key) {
            case 'q':
                control.setSpace(control.space === 'local' ? 'world' : 'local');
                break;
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
    // Si la "manija" de luz interactiva se mueve, actualizamos la posición del Spotlight real
    if (spotLight && lightHandle) {
        spotLight.position.copy(lightHandle.position);
        spotLightHelper.update();
    }
    
    renderer.render(scene, currentCamera);
}