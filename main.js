import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Removed for player control
import { worldData, getRoomById } from './world.js'; // Import world data

// Game State
let currentRoomId = worldData.startRoomId;
let currentRoom = getRoomById(currentRoomId);
const inventory = []; // Player's inventory
const defeatedDragons = new Set(); // Keep track of defeated dragons

// Spear state management
let spearState = 'respawned'; // 'inventory', 'thrown', 'stuck', 'respawned'
let spearProjectile = {
    active: false,
    mesh: null, // Reference to the spear's THREE.Mesh
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(), // Store the initial throw direction
    originRoomId: null // Room ID where the spear was thrown
};
const SPEAR_SPEED = 0.15; // Faster than player/dragon
let spearOriginalSpawn = null; // To store { roomId, position }
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

// UI Element References
const roomNameElement = document.getElementById('room-name');
const inventoryElement = document.getElementById('inventory');

// Door Visualization Setup
const doorGroup = new THREE.Group();
scene.add(doorGroup);
const doorColor = 0x8B4513; // Brown color for doors
const doorWidth = 2; // How wide the door visual is
const doorDepth = 0.2; // How thick the door visual is
const doorHeight = 0.01; // Slightly above the ground

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
    let geometry;
    const material = new THREE.MeshStandardMaterial({ color: itemData.color });

    if (itemData.isDragon) {
        // Dragons are composite shapes
        const dragonGroup = new THREE.Group();

        // Define parts dimensions
        const bellyWidth = 0.6, bellyHeight = 0.8, bellyDepth = 0.6;
        const neckWidth = 0.3, neckHeight = 0.6, neckDepth = 0.3;
        const mouthWidth = 0.2, mouthHeight = 0.1, mouthDepth = 0.4; // Depth makes it point forward

        // Create geometries
        const bellyGeometry = new THREE.BoxGeometry(bellyWidth, bellyHeight, bellyDepth);
        const neckGeometry = new THREE.BoxGeometry(neckWidth, neckHeight, neckDepth);
        const mouthGeometry = new THREE.BoxGeometry(mouthWidth, mouthHeight, mouthDepth);

        // Create material (use item's color)
        const dragonMaterial = material; // Reuse the material created earlier

        // Create meshes
        const bellyMesh = new THREE.Mesh(bellyGeometry, dragonMaterial);
        const neckMesh = new THREE.Mesh(neckGeometry, dragonMaterial);
        const mouthMesh = new THREE.Mesh(mouthGeometry, dragonMaterial);

        // Position parts relative to the group's origin
        bellyMesh.position.y = bellyHeight / 2; // Center belly vertically at base
        neckMesh.position.y = bellyHeight + neckHeight / 2; // Place neck on top of belly
        // Position mouth centered vertically with the neck
        mouthMesh.position.y = neckMesh.position.y;
        mouthMesh.position.z = neckDepth / 2 + mouthDepth / 2; // Place mouth in front of the neck (+Z)

        // Add parts to the group
        dragonGroup.add(bellyMesh);
        dragonGroup.add(neckMesh);
        dragonGroup.add(mouthMesh);

        // Assign the group to the mesh variable (instead of a single geometry)
        // Note: We skip assigning to 'geometry' and handle the mesh creation below differently
        const mesh = dragonGroup; // Use the group directly
        mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
        mesh.userData.itemId = itemData.id;
        mesh.userData.isDragon = itemData.isDragon || false;
        mesh.visible = false; // Initially hidden
        scene.add(mesh);
        itemMeshes.set(itemData.id, mesh);
        return; // Skip default mesh creation

    } else if (itemData.id === 'spear') {
        // Spear is a tall thin box (representing the spear shaft)
        geometry = new THREE.BoxGeometry(0.1, 1.0, 0.05); // Tall thin box (default vertical)
        // Store original spawn details for the spear
        spearOriginalSpawn = {
            roomId: itemData.initialRoomId,
            position: { ...itemData.position } // Clone position
        };
    } else if (itemData.id === 'gold_key') {
        geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    } else {
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }

    // Default mesh creation for non-dragon items
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
    mesh.userData.itemId = itemData.id; // Store item ID for later reference
    mesh.userData.isDragon = itemData.isDragon || false; // Store dragon flag
    mesh.visible = false; // Initially hidden

    // If this is the spear, store its mesh reference for throwing
    if (itemData.id === 'spear') {
        spearProjectile.mesh = mesh;
        // Ensure spear starts vertically oriented if needed (though BoxGeometry default might be fine)
        // mesh.rotation.set(0, 0, 0); // Default orientation
    }

    scene.add(mesh);
    itemMeshes.set(itemData.id, mesh);
}

