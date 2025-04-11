import * as THREE from 'three';
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
let spearState = 'respawned'; // 'inventory', 'thrown', 'stuck', 'respawned'
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
const BIRD_SPEED = 0.08;
const BIRD_WING_SPEED = 0.05;
const BIRD_WING_MAX_ANGLE = Math.PI / 4; // 45 degrees flap
const BIRD_Y_POSITION = 0.75; // How high the bird flies
const BIRD_SPAWN_CHANCE = 0.1; // 10% chance

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
const gameMessageElement = document.getElementById('game-message'); // Reference to the new message element

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

// --- Bird Mesh Creation ---
function createBirdMesh() {
    const birdGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.8); // Longer body
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB }); // Sky blue
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    birdGroup.add(bodyMesh);

    // Wings (relative to the body)
    const wingGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.3); // Wider, thinner wings
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xADD8E6 }); // Light blue

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.5, 0, 0); // Position left of the body center
    leftWing.geometry.translate(0.4, 0, 0); // Pivot from the edge connected to the body
    birdGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.5, 0, 0); // Position right of the body center
    rightWing.geometry.translate(-0.4, 0, 0); // Pivot from the edge connected to the body
    birdGroup.add(rightWing);

    birdGroup.position.y = BIRD_Y_POSITION; // Set initial height
    birdGroup.visible = false; // Start hidden
    scene.add(birdGroup);

    // Store references for animation
    bird.mesh = birdGroup;
    bird.mesh.userData.leftWing = leftWing; // Store wing references for easy access
    bird.mesh.userData.rightWing = rightWing;
}

createBirdMesh(); // Create the bird mesh on startup
// --- End Bird Mesh Creation ---

// Function to update item visibility based on the current room
function updateItemVisibility() {
    // Get all items currently located in this room according to worldData
    const itemsInCurrentRoomData = worldData.items.filter(item => item.currentRoomId === currentRoomId);
    const itemIdsInCurrentRoom = new Set(itemsInCurrentRoomData.map(item => item.id));
    //console.log(`[Visibility Check] Room: ${currentRoomId}. Items currently located here:`, Array.from(itemIdsInCurrentRoom));

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
            } else if (spearState === 'thrown') {
                shouldBeVisible = true;
            } else { // 'inventory'
                shouldBeVisible = false;
            }
        } else if (inventory.includes(itemId)) {
            shouldBeVisible = false; // Item is in inventory, hide it
        } else {
            // Default item visibility: show if it belongs in the current room
            // Default item visibility: show if its currentRoomId matches the player's current room
            const itemData = worldData.items.find(item => item.id === itemId);
            shouldBeVisible = itemData ? itemData.currentRoomId === currentRoomId : false;
        }

        mesh.visible = shouldBeVisible;
        // Only log for non-spear items for clarity during spear testing
        if (itemId !== 'spear') {
             const itemDataForLog = worldData.items.find(item => item.id === itemId);
             const itemCurrentRoomId = itemDataForLog ? itemDataForLog.currentRoomId : 'N/A';
             //console.log(`[Visibility Check] Item: ${itemId}, In Inventory: ${inventory.includes(itemId)}, Current Room ID: ${itemCurrentRoomId}, Player Room ID: ${currentRoomId}, Defeated: ${defeatedDragons.has(itemId)}, Final Visibility: ${shouldBeVisible}`);
        } else {
             //console.log(`[Visibility Check] Spear State: ${spearState}, In Original Room: ${currentRoomId === spearOriginalSpawn.roomId}, Has Spear: ${inventory.includes('spear')}, Final Visibility: ${shouldBeVisible}`);
             //console.log('currentRoomId: ', currentRoomId);
             //console.log('spearOriginalSpawn.roomId: ', spearOriginalSpawn.roomId);
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
const dragonSpeed = 0.02; // Default speed for dragons
const redDragonSpeed = 0.035; // Faster speed for Rhindle
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
let flickerTimeoutId = null; // To store the timeout ID
function triggerSceneFlicker(flickerColorHex = 0x888888, duration = 200) {

    if (flickerTimeoutId) {
        clearTimeout(flickerTimeoutId); // Clear any existing flicker timeout
        // scene.background.setHex(originalBackgroundColor); // Reset is handled in timeout
    }
    scene.background.setHex(flickerColorHex); // Set to flicker color using scene.background
    flickerTimeoutId = setTimeout(() => {
        scene.background.setHex(originalBackgroundColor); // Reset to original color using scene.background
        flickerTimeoutId = null;
        // Removed forced render
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
    //console.log('player.position:', player.position);
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
            }); // End of itemMeshes.forEach for spear-dragon collision

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


                    updateItemVisibility(); // Update visibility
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
             // No need to reset worldData.items for spear here either.
             console.log(`Spear marked for respawn in Room ${spearOriginalSpawn.roomId}`);
             updateItemVisibility();
        }
    }
    // --- End Spear Projectile Logic ---
