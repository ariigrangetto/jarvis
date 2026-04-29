import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, uniform, mod, pass, texture, float, time, vec2, vec3, vec4, sin, cos, rendererReference } from 'three/tsl';
import { afterImage } from 'three/addons/tsl/display/AfterImageNode.js';

import { Inspector } from 'three/addons/inspector/Inspector.js';

console.log(THREE);

let camera, scene, renderer, params, particles;
let renderPipeline, controls;
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

init()
function init() {
    renderer = new THREE.WebGPURenderer();
    //creando gráficos más complejos
    renderer.setPixelRatio(window.devicePixelRatio);
    //ajustando la resolución según pantalla.
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate); //function
    renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);
    //importante para agregar toda la configuracion a la pantalla
    //Ajuste de cámara
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    //1 para evitar que el elemento se cruce en la cámara y 10000 es la distancia máxima
    camera.position.z = 2300;

    controls = new OrbitControls(camera, renderer.domElement);

    //creando la escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    const sprite = new THREE.TextureLoader().load("texture/sprites/circle.png");
    //textura que se puede utilizar en la 3D


    //geometria de la esfera
    const radius = 400;
    const size = 30;
    const count = 100000;
    //cantidad de partículas

    const color = new THREE.Color();
    const vertex = new THREE.Vector3();
    const vertices = [];
    const colors = [];
    const timeOffsets = [];

    for (let i = 0; i < count; i++) {
        getRandomPointOnSphere(radius, vertex);
        //calculo de posicionamiento de partículas
        vertices.push(vertex.x, vertex.y, vertex.z);

        //colores de partículas
        const hue = 0.5 + Math.random() * 0.1
        const lightness = 0.5 + Math.random() * 0.3;
        color.setHSL(hue, 1.0, lightness);
        //va desde el tono (hue), la saturacion y la luminocidad
        //colors tiene la propiedad tando r, g y b
        colors.push(color.r, color.g, color.b);
        timeOffsets.push(i / count);
    };

    const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(vertices), 3);
    const timeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(timeOffsets), 1);
    const colorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
    //para el entendimiento de la tarjeta gráfica


    const material = new THREE.SpriteNodeMaterial({ blending: THREE.AdditiveBlending, depthWrite: false });
    material.colorNode = texture(sprite).mul(vec4(instancedBufferAttribute(colorAttribute), 2.5));
    console.log(material)


    const localTime = instancedBufferAttribute(timeAttribute).add(time.mul(0.1));
    //Esto hace que cada particula tenga un tiempo único
    const modTime = mod(localTime, 1.0);
    //modTime asegura que el tiempo siempre sea entre 0 y 1
    const accTime = modTime.mul(modTime);
    //Multiplica el tiempo por sí mismo para crear "aceleración". Empienzan de forma lenta y aumenta su velicidad al "morir"

    const angle = accTime.mul(1.0);
    //velocidad del movimiento de las partículas
    const pulse = vec2(sin(angle).mul(20.0), cos(angle).mul(10.0));
    //amplitud del movimiento de las partículas
    const pos = instancedBufferAttribute(positionAttribute);

    // Animamos la posición 
    material.positionNode = pos.add(vec3(pulse, 1.0));


    particles = new THREE.Sprite(material);
    console.log(particles)
    particles.count = count;
    particles.scale.set(2.5, 2.5, 2.5)
    scene.add(particles);

    // Configuramos el Post-Processing con AfterImage para dar el efecto de rastro/brillo
    renderPipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const afterImageNode = afterImage(scenePass, 0.40); //controlando cuanto dura el rastro
    renderPipeline.outputNode = afterImageNode;

    window.addEventListener("resize", onWindowResize);
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    particles.rotation.y = time * 0.0003;
    particles.rotation.z = time * 0.0002;
    renderPipeline.render();
}

function getRandomPointOnSphere(r, v) {
    const angle = Math.random() * Math.PI * 2;
    //Representa el giro horizontal
    const u = Math.random() * 10 - 1;
    //Representa qué tan arriba o abajo estará la esfera

    v.set(
        Math.cos(angle) * Math.sqrt(1 - Math.pow(u, 2)) * r,
        Math.sin(angle) * Math.sqrt(1 - Math.pow(u, 2)) * r,
        u * r,
    )

    return v;
}

