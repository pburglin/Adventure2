import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const originalBackgroundColor = 0x222222; // Store original color
scene.background = new THREE.Color(originalBackgroundColor); // Dark gray background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
camera.position.y = 2;

// Renderer setup
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Helper function to trigger scene background flicker
let flickerTimeoutId = null; // To store the timeout ID
function triggerSceneFlicker(flickerColorHex = 0x888888, duration = 200) {
    if (flickerTimeoutId) {
        clearTimeout(flickerTimeoutId); // Clear any existing flicker timeout
    }
    scene.background.setHex(flickerColorHex); // Set to flicker color
    flickerTimeoutId = setTimeout(() => {
        scene.background.setHex(originalBackgroundColor); // Reset to original color
        flickerTimeoutId = null;
    }, duration);
}


export { scene, camera, renderer, originalBackgroundColor, triggerSceneFlicker };