// --- End Spear Projectile Logic ---
// (Removed duplicated boundary check logic from here)
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


    // --- Bird NPC Logic ---
    if (bird.active) {
        // Move bird
        bird.mesh.position.add(bird.velocity);

        // Animate wings
        bird.wingAngle += bird.wingDirection * BIRD_WING_SPEED;
        if (Math.abs(bird.wingAngle) > BIRD_WING_MAX_ANGLE) {
            bird.wingDirection *= -1; // Reverse flap direction
            bird.wingAngle = bird.wingDirection * BIRD_WING_MAX_ANGLE; // Clamp angle
        }
        bird.mesh.userData.leftWing.rotation.z = bird.wingAngle; // Rotate around Z axis (relative to body)
        bird.mesh.userData.rightWing.rotation.z = -bird.wingAngle; // Rotate opposite direction

        // Attach carried object visually (if any)
        if (bird.targetObject) {
            if (bird.targetObjectType === 'player') {
                // Force player position
                player.position.copy(bird.mesh.position);
                player.position.y = BIRD_Y_POSITION - 0.5; // Slightly below bird
            } else {
                const targetMesh = itemMeshes.get(bird.targetObjectId);
                if (targetMesh) {
                    targetMesh.position.copy(bird.mesh.position);
                    targetMesh.position.y = BIRD_Y_POSITION - 0.5; // Slightly below bird
                }
            }
        }

        // Check if bird reached the midpoint (for 'take' action) or endpoint
        const distanceToEnd = bird.mesh.position.distanceTo(bird.endPos);
        const distanceToCenter = bird.mesh.position.length(); // Approx distance to center (0,0) - adjust if center isn't 0,0
        const centerThreshold = 7; // How close to the center to trigger action

        // State transitions and actions
        if (bird.state === 'entering' && distanceToCenter < centerThreshold) { // Reached near center area
             console.log("Bird reached center area");
            if (bird.action === 'take') {
                // Pick up the object
                console.log(`Bird picking up ${bird.targetObjectType}: ${bird.targetObjectId || 'player'}`);
                if (bird.targetObjectType === 'player') {
                    // Player is already visually attached
                } else {
                    const targetMesh = itemMeshes.get(bird.targetObjectId);
                    if (targetMesh) {
                        targetMesh.visible = true; // Ensure visible while carried
                    }
                }
                bird.state = 'crossing'; // Now just crossing to exit
            } else { // 'bring' action
                // Drop the object
                console.log(`Bird dropping ${bird.targetObjectType}: ${bird.targetObjectId || 'player'}`);
                if (bird.targetObject) {
                    const targetItemData = worldData.items.find(item => item.id === bird.targetObjectId);
                    const dropPosition = new THREE.Vector3(
                        (Math.random() - 0.5) * 8, // Random X within ~room bounds
                        0, // Y depends on object type
                        (Math.random() - 0.5) * 8  // Random Z within ~room bounds
                    );

                    if (bird.targetObjectType === 'player') {
                        player.position.set(dropPosition.x, 0.25, dropPosition.z); // Place player on ground
                        console.log(`Player dropped at (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)})`);
                    } else if (targetItemData) {
                        const targetMesh = itemMeshes.get(bird.targetObjectId);
                        const dropY = targetItemData.isDragon ? 0.4 : 0.2;
                        if (targetMesh) {
                            targetMesh.position.set(dropPosition.x, dropY, dropPosition.z); // Place item/dragon on ground
                            targetMesh.visible = true; // Ensure it's visible after drop
                        }
                        // Update world data
                        targetItemData.currentRoomId = currentRoomId;
                        //targetItemData.position.copy(dropPosition); // Update persistent position
                        // Update persistent position
                        targetItemData.position.x = dropPosition.x;
                        targetItemData.position.y = dropPosition.y;
                        targetItemData.position.z = dropPosition.z;

                        targetItemData.position.y = dropY; // Ensure correct Y in data
                         console.log(`${bird.targetObjectId} dropped at (${targetItemData.position.x.toFixed(1)}, ${targetItemData.position.z.toFixed(1)}) in room ${currentRoomId}`);
                    }
                    bird.targetObject = null; // Bird is no longer carrying anything
                    bird.targetObjectId = null;
                    bird.targetObjectType = null;
                    updateItemVisibility(); // Refresh visibility based on new item location
                }
                bird.state = 'crossing'; // Now just crossing to exit
            }
        } else if (distanceToEnd < 1.0) { // Reached exit edge
             console.log("Bird reached exit edge");
            bird.state = 'exiting';
            bird.active = false;
            bird.mesh.visible = false;

            if (bird.action === 'take' && bird.targetObject) {
                 const targetItemData = worldData.items.find(item => item.id === bird.targetObjectId);

                 if (bird.targetObjectType === 'player') {
                     // Player position will be reset randomly upon entering the new room by the transition logic
                     console.log("Bird took player - position will be randomized on room entry");
                     // Find a random *other* room for the player
                     const possibleRooms = worldData.rooms.filter(r => r.id !== currentRoomId);
                     if (possibleRooms.length > 0) {
                         const targetRoomId = possibleRooms[Math.floor(Math.random() * possibleRooms.length)].id;
                         // Set a flag or store data for the room transition logic to handle
                         player.userData.forceNextRoomId = targetRoomId;
                         console.log(`Player will be moved to room ${targetRoomId}`);
                     } else {
                         console.log("Bird couldn't find another room to take the player to.");
                         // Drop player back in current room?
                         player.position.set(0, 0.25, 0); // Drop at center for now
                     }
                 } else if (targetItemData) {
                    // Find a random *other* room to drop the item in
                    const possibleRooms = worldData.rooms.filter(r => r.id !== currentRoomId);
                    if (possibleRooms.length > 0) {
                        const targetRoom = possibleRooms[Math.floor(Math.random() * possibleRooms.length)];
                        targetItemData.currentRoomId = targetRoom.id;
                        //targetItemData.position.set(0, targetItemData.isDragon ? 0.4 : 0.2, 0); // Default position in new room
                        targetItemData.position.x = 0;
                        targetItemData.position.y = targetItemData.isDragon ? 0.4 : 0.2;
                        targetItemData.position.z = 0;
                        console.log(`${bird.targetObjectId} taken by bird to room ${targetRoom.id}`);
                        updateItemVisibility(); // Hide item from current room
                    } else {
                         console.log("Bird couldn't find another room to take the item to.");
                         targetItemData.currentRoomId = null; // Remove from world state
                         updateItemVisibility();
                    }
                 }
            } // End if (bird.action === 'take' && bird.targetObject)

            // Reset bird state fully
            bird.targetObject = null;
            bird.targetObjectId = null;
            bird.targetObjectType = null;
            bird.action = null;
            bird.state = 'inactive';
        } // End else if (distanceToEnd < 1.0)
    } // End if (bird.active)
    // --- End Bird NPC Logic ---

    // Dragon movement logic (only move if not defeated)
    // (Removed duplicated bird logic from here)


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
                playerMovedToNewRoom = true; // Set the flag here!
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
            playerMovedToNewRoom = true; // Set the flag here!
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
             playerMovedToNewRoom = true; // Set the flag here!
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
             playerMovedToNewRoom = true; // Set the flag here!
         } else {
             player.position.x = halfRoomSize;
         }
    }

    if (playerMovedToNewRoom) { // Use the renamed flag
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

        // --- Bird Trigger Logic ---
        // Only trigger if player moved rooms AND bird is not already active
        if (!bird.active && Math.random() < BIRD_SPAWN_CHANCE) {
            console.log("Bird sequence triggered!");
            startBirdSequence();
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
                // Reset spear state if it was thrown/stuck
                if (spearState !== 'inventory') {
                    spearState = 'respawned'; // Mark for respawn
                    spearProjectile.active = false;
                    if (spearProjectile.mesh) spearProjectile.mesh.visible = false;
                    const spearData = worldData.items.find(item => item.id === 'spear');
                     // Spear state is already set to 'respawned'.
                     // updateItemVisibility will handle placing it correctly
                     // when the player enters the spear's original room.
                     // No need to manually reset worldData here.
                     console.log("Spear marked for respawn due to player death.");
                }
                currentRoomId = worldData.startRoomId;
                currentRoom = getRoomById(currentRoomId);
                groundMaterial.color.setHex(currentRoom.color);
                updateItemVisibility(); // Update visibility for start room (respawns items/dragons)
                updateUI();
                gameMessageElement.textContent = ""; // Clear message on death/reset
                createDoorVisuals(currentRoom);
                return; // Stop processing this frame
            }
        } else if (!itemMesh.userData.isDragon && !inventory.includes(itemId) && !(bird.active && bird.targetObjectId === itemId)) {
            // Item pickup collision (exclude dragons, items in inventory, items carried by bird)
            if (itemId !== 'spear' && distance < pickupDistance) { // Spear pickup handled separately
                inventory.push(itemId); // Add item to inventory
                // Update item's state in worldData
                const pickedUpItemData = worldData.items.find(item => item.id === itemId);
                if (pickedUpItemData) {
                    pickedUpItemData.currentRoomId = null; // Indicate it's not in any room (in inventory)
                }
                triggerSceneFlicker(0x888888);
                itemMesh.visible = false; // Hide mesh
                console.log(`Picked up: ${itemData.name}`);
                console.log("Inventory:", inventory);
                updateUI();
                updateItemVisibility(); // Update visibility state immediately
            }
            // Handle picking up the respawned spear
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
         if (!flickerTimeoutId && !scene.background.equals(new THREE.Color(originalBackgroundColor))) {
              scene.background.setHex(originalBackgroundColor);
         }
    }
    // --- End Win Flashing Logic ---

    renderer.render(scene, camera);
  updateItemVisibility();
} // Correct closing brace for animate() function

