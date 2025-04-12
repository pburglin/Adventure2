import * as THREE from 'three';
import { scene, camera, renderer, triggerSceneFlicker, originalBackgroundColor } from './sceneSetup.js'; // Added originalBackgroundColor
import { player, keyboardState, lastMoveDirection, updatePlayerMovement } from './player.js';
import { itemMeshes, createItemMesh, updateItemVisibility } from './items.js';
import { throwSpear, updateSpearProjectile, checkSpearRetrieval, pickupRespawnedSpear } from './spear.js';
import { BIRD_SPAWN_CHANCE, createBirdMesh, startBirdSequence, updateBirdAnimation } from './bird.js';
import { roomNameElement, inventoryElement, gameMessageElement, updateUI } from './ui.js';
import { ground, groundMaterial, doorGroup, createDoorVisuals, updateGroundColor, doorWidth } from './room.js'; // Import room components
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Removed for player control
import { worldData, getRoomById } from './world.js'; // Import world data

// Game State
let currentRoomId = worldData.startRoomId;
let currentRoom = getRoomById(currentRoomId);
const inventory = []; // Player's inventory
const defeatedDragons = new Set(); // Keep track of defeated dragons
let isGameWon = false; // Track win state for flashing effect
let winFlashCounter = 0; // Counter for flashing timing
const WIN_FLASH_RATE = 15; // Frames per half-cycle of flash

// Spear state management
// Wrap spearState in an object to pass by reference
const spearStateRef = { state: 'respawned' }; // 'inventory', 'thrown', 'stuck', 'respawned'
let spearProjectile = {
    active: false,
    mesh: null, // Reference to the spear's THREE.Mesh
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(), // Store the initial throw direction
    originRoomId: null // Room ID where the spear was thrown
};
const SPEAR_SPEED = 0.15; // Faster than player/dragon
let spearOriginalSpawn = { roomId: 4, position: { x: -2, y: 0.25, z: 2 } }; // To store { roomId, position }
// Bird NPC State
let bird = {
    mesh: null,
    active: false, // Is the bird sequence currently running?
    state: 'inactive', // 'inactive', 'entering', 'crossing', 'exiting'
    targetObject: null, // { type: 'item'/'player', id: 'item_id'/null } The object being carried
    targetObjectId: null, // ID of the item/dragon being carried (null if player)
    targetObjectType: null, // 'item', 'dragon', 'player'
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    wingAngle: 0,
    wingDirection: 1, // 1 for up, -1 for down
    action: null // 'bring' or 'take'
};
// Bird constants (BIRD_SPEED, BIRD_WING_SPEED, BIRD_WING_MAX_ANGLE, BIRD_Y_POSITION) are defined in bird.js
// BIRD_SPAWN_CHANCE is imported from bird.js

// Scene, Camera, Renderer are now imported from sceneSetup.js

// UI Element References (roomNameElement, inventoryElement, gameMessageElement) are imported from ui.js

// Door Visualization Setup (doorGroup, doorWidth, etc.) is now in room.js

// Lighting is handled in sceneSetup.js

// Player mesh is now created in player.js

// Ground Plane (ground, groundMaterial) is now created in room.js
// Set initial ground color
updateGroundColor(currentRoom.color);

// Item setup (itemMeshes) is now in items.js

// createItemMesh function is now in items.js

// Create meshes for all items defined in worldData, passing spearProjectile reference
worldData.items.forEach(item => createItemMesh(item, spearProjectile));

// createBirdMesh function is imported from bird.js
createBirdMesh(bird); // Call imported function, passing the bird state object

// updateItemVisibility function is now in items.js
// Set initial item visibility using the imported function
updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);

// updateUI function is imported from ui.js and called with (currentRoom, inventory)
// Initial UI Update
updateUI(currentRoom, inventory);

// createDoorVisuals function is imported from room.js
// Initial door creation
createDoorVisuals(currentRoom); // Call imported function

// Player movement setup (keyboardState, playerSpeed, lastMoveDirection) is now in player.js
const dragonSpeed = 0.02; // Default speed for dragons
const redDragonSpeed = 0.035; // Faster speed for Rhindle

