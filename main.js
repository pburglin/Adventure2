import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Removed for player control
import { worldData, getRoomById } from './world.js'; // Import world data

// Game State
let currentRoomId = worldData.startRoomId;
let currentRoom = getRoomById(currentRoomId);
const inventory = []; // Player's inventory

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222); // Dark gray background, similar to original game

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

// Placeholder Player Cube
const playerGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5); // Original player was a square
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow color
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 0.25; // Place it slightly above the ground
scene.add(player);

// Ground Plane (representing a room)
const groundGeometry = new THREE.PlaneGeometry(10, 10); // Size of the room floor
const groundMaterial = new THREE.MeshStandardMaterial({ color: currentRoom.color, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
scene.add(ground);

// Item Setup
const itemMeshes = new Map(); // To store THREE.Mesh objects for items

function createItemMesh(itemData) {
    // Simple cylinder for the key for now
    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const material = new THREE.MeshStandardMaterial({ color: itemData.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
    mesh.userData.itemId = itemData.id; // Store item ID for later reference
    mesh.visible = false; // Initially hidden
    scene.add(mesh);
    itemMeshes.set(itemData.id, mesh);
}

// Create meshes for all items defined in worldData
worldData.items.forEach(createItemMesh);

// Function to update item visibility based on the current room
function updateItemVisibility() {
    const itemsInCurrentRoom = worldData.items.filter(item => item.initialRoomId === currentRoomId);
    const itemIdsInCurrentRoom = new Set(itemsInCurrentRoom.map(item => item.id));
    console.log(`[Visibility Check] Room: ${currentRoomId}. Items supposed to be here:`, Array.from(itemIdsInCurrentRoom)); // DEBUG

    itemMeshes.forEach((mesh, itemId) => {
        let shouldBeVisible = false;
        // Check if item is in inventory first
        if (inventory.includes(itemId)) {
            mesh.visible = false;
            shouldBeVisible = false; // Item is in inventory, hide it
        } else {
            // Otherwise, show it only if it belongs in the current room
            shouldBeVisible = itemIdsInCurrentRoom.has(itemId);
        }
        mesh.visible = shouldBeVisible;
        console.log(`[Visibility Check] Item: ${itemId}, In Inventory: ${inventory.includes(itemId)}, Belongs in Room: ${itemIdsInCurrentRoom.has(itemId)}, Final Visibility: ${shouldBeVisible}`); // DEBUG
    });
}

// Set initial item visibility
updateItemVisibility();


// Player Movement Setup
const keyboardState = {};
const playerSpeed = 0.05; // Units per frame

window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;
});

window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Player movement logic
    if (keyboardState['KeyW'] || keyboardState['ArrowUp']) {
        player.position.z -= playerSpeed;
    }
    if (keyboardState['KeyS'] || keyboardState['ArrowDown']) {
        player.position.z += playerSpeed;
    }
    if (keyboardState['KeyA'] || keyboardState['ArrowLeft']) {
        player.position.x -= playerSpeed;
    }
    if (keyboardState['KeyD'] || keyboardState['ArrowRight']) {
        player.position.x += playerSpeed;
    }

    // Room transition logic
    const roomSize = 10; // Must match groundGeometry size
    const halfRoomSize = roomSize / 2;
    let transitioned = false;

    // Check North boundary
    if (player.position.z < -halfRoomSize) {
        const connection = currentRoom.connections.north;
        if (connection !== null) {
            let canPass = true;
            let targetRoomId = null;

            if (typeof connection === 'object' && connection.lockedBy) {
                if (!inventory.includes(connection.lockedBy)) {
                    canPass = false;
                    console.log("Locked! Requires:", connection.lockedBy);
                } else {
                    targetRoomId = connection.roomId; // Use roomId from the object
                }
            } else {
                 targetRoomId = connection; // Simple connection (just room ID)
            }

            if (canPass && targetRoomId !== null) {
                currentRoomId = targetRoomId;
                player.position.z = halfRoomSize - 0.1; // Enter from South edge
                transitioned = true;
            } else {
                 player.position.z = -halfRoomSize; // Hit wall or locked door
            }
        } else {
            player.position.z = -halfRoomSize; // Hit wall (no connection)
        }
    }
    // Check South boundary
    else if (player.position.z > halfRoomSize) {
        if (currentRoom.connections.south !== null) {
            currentRoomId = currentRoom.connections.south;
            player.position.z = -halfRoomSize + 0.1; // Enter from North edge
            transitioned = true;
        } else {
            player.position.z = halfRoomSize; // Hit wall
        }
    }
    // Check West boundary
    else if (player.position.x < -halfRoomSize) {
        if (currentRoom.connections.west !== null) {
            currentRoomId = currentRoom.connections.west;
            player.position.x = halfRoomSize - 0.1; // Enter from East edge
            transitioned = true;
        } else {
            player.position.x = -halfRoomSize; // Hit wall
        }
    }
    // Check East boundary
    else if (player.position.x > halfRoomSize) {
        if (currentRoom.connections.east !== null) {
            currentRoomId = currentRoom.connections.east;
            player.position.x = -halfRoomSize + 0.1; // Enter from West edge
            transitioned = true;
        } else {
            player.position.x = halfRoomSize; // Hit wall
        }
    }

    // If transitioned, update room state
    if (transitioned) {
        currentRoom = getRoomById(currentRoomId);
        groundMaterial.color.setHex(currentRoom.color);
        console.log(`[Transition] Set ground color to: ${currentRoom.color.toString(16)}`); // DEBUG
        updateItemVisibility(); // Update which items are visible
        console.log(`[Transition] Entered room: ${currentRoom.name} (ID: ${currentRoomId})`); // Log room change

        // Check for win condition
        if (currentRoom.winConditionItem && inventory.includes(currentRoom.winConditionItem)) {
            console.log("YOU WIN! You brought the Chalice back to the Gold Castle!");
            // Stop the game loop (or display a win message)
            // For now, just log and maybe stop rendering - need a proper game state machine later
            alert("YOU WIN! You brought the Chalice back to the Gold Castle!"); // Simple alert for now
            // cancelAnimationFrame(animationFrameId); // Need to store the request ID to cancel
            return; // Stop further processing this frame
        }
    }

    // Collision detection for items
    const pickupDistance = 0.5; // How close player needs to be to pick up
    itemMeshes.forEach((itemMesh, itemId) => {
        // Check if item exists in world data and hasn't been picked up yet
        const itemData = worldData.items.find(item => item.id === itemId);
        if (itemMesh.visible && itemData && !inventory.includes(itemId)) {
            const distance = player.position.distanceTo(itemMesh.position);
            if (distance < pickupDistance) {
                // Pick up the item
                inventory.push(itemId);
                itemMesh.visible = false; // Hide the item mesh immediately
                console.log(`Picked up: ${itemData.name}`);
                console.log("Inventory:", inventory);

                // updateItemVisibility will be modified next to respect inventory
            }
        }
    });


    // Keep camera following the player (simple top-down-ish view)
    // camera.position.x = player.position.x;
    // camera.position.z = player.position.z + 5; // Offset behind the player
    // camera.lookAt(player.position); // Make camera look at the player

    renderer.render(scene, camera);
}

animate();