// --- Bird Sequence Setup Function ---
function startBirdSequence() {
    if (bird.active) return; // Don't start if already active

    const roomSize = 10;
    const halfRoomSize = roomSize / 2;
    const edgeOffset = 1.5; // How far from the exact edge the bird starts/ends

    // 1. Decide Action: Bring or Take?
    const movableObjectsInRoom = worldData.items.filter(item =>
        item.currentRoomId === currentRoomId &&
        !inventory.includes(item.id) &&
        !defeatedDragons.has(item.id) &&
        item.id !== 'spear' // Bird doesn't mess with the spear
    );
    const canTakePlayer = true; // Bird can always try to take the player
    const canTake = movableObjectsInRoom.length > 0 || canTakePlayer;

    const movableObjectsOutsideRoom = worldData.items.filter(item =>
        item.currentRoomId !== currentRoomId &&
        item.currentRoomId !== null && // Not in inventory (currentRoomId is null)
        !defeatedDragons.has(item.id) &&
        item.id !== 'spear'
    );
    const canBring = movableObjectsOutsideRoom.length > 0;

    if (canTake && (!canBring || Math.random() < 0.5)) {
        bird.action = 'take';
    } else if (canBring) {
        bird.action = 'bring';
    } else {
        console.log("Bird decided not to act (no valid targets).");
        return; // No valid action possible
    }

    console.log(`Bird action: ${bird.action}`);

    // 2. Select Target Object
    if (bird.action === 'take') {
        const potentialTargets = [...movableObjectsInRoom];
        if (canTakePlayer) {
            potentialTargets.push({ id: 'player', type: 'player', isDragon: false }); // Represent player
        }
        if (potentialTargets.length === 0) {
             console.log("Bird wanted to take, but found no targets.");
             return;
        }
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        if (target.id === 'player') {
            bird.targetObject = player; // Reference to the player mesh
            bird.targetObjectId = null;
            bird.targetObjectType = 'player';
        } else {
            bird.targetObject = itemMeshes.get(target.id); // Reference to the item/dragon mesh
            bird.targetObjectId = target.id;
            bird.targetObjectType = target.isDragon ? 'dragon' : 'item';
            // Hide the object temporarily until bird picks it up near center
            if (bird.targetObject) bird.targetObject.visible = false;
             else console.warn(`Bird couldn't find mesh for item to take: ${target.id}`);
        }
    } else { // 'bring'
        if (movableObjectsOutsideRoom.length === 0) {
             console.log("Bird wanted to bring, but found no targets.");
             return;
        }
        const targetItemData = movableObjectsOutsideRoom[Math.floor(Math.random() * movableObjectsOutsideRoom.length)];
        bird.targetObject = itemMeshes.get(targetItemData.id); // Reference to the mesh
        bird.targetObjectId = targetItemData.id;
        bird.targetObjectType = targetItemData.isDragon ? 'dragon' : 'item';
        // Ensure the object is visible as the bird carries it in
        if (bird.targetObject) bird.targetObject.visible = true;
         else console.warn(`Bird couldn't find mesh for item to bring: ${targetItemData.id}`);
    }

    // Safety check if target mesh couldn't be found for item/dragon
    if (!bird.targetObject && bird.targetObjectType !== 'player') {
        console.error("Bird failed to find target mesh for ID:", bird.targetObjectId, " - Aborting sequence.");
        bird.action = null; // Reset action
        return;
    }
     console.log(`Bird target: ${bird.targetObjectType} ${bird.targetObjectId || '(player)'}`);


    // 3. Determine Start and End Positions (Random Edges)
    const edges = ['north', 'south', 'east', 'west'];
    const startEdgeIndex = Math.floor(Math.random() * 4);
    let endEdgeIndex = (startEdgeIndex + 2) % 4; // Opposite edge

    const randomOffsetStart = (Math.random() - 0.5) * (roomSize - edgeOffset * 2); // Random point along the start edge
    const randomOffsetEnd = (Math.random() - 0.5) * (roomSize - edgeOffset * 2); // Random point along the end edge

    switch (edges[startEdgeIndex]) {
        case 'north': bird.startPos.set(randomOffsetStart, BIRD_Y_POSITION, -halfRoomSize - edgeOffset); break;
        case 'south': bird.startPos.set(randomOffsetStart, BIRD_Y_POSITION, halfRoomSize + edgeOffset); break;
        case 'east': bird.startPos.set(halfRoomSize + edgeOffset, BIRD_Y_POSITION, randomOffsetStart); break;
        case 'west': bird.startPos.set(-halfRoomSize - edgeOffset, BIRD_Y_POSITION, randomOffsetStart); break;
    }

    switch (edges[endEdgeIndex]) {
        case 'north': bird.endPos.set(randomOffsetEnd, BIRD_Y_POSITION, -halfRoomSize - edgeOffset); break;
        case 'south': bird.endPos.set(randomOffsetEnd, BIRD_Y_POSITION, halfRoomSize + edgeOffset); break;
        case 'east': bird.endPos.set(halfRoomSize + edgeOffset, BIRD_Y_POSITION, randomOffsetEnd); break;
        case 'west': bird.endPos.set(-halfRoomSize - edgeOffset, BIRD_Y_POSITION, randomOffsetEnd); break;
    }

    // 4. Set Bird State
    bird.mesh.position.copy(bird.startPos);
    bird.velocity.subVectors(bird.endPos, bird.startPos).normalize().multiplyScalar(BIRD_SPEED);
    // Make bird look towards the end position
    // Create a target point slightly below the bird's Y level for lookAt
    const lookAtTarget = new THREE.Vector3(bird.endPos.x, BIRD_Y_POSITION - 1, bird.endPos.z);
    bird.mesh.lookAt(lookAtTarget);
    // bird.mesh.rotateY(Math.PI); // Adjust if model faces backward after lookAt

    bird.mesh.visible = true;
    bird.active = true;
    bird.state = 'entering';
    bird.wingAngle = 0;
    bird.wingDirection = 1;

    console.log(`Bird starting at (${bird.startPos.x.toFixed(1)}, ${bird.startPos.z.toFixed(1)}), ending at (${bird.endPos.x.toFixed(1)}, ${bird.endPos.z.toFixed(1)})`);

    // If bringing an object, attach it visually now
    if (bird.action === 'bring' && bird.targetObject) {
        const targetMesh = itemMeshes.get(bird.targetObjectId);
        if (targetMesh) {
            targetMesh.position.copy(bird.mesh.position);
            targetMesh.position.y = BIRD_Y_POSITION - 0.5; // Slightly below bird
            targetMesh.visible = true; // Make sure it's visible
        }
    }
}
// --- End Bird Sequence Setup Function ---


// Initial setup calls
updateItemVisibility();
updateUI();
createDoorVisuals(currentRoom);
animate(); // Start the loop