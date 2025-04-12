import * as THREE from 'three';
import { scene } from './sceneSetup.js';
// worldData will be passed to functions needing it

// Item Setup
const itemMeshes = new Map(); // To store THREE.Mesh objects for items

// Creates the 3D mesh for an item (including dragons)
function createItemMesh(itemData, spearProjectileRef) { // Pass spearProjectileRef for mesh assignment
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

        // Assign the group to the mesh variable
        const mesh = dragonGroup; // Use the group directly
        mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
        mesh.userData.itemId = itemData.id;
        mesh.userData.isDragon = itemData.isDragon || false;
        mesh.visible = false; // Initially hidden
        scene.add(mesh);
        itemMeshes.set(itemData.id, mesh);
        return; // Skip default mesh creation

    } else if (itemData.id === 'spear') {
        // Spear is a tall thin box
        geometry = new THREE.BoxGeometry(0.1, 1.0, 0.05);
    } else if (itemData.id === 'gold_key') {
        geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    } else {
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }

    // Default mesh creation for non-dragon items
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
    mesh.userData.itemId = itemData.id; // Store item ID
    mesh.userData.isDragon = itemData.isDragon || false; // Store dragon flag
    mesh.visible = false; // Initially hidden

    // If this is the spear, store its mesh reference for throwing
    if (itemData.id === 'spear' && spearProjectileRef) {
        spearProjectileRef.mesh = mesh;
    }

    scene.add(mesh);
    itemMeshes.set(itemData.id, mesh);
}

// Function to update item visibility based on the current room and game state
// Needs access to various states from main.js, passed as arguments
function updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn) {
    // Get all items currently located in this room according to worldData
    const itemsInCurrentRoomData = worldData.items.filter(item => item.currentRoomId === currentRoomId);
    const itemIdsInCurrentRoom = new Set(itemsInCurrentRoomData.map(item => item.id));

    itemMeshes.forEach((mesh, itemId) => {
        let shouldBeVisible = false;
        const itemData = worldData.items.find(item => item.id === itemId); // Get item data

        if (defeatedDragons.has(itemId)) {
            shouldBeVisible = false; // Dragon is defeated, hide it
        } else if (itemId === 'spear') {
            // Spear visibility logic:
            if (spearState === 'stuck' || spearState === 'thrown') {
                 shouldBeVisible = true; // Show where it landed or while flying
            } else if (spearState === 'respawned') {
                // Show if player is in the spear's original room and doesn't have it
                shouldBeVisible = (currentRoomId === spearOriginalSpawn.roomId && !inventory.includes('spear'));
                if (shouldBeVisible) {
                    // Ensure it's at its respawn position
                    mesh.position.set(spearOriginalSpawn.position.x, spearOriginalSpawn.position.y, spearOriginalSpawn.position.z);
                    mesh.rotation.set(0, 0, 0); // Reset orientation
                }
            } else { // 'inventory'
                shouldBeVisible = false;
            }
        } else if (inventory.includes(itemId)) {
            shouldBeVisible = false; // Item is in inventory, hide it
        } else {
            // Default item visibility: show if its currentRoomId matches the player's current room
            shouldBeVisible = itemData ? itemData.currentRoomId === currentRoomId : false;
        }

        mesh.visible = shouldBeVisible;

        // Ensure dragons are positioned correctly if visible
        if (mesh.userData.isDragon && shouldBeVisible) {
             mesh.position.y = 0.4; // Reset Y position just in case
        }
    });
}

export { itemMeshes, createItemMesh, updateItemVisibility };