// Create meshes for all items defined in worldData
worldData.items.forEach(createItemMesh);

// Function to update item visibility based on the current room
function updateItemVisibility() {
    const itemsInCurrentRoomData = worldData.items.filter(item => item.initialRoomId === currentRoomId);
    const itemIdsInCurrentRoom = new Set(itemsInCurrentRoomData.map(item => item.id));
    console.log(`[Visibility Check] Room: ${currentRoomId}. Items supposed to be here:`, Array.from(itemIdsInCurrentRoom));

    itemMeshes.forEach((mesh, itemId) => {
        let shouldBeVisible = false;
        const itemData = worldData.items.find(item => item.id === itemId); // Get item data

        if (defeatedDragons.has(itemId)) {
            shouldBeVisible = false; // Dragon is defeated, hide it
        } else if (itemId === 'spear') {
            // Spear visibility logic:
            // Visible if 'stuck' OR if 'respawned' and player is in its original room AND player doesn't have it.
            // Invisible if 'inventory' or 'thrown'.
            if (spearState === 'stuck') {
                shouldBeVisible = true; // Show where it landed
            } else if (spearState === 'respawned') {
                // Check if player is in the spear's original room and doesn't have it
                shouldBeVisible = (currentRoomId === spearOriginalSpawn.roomId && !inventory.includes('spear'));
                if (shouldBeVisible) {
                    // Ensure it's at its respawn position
                    mesh.position.set(spearOriginalSpawn.position.x, spearOriginalSpawn.position.y, spearOriginalSpawn.position.z);
                    mesh.rotation.set(0, 0, 0); // Reset orientation to default vertical
                }
            } else { // 'inventory' or 'thrown'
                shouldBeVisible = false;
            }
        } else if (inventory.includes(itemId)) {
            shouldBeVisible = false; // Item is in inventory, hide it
        } else {
            // Default item visibility: show if it belongs in the current room
            shouldBeVisible = itemIdsInCurrentRoom.has(itemId);
        }

        mesh.visible = shouldBeVisible;
        // Only log for non-spear items for clarity during spear testing
        if (itemId !== 'spear') {
             console.log(`[Visibility Check] Item: ${itemId}, In Inventory: ${inventory.includes(itemId)}, Belongs in Room: ${itemIdsInCurrentRoom.has(itemId)}, Defeated: ${defeatedDragons.has(itemId)}, Final Visibility: ${shouldBeVisible}`);
        } else {
             console.log(`[Visibility Check] Spear State: ${spearState}, In Original Room: ${currentRoomId === spearOriginalSpawn.roomId}, Has Spear: ${inventory.includes('spear')}, Final Visibility: ${shouldBeVisible}`);
        }

        // Ensure dragons are positioned correctly if visible
        if (mesh.userData.isDragon && shouldBeVisible) {
             mesh.position.y = 0.4; // Reset Y position just in case
        }
    });
}

// Set initial item visibility
updateItemVisibility();

// UI Update Function
function updateUI() {
    roomNameElement.textContent = `Room: ${currentRoom.name}`;
    const inventoryText = inventory.length > 0 ? inventory.join(', ') : 'Empty';
    inventoryElement.textContent = `Inventory: ${inventoryText}`;
}

// Initial UI Update
updateUI();

