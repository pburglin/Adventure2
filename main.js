import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Removed for player control
import { worldData, getRoomById } from './world.js'; // Import world data

// Game State
let currentRoomId = worldData.startRoomId;
let currentRoom = getRoomById(currentRoomId);
const inventory = []; // Player's inventory

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
        mesh.visible = false;
        scene.add(mesh);
        itemMeshes.set(itemData.id, mesh);
        return; // Skip the default mesh creation at the end for dragons

    } else if (itemData.id === 'sword') {
        // Sword is a tall thin box
        geometry = new THREE.BoxGeometry(0.1, 1.0, 0.05);
    } else if (itemData.id === 'gold_key') {
        // Key is a cylinder
        geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    } else {
        // Default to a small box for other items (like Chalice)
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }

    // Default mesh creation for non-dragon items
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
    mesh.userData.itemId = itemData.id; // Store item ID for later reference
    mesh.userData.isDragon = itemData.isDragon || false; // Store dragon flag
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
const playerSpeed = 0.05; // Units per frame
const dragonSpeed = 0.02; // Slower than the player

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

   // Dragon movement logic
   const roomSize = 10; // Must match groundGeometry size
   const halfRoomSize = roomSize / 2;
   const dragonBoundaryOffset = 0.5; // Keep dragon away from edge slightly (half its size)

   itemMeshes.forEach((itemMesh, itemId) => {
       if (itemMesh.visible && itemMesh.userData.isDragon) {
           const dragon = itemMesh;
           const direction = new THREE.Vector3();
           direction.subVectors(player.position, dragon.position).normalize();

           // Move dragon towards player
           dragon.position.x += direction.x * dragonSpeed;
           dragon.position.z += direction.z * dragonSpeed;

           // Rotate dragon to face the direction of movement (player)
           // Calculate angle in the XZ plane
           const angle = Math.atan2(direction.x, direction.z);
           // Apply rotation around the Y axis
           dragon.rotation.y = angle; // This makes the dragon's local Z axis point towards the player

           // Clamp dragon position within room boundaries
           // Use bellyWidth/Depth for boundary offset calculation
           const dragonBoundaryOffsetWidth = 0.6 / 2; // Half belly width
           const dragonBoundaryOffsetDepth = 0.6 / 2; // Half belly depth
           dragon.position.x = Math.max(-halfRoomSize + dragonBoundaryOffsetWidth, Math.min(halfRoomSize - dragonBoundaryOffsetWidth, dragon.position.x));
           dragon.position.z = Math.max(-halfRoomSize + dragonBoundaryOffsetDepth, Math.min(halfRoomSize - dragonBoundaryOffsetDepth, dragon.position.z));

           // Ensure dragon stays on the ground (base of the belly)
           // The group's origin is at the base, so Y=0 is ground level.
           // We might want it slightly above if bellyHeight/2 was used in createItemMesh positioning.
           // Let's adjust based on belly height (0.8). Center is 0.4.
           dragon.position.y = 0.4; // Set Y position to the center of the belly height
       }
   });

   // --- End of Dragon Movement Logic ---

    // Room transition logic
    // const roomSize = 10; // Moved up
    // const halfRoomSize = roomSize / 2; // Moved up
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
        // Clear old doors before creating new ones for the new room
        while (doorGroup.children.length > 0) {
            doorGroup.remove(doorGroup.children[0]);
        }

        currentRoom = getRoomById(currentRoomId);
        groundMaterial.color.setHex(currentRoom.color);
        console.log(`[Transition] Set ground color to: ${currentRoom.color.toString(16)}`); // DEBUG
        updateItemVisibility(); // Update which items are visible
        createDoorVisuals(currentRoom); // Create doors for the new room
        console.log(`[Transition] Entered room: ${currentRoom.name} (ID: ${currentRoomId})`); // Log room change
        updateUI(); // Update room name and inventory display

        // Check for win condition
        if (currentRoom.winConditionItem && inventory.includes(currentRoom.winConditionItem)) {
            console.log("YOU WIN! You brought the Chalice back to the Gold Castle!");
            // Continuous flicker for win condition
            const winColors = [0x00ff00, 0xffff00, 0xff00ff, 0x00ffff];
            let colorIndex = 0;
            const winFlickerInterval = setInterval(() => {
                triggerSceneFlicker(winColors[colorIndex], 200);
                colorIndex = (colorIndex + 1) % winColors.length;
            }, 200);
            
            alert("YOU WIN! You brought the Chalice back to the Gold Castle!");
            return; // Stop further processing this frame
        }
    }

    // Collision detection for items and dragons
    const pickupDistance = 0.5; // How close player needs to be to pick up items
    const dragonCollisionDistance = 0.7; // Dragons are bigger

    itemMeshes.forEach((itemMesh, itemId) => {
        if (!itemMesh.visible) return; // Skip invisible items/dragons

        const itemData = worldData.items.find(item => item.id === itemId);
        if (!itemData) return; // Should not happen, but safety check

        const distance = player.position.distanceTo(itemMesh.position);

        if (itemMesh.userData.isDragon) {
            // Dragon collision
            if (distance < dragonCollisionDistance) {
                if (inventory.includes('sword')) {
                    // Kill dragon
                    triggerSceneFlicker(0xff0000, 300); // Flicker scene background red when killing dragon
                    itemMesh.visible = false;
                    // We need a way to permanently remove the dragon or mark it as dead
                    // For now, just making it invisible works per session
                    console.log(`You killed ${itemData.name}!`);
                    // Remove dragon from itemMeshes? Or add to a 'deadDragons' list?
                    // Let's just hide it via updateItemVisibility logic for now.
                    // To make it permanent, we'd need to modify worldData or track state.
                } else {
                    // Player is eaten
                    triggerSceneFlicker(0xff0000, 300); // Flicker scene background red when player dies
                    console.log(`You were eaten by ${itemData.name}! GAME OVER`);
                    alert(`You were eaten by ${itemData.name}! GAME OVER`);
                    // Reset player position and inventory (simple reset)
                    player.position.set(0, 0.25, 0);
                    inventory.length = 0; // Clear inventory
                    currentRoomId = worldData.startRoomId;
                    currentRoom = getRoomById(currentRoomId);
                    groundMaterial.color.setHex(currentRoom.color);
                    updateItemVisibility(); // Update visibility for start room
                    // Potentially respawn dragons here if not permanently dead
                    return; // Stop further processing this frame after reset
                }
            }
        } else if (!inventory.includes(itemId)) {
            // Item pickup collision (only if not already in inventory)
            if (distance < pickupDistance) {
                inventory.push(itemId);
                triggerSceneFlicker(0x888888); // Flicker scene background grey for item pickup
                itemMesh.visible = false; // Hide the item mesh immediately
                console.log(`Picked up: ${itemData.name}`);
                console.log("Inventory:", inventory);
                updateUI(); // Update inventory display
                // updateItemVisibility will hide it permanently now
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