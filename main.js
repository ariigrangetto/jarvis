import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, uniform, mod, pass, texture, float, time, vec2, vec3, vec4, sin, cos, rendererReference } from 'three/tsl';
import { afterImage } from 'three/addons/tsl/display/AfterImageNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Inspector } from 'three/addons/inspector/Inspector.js';

const audioBtn = document.getElementById("startAudio");

let audioContext, analyser, dataArray;
let initAudioBtn = false;
let camera, scene, renderer, params, particles;
let renderPipeline, controls;

const audioIntensity = uniform(0.0);

audioBtn.addEventListener("click", () => {
    initAudioBtn = !initAudioBtn;

    if (initAudioBtn == true) {
        initAudio();
        audioBtn.textContent = "Detener Audio";
    } else {
        stopAudio();
        audioBtn.textContent = "Iniciar Audio";
    }
})


init()
function init() {
    renderer = new THREE.WebGPURenderer();
    //creando gráficos más complejos
    renderer.setPixelRatio(window.devicePixelRatio);
    //ajustando la resolución según pantalla.
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);

    //Ajuste de cámara
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    //1 para evitar que el elemento se cruce en la cámara y 10000 es la distancia máxima
    camera.position.z = 2900;

    controls = new OrbitControls(camera, renderer.domElement);
    //permisos para mover la cámara
    controls.enableDamping = true;
    controls.minDistance = 100;
    controls.maxDistance = 10000;

    //creando la escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    const sprite = new THREE.TextureLoader().load("/circle.png");
    //textura que se puede utilizar en la 3D


    //geometria de la esfera
    const radius = 500;
    const count = 250000;
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
        //va desde el tono, la saturación y la luminocidad
        colors.push(color.r, color.g, color.b);

        //tiempo de cada partícula
        timeOffsets.push(i / count);
    };

    const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(vertices), 3);
    const timeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(timeOffsets), 1);
    const colorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
    //para el entendimiento de la tarjeta gráfica


    const material = new THREE.SpriteNodeMaterial({ blending: THREE.AdditiveBlending, depthWrite: false });
    material.colorNode = texture(sprite).mul(vec4(instancedBufferAttribute(colorAttribute), 2.5));
    //2.5 permite sobreiluminar las partículas
    //el blanco puro tiene un valor de 1.0
    //Al multiplicar, se multiplica el color blaco de la imagen original por el color azul

    const localTime = instancedBufferAttribute(timeAttribute).add(time.mul(0.1));
    //Esto hace que cada particula tenga un tiempo único
    const modTime = mod(localTime, 1.0);
    //modTime asegura que el tiempo siempre sea entre 0 y 1
    const accTime = modTime.mul(modTime);
    //Multiplica el tiempo por sí mismo para crear "aceleración". Empienzan de forma lenta y aumenta su velicidad al "morir"

    const pos = instancedBufferAttribute(positionAttribute);

    // La esfera "respira" con el volumen de la voz.
    // Cuando hay silencio es 1.0 (tamaño original). Sube hasta ~1.2 con ruido fuerte.
    const voiceScale = audioIntensity.mul(0.8).add(1.0);

    // Creamos "ondas" a lo largo del eje Y (vertical) que se desplazan con el tiempo.
    const scanlineWaves = sin(pos.y.mul(0.015).add(time.mul(3.0)));

    // Estas ondas solo deforman el radio ligeramente (±5%) y solo cuando hay audio.
    const audioBandEffect = scanlineWaves.mul(audioIntensity.mul(0.05));

    // Escala final radial
    const finalScale = voiceScale.add(audioBandEffect);

    // Al multiplicar "pos" por un valor escalar, las partículas SIEMPRE se mueven 
    // en una línea recta desde el centro del mundo. Esto evita que se dispersen.
    material.positionNode = pos.mul(finalScale);


    particles = new THREE.Sprite(material);
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
    let targetIntensity = 0.0;

    if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);

        //dataArray contiene los valores de las frecuencias que van desde 0 a 255
        //calculando el volumen;
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }

        let average = sum / dataArray.length;
        let normalized = average / 255.0;

        // Puerta de ruido (noise gate): ignoramos valores muy bajos de ruido de fondo
        if (normalized > 0.01) {
            targetIntensity = normalized;
        }
    }

    // Esto garantiza que si targetIntensity es 0 
    // (por dejar de hablar o apagar el mic), las partículas vuelvan suavemente a su estado base.
    audioIntensity.value += (targetIntensity - audioIntensity.value) * 0.1;

    particles.rotation.y = time * 0.0002;
    particles.rotation.z = time * 0.0001;
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

async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false
            }
        });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        //analizando las frecuencias del audio para el enviar la infomación a la GPU
        //valores más altos, dan más precision de las frecuencias pero requieren más procesamientos

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        //guardando los datos de las frecuencias;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        console.log("Audio iniciado correctamente");
    } catch (error) {
        console.error("Error al acceder al micrófono", error);
    }
}


async function stopAudio() {
    audioContext.close();
    analyser = null;
    dataArray = null;
    initAudioBtn = false;
}
