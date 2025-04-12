import * as THREE from 'three';
import { itemMeshes, updateItemVisibility } from './items.js'; // Need itemMeshes for collision, updateItemVisibility for state changes
import { triggerSceneFlicker } from './sceneSetup.js'; // For visual feedback

// Spear Constants
const SPEAR_SPEED = 0.15; // Faster than player/dragon

// Spear State (managed externally for now, passed to functions)
// let spearState = 'respawned'; // 'inventory', 'thrown', 'stuck', 'respawned'
// let spearProjectile = { ... };
// let spearOriginalSpawn = { ... };

// Function to handle throwing the spear
// Needs access to: spearProjectile, spearState, inventory, updateUI, player, currentRoomId
function throwSpear(direction, spearProjectile, spearStateRef, inventory, updateUI, player, currentRoomId) {
    if (!spearProjectile.mesh) {
        console.error("Spear mesh not found!");
        return 'error'; // Indicate failure
    }

    // 1. Update State (using the passed reference object)
    spearStateRef.state = 'thrown';
    spearProjectile.active = true;
    spearProjectile.originRoomId = currentRoomId; // Record the room it was thrown in

    // 2. Remove from Inventory & Update UI
    const spearIndex = inventory.indexOf('spear');
    if (spearIndex > -1) {
        inventory.splice(spearIndex, 1);
    }
    updateUI(); // Call the UI update function passed from main

    // 3. Set Initial Position & Make Visible
    const offset = direction.clone().multiplyScalar(0.5);
    spearProjectile.mesh.position.copy(player.position).add(offset);
    spearProjectile.mesh.position.y = 0.5; // Fixed height
    spearProjectile.mesh.visible = true;

    // 4. Set Velocity
    spearProjectile.velocity.copy(direction).normalize().multiplyScalar(SPEAR_SPEED);
    spearProjectile.direction.copy(direction).normalize(); // Store normalized direction

    // 5. Orient Spear Mesh
    spearProjectile.mesh.rotation.set(0, 0, 0); // Reset
    if (Math.abs(direction.x) > Math.abs(direction.z)) { // Horizontal
        spearProjectile.mesh.rotation.z = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else { // Vertical
        spearProjectile.mesh.rotation.x = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    console.log(`Spear thrown! State: ${spearStateRef.state}, Direction: (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);

    return 'thrown'; // Indicate success and new state
}

// Function to update spear projectile movement and check collisions
// Needs access to: spearProjectile, spearState, currentRoomId, defeatedDragons, updateItemVisibility, worldData, inventory, spearOriginalSpawn
function updateSpearProjectile(spearProjectile, spearStateRef, currentRoomId, defeatedDragons, updateItemVisibility, worldData, inventory, spearOriginalSpawn) {
    if (spearStateRef.state !== 'thrown' || !spearProjectile.active) {
        return; // Only process if actively thrown
    }

    // Update position
    spearProjectile.mesh.position.add(spearProjectile.velocity);

    // Check for collisions ONLY within the room it was thrown from
    if (currentRoomId === spearProjectile.originRoomId) {
        // A. Check Dragon Collision
        let hitDragon = false;
        itemMeshes.forEach((dragonMesh, dragonId) => {
            if (hitDragon) return; // Skip if already hit one
            if (dragonMesh.visible && dragonMesh.userData.isDragon && !defeatedDragons.has(dragonId)) {
                const distance = spearProjectile.mesh.position.distanceTo(dragonMesh.position);
                const spearDragonCollisionDistance = 0.8;
                if (distance < spearDragonCollisionDistance) {
                    console.log(`Spear hit ${dragonId}!`);
                    triggerSceneFlicker(0xff0000, 300); // Red flicker

                    defeatedDragons.add(dragonId); // Defeat Dragon (external set)
                    dragonMesh.visible = false; // Hide mesh

                    // Stop Spear
                    spearStateRef.state = 'stuck';
                    spearProjectile.active = false;
                    spearProjectile.velocity.set(0, 0, 0);
                    // Keep spear mesh visible at impact point
                    hitDragon = true;
                    updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Update visibility
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
                triggerSceneFlicker(0x888888, 150); // Grey flicker

                // Reset Spear
                spearStateRef.state = 'respawned'; // Mark for respawn
                spearProjectile.active = false;
                spearProjectile.mesh.visible = false; // Hide projectile mesh
                spearProjectile.velocity.set(0, 0, 0);
                updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Update visibility
            }
        }
    } else {
         // Spear is in a different room than it was thrown from - treat as out of bounds
         console.log("Spear left its origin room while thrown - resetting.");
         triggerSceneFlicker(0x888888, 150); // Grey flicker

         spearStateRef.state = 'respawned';
         spearProjectile.active = false;
         spearProjectile.mesh.visible = false;
         spearProjectile.velocity.set(0, 0, 0);
         console.log(`Spear marked for respawn in Room ${spearOriginalSpawn.roomId}`);
         updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn);
    }
}

// Function to handle player retrieving a stuck spear
// Needs access to: spearState, spearProjectile, player, inventory, updateUI, updateItemVisibility, worldData, defeatedDragons, spearOriginalSpawn
function checkSpearRetrieval(spearStateRef, spearProjectile, player, inventory, updateUI, updateItemVisibility, worldData, defeatedDragons, spearOriginalSpawn) {
    if (spearStateRef.state === 'stuck' && spearProjectile.mesh && spearProjectile.mesh.visible) {
        const pickupDistance = 0.6;
        const distance = player.position.distanceTo(spearProjectile.mesh.position);
        if (distance < pickupDistance) {
            console.log("Retrieved stuck spear!");
            triggerSceneFlicker(0xAAAAFF, 150); // Blue flicker

            spearStateRef.state = 'inventory'; // Back in inventory
            inventory.push('spear');
            spearProjectile.mesh.visible = false; // Hide the mesh
            updateUI();
            updateItemVisibility(worldData, player.userData.currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Pass player's current room
        }
    }
}

// Function to handle player picking up a respawned spear (called from item collision logic)
// Needs access to: spearState, inventory, updateUI, updateItemVisibility, worldData, currentRoomId, defeatedDragons, spearOriginalSpawn
function pickupRespawnedSpear(itemId, itemMesh, spearStateRef, inventory, updateUI, updateItemVisibility, worldData, currentRoomId, defeatedDragons, spearOriginalSpawn) {
     if (itemId === 'spear' && spearStateRef.state === 'respawned') {
         console.log("Picked up respawned spear!");
         triggerSceneFlicker(0xAAAAFF, 150); // Blue flicker

         spearStateRef.state = 'inventory'; // Back in inventory
         inventory.push('spear');
         itemMesh.visible = false; // Hide the mesh (passed from collision loop)
         updateUI();
         updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearStateRef.state, spearOriginalSpawn); // Ensure correct visibility states
         return true; // Indicate spear was picked up
     }
     return false; // Indicate spear was not the item picked up
}


export { SPEAR_SPEED, throwSpear, updateSpearProjectile, checkSpearRetrieval, pickupRespawnedSpear };