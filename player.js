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

// Key listeners are now centralized in main.js

// Calculate proposed movement without applying it
function getProposedPosition() {
    const moveDirection = new THREE.Vector3(
        (keyboardState['KeyD'] || keyboardState['ArrowRight']) ? 1 :
        (keyboardState['KeyA'] || keyboardState['ArrowLeft']) ? -1 : 0,
        0,
        (keyboardState['KeyS'] || keyboardState['ArrowDown']) ? 1 :
        (keyboardState['KeyW'] || keyboardState['ArrowUp']) ? -1 : 0
    );

    const proposedPosition = player.position.clone();
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
        proposedPosition.addScaledVector(moveDirection, playerSpeed);
        lastMoveDirection.copy(moveDirection);
    }
    return proposedPosition;
}

export { player, keyboardState, playerSpeed, lastMoveDirection, getProposedPosition };