// Function to create door visuals for a given room
function createDoorVisuals(room) {
   // Clear existing doors first
   while (doorGroup.children.length > 0) {
       doorGroup.remove(doorGroup.children[0]);
   }

   const roomSize = 10; // Must match groundGeometry size
   const halfRoomSize = roomSize / 2;
   const doorGeometryWidth = new THREE.PlaneGeometry(doorWidth, doorDepth);
   const doorGeometryDepth = new THREE.PlaneGeometry(doorDepth, doorWidth); // For E/W doors
   const doorMaterial = new THREE.MeshStandardMaterial({ color: doorColor, side: THREE.DoubleSide });

   // North Door
   if (room.connections.north !== null) {
       const northDoor = new THREE.Mesh(doorGeometryWidth, doorMaterial);
       northDoor.rotation.x = -Math.PI / 2; // Lay flat
       northDoor.position.set(0, doorHeight, -halfRoomSize + doorDepth / 2);
       doorGroup.add(northDoor);
   }
   // South Door
   if (room.connections.south !== null) {
       const southDoor = new THREE.Mesh(doorGeometryWidth, doorMaterial);
       southDoor.rotation.x = -Math.PI / 2; // Lay flat
       southDoor.position.set(0, doorHeight, halfRoomSize - doorDepth / 2);
       doorGroup.add(southDoor);
   }
   // East Door
   if (room.connections.east !== null) {
       const eastDoor = new THREE.Mesh(doorGeometryDepth, doorMaterial); // Use depth geometry
       eastDoor.rotation.x = -Math.PI / 2; // Lay flat
       eastDoor.position.set(halfRoomSize - doorDepth / 2, doorHeight, 0);
       doorGroup.add(eastDoor);
   }
   // West Door
   if (room.connections.west !== null) {
       const westDoor = new THREE.Mesh(doorGeometryDepth, doorMaterial); // Use depth geometry
       westDoor.rotation.x = -Math.PI / 2; // Lay flat
       westDoor.position.set(-halfRoomSize + doorDepth / 2, doorHeight, 0);
       doorGroup.add(westDoor);
   }
}

// Initial door creation
createDoorVisuals(currentRoom);


// Player Movement Setup
const keyboardState = {};
const playerSpeed = 0.05;
const dragonSpeed = 0.02;
let lastMoveDirection = new THREE.Vector3(0, 0, 0); // Track last movement direction for throwing

window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;

    // --- Spear Throw Logic ---
    if (event.code === 'Space' && inventory.includes('spear') && spearState === 'inventory') {
        // Check if any movement key is currently pressed
        const isMoving = keyboardState['KeyW'] || keyboardState['ArrowUp'] ||
                         keyboardState['KeyS'] || keyboardState['ArrowDown'] ||
                         keyboardState['KeyA'] || keyboardState['ArrowLeft'] ||
                         keyboardState['KeyD'] || keyboardState['ArrowRight'];

        if (isMoving && lastMoveDirection.lengthSq() > 0) { // Check lastMoveDirection to ensure a direction is set
            console.log("Attempting to throw spear!");
            throwSpear(lastMoveDirection); // Pass the last valid movement direction
        }
    }
    // --- End Spear Throw Logic ---
});

window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