// Key listeners
window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true; // Still update general keyboard state

    // --- Spear Throw Logic ---
    if (event.code === 'Space' && inventory.includes('spear') && spearStateRef.state === 'inventory') {
        // Check if any movement key is currently pressed
        const isMoving = keyboardState['KeyW'] || keyboardState['ArrowUp'] ||
                         keyboardState['KeyS'] || keyboardState['ArrowDown'] ||
                         keyboardState['KeyA'] || keyboardState['ArrowLeft'] ||
                         keyboardState['KeyD'] || keyboardState['ArrowRight'];

        if (isMoving && lastMoveDirection.lengthSq() > 0) { // Check lastMoveDirection
            console.log("Attempting to throw spear!");
            // Call imported function, passing necessary state and the state reference object
            // Pass the imported updateUI function
            throwSpear(lastMoveDirection, spearProjectile, spearStateRef, inventory, () => updateUI(currentRoom, inventory), player, currentRoomId);
        }
    }
    // --- End Spear Throw Logic ---
});

window.addEventListener('keyup', (event) => { // Keep keyup listener for general state
    keyboardState[event.code] = false;
});

// throwSpear function is now imported from spear.js
// Window resize is handled in sceneSetup.js
// triggerSceneFlicker is imported from sceneSetup.js

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // --- Player Movement ---
    updatePlayerMovement(); // Call the function from player.js
    // --- End Player Movement ---

    // --- Spear Projectile Logic ---
    // Call imported function, passing necessary state
    updateSpearProjectile(spearProjectile, spearStateRef, currentRoomId, defeatedDragons, updateItemVisibility, worldData, inventory, spearOriginalSpawn);
    // --- End Spear Projectile Logic ---

    // --- Player-Spear Retrieval Logic ---
    // Call imported function, passing necessary state
    // Need to pass player's current room ID for updateItemVisibility call inside checkSpearRetrieval
    player.userData.currentRoomId = currentRoomId; // Temporarily store current room ID on player object
    // Pass the imported updateUI function
    checkSpearRetrieval(spearStateRef, spearProjectile, player, inventory, () => updateUI(currentRoom, inventory), updateItemVisibility, worldData, defeatedDragons, spearOriginalSpawn);
    // --- End Player-Spear Retrieval Logic ---

    // --- Bird NPC Logic ---
    // Call imported function, passing necessary state
    updateBirdAnimation(bird, worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);
    // --- End Bird NPC Logic ---

    // Dragon movement logic (only move if not defeated)
    const roomSize = 10;
    const halfRoomSize = roomSize / 2;
    itemMeshes.forEach((itemMesh, itemId) => {
        if (itemMesh.visible && itemMesh.userData.isDragon && !defeatedDragons.has(itemId)) { // Check defeatedDragons
            const dragon = itemMesh;
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, dragon.position).normalize();

            // Determine speed based on dragon ID
            const currentDragonSpeed = (itemId === 'dragon_rhindle') ? redDragonSpeed : dragonSpeed;

            dragon.position.x += direction.x * currentDragonSpeed;
            dragon.position.z += direction.z * currentDragonSpeed;

            const angle = Math.atan2(direction.x, direction.z);
            dragon.rotation.y = angle;

            const dragonBoundaryOffsetWidth = 0.6 / 2;
            const dragonBoundaryOffsetDepth = 0.6 / 2;
            dragon.position.x = Math.max(-halfRoomSize + dragonBoundaryOffsetWidth, Math.min(halfRoomSize - dragonBoundaryOffsetWidth, dragon.position.x));
            dragon.position.z = Math.max(-halfRoomSize + dragonBoundaryOffsetDepth, Math.min(halfRoomSize - dragonBoundaryOffsetDepth, dragon.position.z));
            dragon.position.y = 0.4;
        }
    });

    // --- Room Transition Logic ---
    let transitioned = false; // Flag to check if transition happened
    let playerMovedToNewRoom = false; // Flag to check if transition happened
    // ... (boundary checks N, S, E, W - check for locked doors etc.) ...
    // Check North boundary
    if (player.position.z < -halfRoomSize) { // Check X position for door width
            if (Math.abs(player.position.x) < doorWidth / 2) { // Use imported doorWidth
            const connection = currentRoom.connections.north;
            if (connection !== null) {
                let canPass = true;
                let targetRoomId = null;

                if (typeof connection === 'object' && connection.lockedBy) {
                    if (!inventory.includes(connection.lockedBy)) {
                        canPass = false;
                        console.log("Locked! Requires:", connection.lockedBy);
                    } else {
                        targetRoomId = connection.roomId;
                    }
                } else {
                    targetRoomId = connection;
                }

                if (canPass && targetRoomId !== null) {
                    currentRoomId = targetRoomId;
                    player.position.z = halfRoomSize - 0.1;
                    transitioned = true;
                    playerMovedToNewRoom = true; // Set the flag here!
                } else {
                    player.position.z = -halfRoomSize;
                }
            } else {
                player.position.z = -halfRoomSize;
            }
        } else {
            player.position.z = -halfRoomSize;
        }
    }
    // Check South boundary
    else if (player.position.z > halfRoomSize) { // Check X position for door width
        if (Math.abs(player.position.x) < doorWidth / 2) { // Use imported doorWidth
            const connection = currentRoom.connections.south; // Need to handle potential locked doors here too if applicable
            if (connection !== null) {
                // Assuming south is never locked for now based on world.js
                currentRoomId = connection;
                player.position.z = -halfRoomSize + 0.1;
                transitioned = true;
                playerMovedToNewRoom = true; // Set the flag here!
            } else {
                player.position.z = halfRoomSize;
            }
        } else {
            player.position.z = halfRoomSize;
        }
    }
    // Check West boundary
    else if (player.position.x < -halfRoomSize) { // Check Z position for door width
        if (Math.abs(player.position.z) < doorWidth / 2) { // Use imported doorWidth
            const connection = currentRoom.connections.west; // Need to handle potential locked doors here too if applicable
            if (connection !== null) {
                // Assuming west is never locked for now
                currentRoomId = connection;
                player.position.x = halfRoomSize - 0.1;
                transitioned = true;
                playerMovedToNewRoom = true; // Set the flag here!
            } else {
                player.position.x = -halfRoomSize;
            }
        } else {
            player.position.x = -halfRoomSize;
        }
    }
    // Check East boundary
    else if (player.position.x > halfRoomSize) { // Check Z position for door width
        if (Math.abs(player.position.z) < doorWidth / 2) { // Use imported doorWidth
            const connection = currentRoom.connections.east; // Need to handle potential locked doors here too if applicable
            if (connection !== null) {
                // Assuming east is never locked for now
                currentRoomId = connection;
                player.position.x = -halfRoomSize + 0.1;
                transitioned = true;
                playerMovedToNewRoom = true; // Set the flag here!
            } else {
                player.position.x = halfRoomSize;
            }
        } else {
            player.position.x = halfRoomSize;
        }
    }

    if (playerMovedToNewRoom) { // Use the renamed flag
        // ... (clear doors, update room, ground color) ...
        // doorGroup is imported from room.js
        while (doorGroup.children.length > 0) {
            doorGroup.remove(doorGroup.children[0]);
        }
        currentRoom = getRoomById(currentRoomId);
        updateGroundColor(currentRoom.color); // Use imported function
        //console.log(`[Transition] Set ground color to: ${currentRoom.color.toString(16)}`);
        updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // CRUCIAL: Update visibility after room change
        createDoorVisuals(currentRoom); // Call imported function
        console.log(`[Transition] Entered room: ${currentRoom.name} (ID: ${currentRoomId})`);
        updateUI(currentRoom, inventory); // Call imported UI update

        // --- Bird Trigger Logic ---
        // Only trigger if player moved rooms AND bird is not already active
        if (!bird.active && Math.random() < BIRD_SPAWN_CHANCE) {
            console.log("Bird sequence triggered!");
            // Call imported function, passing necessary state
            startBirdSequence(bird, worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);
        }
        // --- End Bird Trigger Logic ---

        // ... (win condition check) ...
        if (!isGameWon && currentRoom.winConditionItem && inventory.includes(currentRoom.winConditionItem)) { // Check !isGameWon to set it only once
             console.log("YOU WIN! You brought the Chalice back to the Gold Castle!");
             isGameWon = true; // Set win state
             gameMessageElement.textContent = "YOU WIN! You brought the Chalice back to the Gold Castle!"; // Display win message
             // Player input will effectively stop as movement/actions aren't processed after win flash starts
             // No alert, no return, let the animation loop continue for flashing
         }
    }

    // Collision detection for items (pickup) and dragons (player death)
    const pickupDistance = 0.5;
    const dragonCollisionDistance = 0.57; // Adjusted for slimmer dragon shape (belly is 0.6 wide/deep)

    // --- Player-Item/Dragon Collision Logic ---
    itemMeshes.forEach((itemMesh, itemId) => {
        if (!itemMesh.visible) return; // Skip invisible items/dragons

        const itemData = worldData.items.find(item => item.id === itemId);
        if (!itemData) return;

        const distance = player.position.distanceTo(itemMesh.position);

        if (itemMesh.userData.isDragon && !defeatedDragons.has(itemId)) { // Check if dragon and not defeated
            // Player-Dragon collision (death condition)
            if (distance < dragonCollisionDistance) {
                // Player is eaten (Spear doesn't protect from direct contact)
                triggerSceneFlicker(0xff0000, 300);
                console.log(`You were eaten by ${itemData.name}! GAME OVER`);
                alert(`You were eaten by ${itemData.name}! GAME OVER`);
                // Reset game state
                player.position.set(0, 0.25, 0);
                inventory.length = 0; // Clear inventory
                defeatedDragons.clear(); // Reset defeated dragons on death
                isGameWon = false; // Reset win state on death
                // Reset spear state if it was thrown/stuck using the reference object
                if (spearStateRef.state !== 'inventory') {
                    spearStateRef.state = 'respawned'; // Mark for respawn
                    spearProjectile.active = false;
                    if (spearProjectile.mesh) spearProjectile.mesh.visible = false;
                    // Visibility update below will handle hiding/showing based on new state
                    console.log("Spear marked for respawn due to player death.");
                }
                currentRoomId = worldData.startRoomId;
                currentRoom = getRoomById(currentRoomId);
                updateGroundColor(currentRoom.color); // Use imported function
                updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Update visibility for start room (respawns items/dragons)
                updateUI(currentRoom, inventory); // Call imported UI update
                gameMessageElement.textContent = ""; // Clear message on death/reset
                createDoorVisuals(currentRoom); // Call imported function
                return; // Stop processing this frame
            }
        } else if (!itemMesh.userData.isDragon && !inventory.includes(itemId) && !(bird.active && bird.targetObjectId === itemId)) {
            // Item pickup collision (exclude dragons, items in inventory, items carried by bird)
            if (distance < pickupDistance) {
                // Try picking up respawned spear first
                // Pass the imported updateUI function correctly to pickupRespawnedSpear
                const wasSpearPickup = pickupRespawnedSpear(itemId, itemMesh, spearStateRef, inventory, () => updateUI(currentRoom, inventory), updateItemVisibility, worldData, currentRoomId, defeatedDragons, spearOriginalSpawn);

                // If it wasn't the spear, handle regular item pickup
                if (!wasSpearPickup && itemId !== 'spear') {
                    inventory.push(itemId); // Add item to inventory
                    const pickedUpItemData = worldData.items.find(item => item.id === itemId);
                    if (pickedUpItemData) {
                        pickedUpItemData.currentRoomId = null; // Indicate it's in inventory
                    }
                    triggerSceneFlicker(0x888888);
                    itemMesh.visible = false; // Hide mesh
                    console.log(`Picked up: ${itemData.name}`);
                    console.log("Inventory:", inventory);
                    updateUI(currentRoom, inventory); // Call imported UI update
                    // Visibility update is handled inside pickupRespawnedSpear or below
                    updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Update visibility state immediately for non-spear items
                }
            }
        }
    });

    // --- Win Flashing Logic ---
    if (isGameWon) {
        winFlashCounter++;
        // Alternate between gold and original background color
        if (winFlashCounter % (WIN_FLASH_RATE * 2) < WIN_FLASH_RATE) {
            scene.background.setHex(0xFFD700); // Gold color
        } else {
            scene.background.setHex(originalBackgroundColor);
        }
    } else {
         // Ensure background is the original color if not won AND no flicker is active
         if (!scene.background.equals(new THREE.Color(originalBackgroundColor))) { // Removed check for flickerTimeoutId
              scene.background.setHex(originalBackgroundColor);
         }
    }
    // --- End Win Flashing Logic ---

    renderer.render(scene, camera);
  updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);
} // Correct closing brace for animate() function

// startBirdSequence function is imported from bird.js

// Initial setup calls
updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);
updateUI(currentRoom, inventory); // Call imported UI update
createDoorVisuals(currentRoom); // Call imported function
animate(); // Start the loop