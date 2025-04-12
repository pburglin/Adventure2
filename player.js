import * as THREE from 'three';
import { scene } from './sceneSetup.js'; // Need scene to add the player mesh

// Player Mesh
const playerGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow color
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 0.25; // Place it slightly above the ground
scene.add(player);
player.isAlive = true; // Track alive state
player.isMoving = false; // Add movement state tracking

// Player Movement Setup
const keyboardState = {};
const playerSpeed = 0.05;
let lastMoveDirection = new THREE.Vector3(0, 0, 0); // Track last movement direction

// Keydown listener moved back to main.js to handle spear throwing logic

window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

// Function to update player movement based on keyboard state
function updatePlayerMovement() {
    if (!player.isAlive) return; // Stop movement if dead
    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (player.isAlive && (keyboardState['KeyW'] || keyboardState['ArrowUp'])) {
        moveDirection.z = -1;
    }
    if (keyboardState['KeyS'] || keyboardState['ArrowDown']) {
        moveDirection.z = 1;
    }
    if (keyboardState['KeyA'] || keyboardState['ArrowLeft']) {
        moveDirection.x = -1;
    }
    if (keyboardState['KeyD'] || keyboardState['ArrowRight']) {
        moveDirection.x = 1;
    }

    // Normalize diagonal movement and update player position
    if (moveDirection.lengthSq() > 0) { // Only normalize and move if there's input
        moveDirection.normalize();
        player.position.x += moveDirection.x * playerSpeed;
        player.position.z += moveDirection.z * playerSpeed;
        lastMoveDirection.copy(moveDirection); // Store the latest valid movement direction
    }
}

export { player, keyboardState, playerSpeed, lastMoveDirection, updatePlayerMovement };