// Function to handle throwing the spear
function throwSpear(direction) {
    if (!spearProjectile.mesh) {
        console.error("Spear mesh not found!");
        return;
    }

    // 1. Update State
    spearState = 'thrown';
    spearProjectile.active = true;
    spearProjectile.originRoomId = currentRoomId; // Record the room it was thrown in

    // 2. Remove from Inventory & Update UI
    const spearIndex = inventory.indexOf('spear');
    if (spearIndex > -1) {
        inventory.splice(spearIndex, 1);
    }
    updateUI();

    // 3. Set Initial Position & Make Visible
    // Start slightly in front of the player in the throw direction
    const offset = direction.clone().multiplyScalar(0.5); // Adjust offset as needed
    spearProjectile.mesh.position.copy(player.position).add(offset);
    spearProjectile.mesh.position.y = 0.5; // Set fixed height for thrown spear (mid-point of its height)
    spearProjectile.mesh.visible = true;

    // 4. Set Velocity
    spearProjectile.velocity.copy(direction).normalize().multiplyScalar(SPEAR_SPEED);
    spearProjectile.direction.copy(direction).normalize(); // Store normalized direction

    // 5. Orient Spear Mesh based on direction
    spearProjectile.mesh.rotation.set(0, 0, 0); // Reset rotation first
    if (Math.abs(direction.x) > Math.abs(direction.z)) { // Moving primarily horizontally (X-axis)
        // Point tip left or right
        spearProjectile.mesh.rotation.z = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2; // Rotate around Z for horizontal alignment
    } else { // Moving primarily vertically (Z-axis)
        // Point tip up (negative Z) or down (positive Z)
        if (direction.z > 0) { // Moving downwards (positive Z)
             spearProjectile.mesh.rotation.x = Math.PI / 2; // Rotate +90 deg around X
        } else { // Moving upwards (negative Z)
             spearProjectile.mesh.rotation.x = -Math.PI / 2; // Rotate -90 deg around X
        }
    }
     console.log(`Spear thrown! State: ${spearState}, Direction: (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}), Rotation: (${spearProjectile.mesh.rotation.x.toFixed(2)}, ${spearProjectile.mesh.rotation.y.toFixed(2)}, ${spearProjectile.mesh.rotation.z.toFixed(2)})`);


    // Hide from standard visibility logic while thrown
    // updateItemVisibility(); // Call this to hide the 'inventory' version if needed? No, handled by state check.
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Helper function to trigger scene background flicker
let flickerTimeout = null; // To prevent overlapping flickers
function triggerSceneFlicker(flickerColorHex = 0x888888, duration = 200) {
    if (flickerTimeout) {
        clearTimeout(flickerTimeout); // Clear any existing flicker timeout
        scene.background.setHex(originalBackgroundColor); // Ensure it resets if interrupted
    }
    scene.background.setHex(flickerColorHex); // Set to flicker color
    flickerTimeout = setTimeout(() => {
        scene.background.setHex(originalBackgroundColor); // Reset to original color
        flickerTimeout = null;
    }, duration);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // --- Calculate Movement Direction ---
    let moveDirection = new THREE.Vector3(0, 0, 0);
    if (keyboardState['KeyW'] || keyboardState['ArrowUp']) {
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
    // --- End Player Movement ---


    // --- Spear Projectile Logic ---
    if (spearState === 'thrown' && spearProjectile.active) {
        // Update position
        spearProjectile.mesh.position.add(spearProjectile.velocity);

        // Check for collisions ONLY within the room it was thrown from
        if (currentRoomId === spearProjectile.originRoomId) {
            // A. Check Dragon Collision
            let hitDragon = false;
            itemMeshes.forEach((dragonMesh, dragonId) => {
                if (dragonMesh.visible && dragonMesh.userData.isDragon && !defeatedDragons.has(dragonId)) {
                    const distance = spearProjectile.mesh.position.distanceTo(dragonMesh.position);
                    // Use a suitable collision distance for spear vs dragon
                    const spearDragonCollisionDistance = 0.8; // Adjust as needed (dragon center to spear center)
                    if (distance < spearDragonCollisionDistance) {
                        console.log(`Spear hit ${dragonId}!`);
                        triggerSceneFlicker(0xff0000, 300); // Red flicker for kill

                        // Defeat Dragon
                        defeatedDragons.add(dragonId);
                        dragonMesh.visible = false; // Hide the dragon mesh

                        // Stop Spear
                        spearState = 'stuck';
                        spearProjectile.active = false;
                        spearProjectile.velocity.set(0, 0, 0);
                        // Keep spear mesh visible at the point of impact
                        hitDragon = true;
                        updateItemVisibility(); // Update visibility states
                        return; // Stop checking other dragons
                    }
                }
            });

            // B. Check Room Boundary Collision (only if no dragon was hit)
            if (!hitDragon) {
                const roomSize = 10;
                const halfRoomSize = roomSize / 2;
                const spearPos = spearProjectile.mesh.position;
                if (spearPos.x < -halfRoomSize || spearPos.x > halfRoomSize || spearPos.z < -halfRoomSize || spearPos.z > halfRoomSize) {
                    console.log("Spear missed and went out of bounds.");
                    triggerSceneFlicker(0x888888, 150); // Grey flicker for miss

                    // Reset Spear
                    spearState = 'respawned'; // Mark for respawn
                    spearProjectile.active = false;
                    spearProjectile.mesh.visible = false; // Hide projectile mesh
                    spearProjectile.velocity.set(0, 0, 0);

                    // Reset the item data in worldData (this is a bit hacky, ideally state is managed better)
                    const spearData = worldData.items.find(item => item.id === 'spear');
                    if (spearData) {
                        spearData.initialRoomId = spearOriginalSpawn.roomId;
                        spearData.position.x = spearOriginalSpawn.position.x;
                        spearData.position.y = spearOriginalSpawn.position.y;
                        spearData.position.z = spearOriginalSpawn.position.z;
                         console.log(`Spear data reset to Room ${spearData.initialRoomId} at (${spearData.position.x}, ${spearData.position.y}, ${spearData.position.z})`);
                    }

                    updateItemVisibility(); // Update visibility (should show spear in spawn room if player is there)
                }
            }
        } else {
             // Spear is in a different room than it was thrown from - treat as out of bounds immediately
             console.log("Spear left its origin room while thrown - resetting.");
             triggerSceneFlicker(0x888888, 150); // Grey flicker for miss

             spearState = 'respawned';
             spearProjectile.active = false;
             spearProjectile.mesh.visible = false;
             spearProjectile.velocity.set(0, 0, 0);
             const spearData = worldData.items.find(item => item.id === 'spear');
             if (spearData) {
                 spearData.initialRoomId = spearOriginalSpawn.roomId;
                 spearData.position.x = spearOriginalSpawn.position.x;
                 spearData.position.y = spearOriginalSpawn.position.y;
                 spearData.position.z = spearOriginalSpawn.position.z;
             }
             updateItemVisibility();
        }
    }
    // --- End Spear Projectile Logic ---


    // --- Player-Spear Retrieval Logic ---
    if (spearState === 'stuck' && spearProjectile.mesh && spearProjectile.mesh.visible) {
        const pickupDistance = 0.6; // How close player needs to be to pick up stuck spear
        const distance = player.position.distanceTo(spearProjectile.mesh.position);
        if (distance < pickupDistance) {
            console.log("Retrieved stuck spear!");
            triggerSceneFlicker(0xAAAAFF, 150); // Blue flicker for pickup

            spearState = 'inventory'; // Back in inventory
            inventory.push('spear');
            spearProjectile.mesh.visible = false; // Hide the mesh
            updateUI();
            updateItemVisibility(); // Ensure correct visibility states
        }
    }
    // --- End Player-Spear Retrieval Logic ---


    // Dragon movement logic (only move if not defeated)
    const roomSize = 10;
    const halfRoomSize = roomSize / 2;
    itemMeshes.forEach((itemMesh, itemId) => {
        if (itemMesh.visible && itemMesh.userData.isDragon && !defeatedDragons.has(itemId)) { // Check defeatedDragons
            const dragon = itemMesh;
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, dragon.position).normalize();

            dragon.position.x += direction.x * dragonSpeed;
            dragon.position.z += direction.z * dragonSpeed;

            const angle = Math.atan2(direction.x, direction.z);
            dragon.rotation.y = angle;

            const dragonBoundaryOffsetWidth = 0.6 / 2;
            const dragonBoundaryOffsetDepth = 0.6 / 2;
            dragon.position.x = Math.max(-halfRoomSize + dragonBoundaryOffsetWidth, Math.min(halfRoomSize - dragonBoundaryOffsetWidth, dragon.position.x));
            dragon.position.z = Math.max(-halfRoomSize + dragonBoundaryOffsetDepth, Math.min(halfRoomSize - dragonBoundaryOffsetDepth, dragon.position.z));
            dragon.position.y = 0.4;
        }
    });


    // Room transition logic (largely unchanged, but ensure updateItemVisibility is called)
    let transitioned = false;
    // ... (boundary checks N, S, E, W - check for locked doors etc.) ...
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
                    targetRoomId = connection.roomId;
                }
            } else {
                 targetRoomId = connection;
            }

            if (canPass && targetRoomId !== null) {
                currentRoomId = targetRoomId;
                player.position.z = halfRoomSize - 0.1;
                transitioned = true;
            } else {
                 player.position.z = -halfRoomSize;
            }
        } else {
            player.position.z = -halfRoomSize;
        }
    }
    // Check South boundary
    else if (player.position.z > halfRoomSize) {
        const connection = currentRoom.connections.south; // Need to handle potential locked doors here too if applicable
        if (connection !== null) {
             // Assuming south is never locked for now based on world.js
            currentRoomId = connection;
            player.position.z = -halfRoomSize + 0.1;
            transitioned = true;
        } else {
            player.position.z = halfRoomSize;
        }
    }
    // Check West boundary
    else if (player.position.x < -halfRoomSize) {
         const connection = currentRoom.connections.west; // Need to handle potential locked doors here too if applicable
         if (connection !== null) {
             // Assuming west is never locked for now
             currentRoomId = connection;
             player.position.x = halfRoomSize - 0.1;
             transitioned = true;
         } else {
             player.position.x = -halfRoomSize;
         }
    }
    // Check East boundary
    else if (player.position.x > halfRoomSize) {
         const connection = currentRoom.connections.east; // Need to handle potential locked doors here too if applicable
         if (connection !== null) {
             // Assuming east is never locked for now
             currentRoomId = connection;
             player.position.x = -halfRoomSize + 0.1;
             transitioned = true;
         } else {
             player.position.x = halfRoomSize;
         }
    }


    if (transitioned) {
        // ... (clear doors, update room, ground color) ...
        while (doorGroup.children.length > 0) {
            doorGroup.remove(doorGroup.children[0]);
        }
        currentRoom = getRoomById(currentRoomId);
        groundMaterial.color.setHex(currentRoom.color);
        console.log(`[Transition] Set ground color to: ${currentRoom.color.toString(16)}`);
        updateItemVisibility(); // CRUCIAL: Update visibility after room change
        createDoorVisuals(currentRoom);
        console.log(`[Transition] Entered room: ${currentRoom.name} (ID: ${currentRoomId})`);
        updateUI();

        // ... (win condition check) ...
        if (currentRoom.winConditionItem && inventory.includes(currentRoom.winConditionItem)) {
             console.log("YOU WIN! You brought the Chalice back to the Gold Castle!");
             // ... (win flicker) ...
             alert("YOU WIN! You brought the Chalice back to the Gold Castle!");
             // Ideally stop the game loop here or disable input
             return;
         }
    }

    // Collision detection for items (pickup) and dragons (player death)
    const pickupDistance = 0.5;
    const dragonCollisionDistance = 0.57; // Adjusted for slimmer dragon shape (belly is 0.6 wide/deep)

    itemMeshes.forEach((itemMesh, itemId) => {
        if (!itemMesh.visible) return; // Skip invisible items/dragons

        const itemData = worldData.items.find(item => item.id === itemId);
        if (!itemData) return;

        const distance = player.position.distanceTo(itemMesh.position);

        if (itemMesh.userData.isDragon && !defeatedDragons.has(itemId)) { // Check if dragon and not defeated
            // Player-Dragon collision (death condition)
            if (distance < dragonCollisionDistance) {
                // Player is eaten (Sword doesn't protect from direct contact)
                triggerSceneFlicker(0xff0000, 300);
                console.log(`You were eaten by ${itemData.name}! GAME OVER`);
                alert(`You were eaten by ${itemData.name}! GAME OVER`);
                // Reset game state
                player.position.set(0, 0.25, 0);
                inventory.length = 0; // Clear inventory
                defeatedDragons.clear(); // Reset defeated dragons on death
                // Reset sword state if it was thrown/stuck
                if (spearState !== 'inventory') {
                    spearState = 'respawned'; // Mark for respawn
                    spearProjectile.active = false;
                    if (spearProjectile.mesh) spearProjectile.mesh.visible = false;
                    const spearData = worldData.items.find(item => item.id === 'spear');
                     if (spearData) {
                         spearData.initialRoomId = spearOriginalSpawn.roomId;
                         spearData.position.x = spearOriginalSpawn.position.x;
                         spearData.position.y = spearOriginalSpawn.position.y;
                         spearData.position.z = spearOriginalSpawn.position.z;
                     }
                }
                currentRoomId = worldData.startRoomId;
                currentRoom = getRoomById(currentRoomId);
                groundMaterial.color.setHex(currentRoom.color);
                updateItemVisibility(); // Update visibility for start room (respawns items/dragons)
                updateUI();
                createDoorVisuals(currentRoom);
                return; // Stop processing this frame
            }
        } else if (!itemMesh.userData.isDragon && !inventory.includes(itemId)) {
            // Item pickup collision (excluding sword pickup here, handled by retrieval logic)
            if (itemId !== 'spear' && distance < pickupDistance) {
                inventory.push(itemId);
                triggerSceneFlicker(0x888888);
                itemMesh.visible = false;
                console.log(`Picked up: ${itemData.name}`);
                console.log("Inventory:", inventory);
                updateUI();
                // updateItemVisibility(); // Called during room transition or after pickup implicitly
            }
            // Handle picking up the respawned sword
            else if (itemId === 'spear' && spearState === 'respawned' && distance < pickupDistance) {
                 console.log("Picked up respawned spear!");
                 triggerSceneFlicker(0xAAAAFF, 150); // Blue flicker

                 spearState = 'inventory'; // Back in inventory
                 inventory.push('spear');
                 itemMesh.visible = false; // Hide the mesh
                 updateUI();
                 updateItemVisibility(); // Ensure correct visibility states
            }
        }
    });


    renderer.render(scene, camera);
}

// Initial setup calls
updateItemVisibility();
updateUI();
createDoorVisuals(currentRoom);
animate(); // Start the loop