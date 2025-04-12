import * as THREE from 'three';
import { scene } from './sceneSetup.js';
import { itemMeshes, updateItemVisibility } from './items.js'; // Need itemMeshes, updateItemVisibility
import { player } from './player.js'; // Need player reference

// Bird Constants
const BIRD_SPEED = 0.08;
const BIRD_WING_SPEED = 0.05;
const BIRD_WING_MAX_ANGLE = Math.PI / 4; // 45 degrees flap
const BIRD_Y_POSITION = 0.75; // How high the bird flies
const BIRD_SPAWN_CHANCE = 0.1; // 10% chance

// Bird NPC State (managed externally, passed as reference)
// let bird = { ... };

// --- Bird Mesh Creation ---
function createBirdMesh(birdRef) { // Pass birdRef to store mesh
    const birdGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.8); // Longer body
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB }); // Sky blue
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    birdGroup.add(bodyMesh);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.3); // Wider, thinner wings
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xADD8E6 }); // Light blue

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.5, 0, 0);
    leftWing.geometry.translate(0.4, 0, 0); // Pivot
    birdGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.5, 0, 0);
    rightWing.geometry.translate(-0.4, 0, 0); // Pivot
    birdGroup.add(rightWing);

    birdGroup.position.y = BIRD_Y_POSITION;
    birdGroup.visible = false; // Start hidden
    scene.add(birdGroup);

    // Store references for animation in the passed bird object
    birdRef.mesh = birdGroup;
    birdRef.mesh.userData.leftWing = leftWing;
    birdRef.mesh.userData.rightWing = rightWing;
}
// --- End Bird Mesh Creation ---

// --- Bird Sequence Setup Function ---
// Needs access to: bird, worldData, inventory, defeatedDragons, itemMeshes, player
function startBirdSequence(birdRef, worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn) {
    if (birdRef.active) return; // Don't start if already active

    const roomSize = 10;
    const halfRoomSize = roomSize / 2;
    const edgeOffset = 1.5;

    // 1. Decide Action
    const movableObjectsInRoom = worldData.items.filter(item =>
        item.currentRoomId === currentRoomId &&
        !inventory.includes(item.id) &&
        !defeatedDragons.has(item.id) &&
        item.id !== 'spear'
    );
    const canTakePlayer = true;
    const canTake = movableObjectsInRoom.length > 0 || canTakePlayer;

    const movableObjectsOutsideRoom = worldData.items.filter(item =>
        item.currentRoomId !== currentRoomId &&
        item.currentRoomId !== null &&
        !defeatedDragons.has(item.id) &&
        item.id !== 'spear'
    );
    const canBring = movableObjectsOutsideRoom.length > 0;

    if (canTake && (!canBring || Math.random() < 0.5)) {
        birdRef.action = 'take';
    } else if (canBring) {
        birdRef.action = 'bring';
    } else {
        console.log("Bird decided not to act (no valid targets).");
        return;
    }
    console.log(`Bird action: ${birdRef.action}`);

    // 2. Select Target Object
    if (birdRef.action === 'take') {
        const potentialTargets = [...movableObjectsInRoom];
        if (canTakePlayer) {
            potentialTargets.push({ id: 'player', type: 'player', isDragon: false });
        }
        if (potentialTargets.length === 0) { console.log("Bird wanted to take, but found no targets."); return; }
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        if (target.id === 'player') {
            birdRef.targetObject = player; // Reference player mesh
            birdRef.targetObjectId = null;
            birdRef.targetObjectType = 'player';
        } else {
            birdRef.targetObject = itemMeshes.get(target.id);
            birdRef.targetObjectId = target.id;
            birdRef.targetObjectType = target.isDragon ? 'dragon' : 'item';
            if (birdRef.targetObject) birdRef.targetObject.visible = false; // Hide until pickup
            else console.warn(`Bird couldn't find mesh for item to take: ${target.id}`);
        }
    } else { // 'bring'
        if (movableObjectsOutsideRoom.length === 0) { console.log("Bird wanted to bring, but found no targets."); return; }
        const targetItemData = movableObjectsOutsideRoom[Math.floor(Math.random() * movableObjectsOutsideRoom.length)];
        birdRef.targetObject = itemMeshes.get(targetItemData.id);
        birdRef.targetObjectId = targetItemData.id;
        birdRef.targetObjectType = targetItemData.isDragon ? 'dragon' : 'item';
        if (birdRef.targetObject) birdRef.targetObject.visible = true; // Ensure visible
        else console.warn(`Bird couldn't find mesh for item to bring: ${targetItemData.id}`);
    }

    if (!birdRef.targetObject && birdRef.targetObjectType !== 'player') {
        console.error("Bird failed to find target mesh for ID:", birdRef.targetObjectId, " - Aborting sequence.");
        birdRef.action = null; return;
    }
    console.log(`Bird target: ${birdRef.targetObjectType} ${birdRef.targetObjectId || '(player)'}`);

    // 3. Determine Start and End Positions
    const edges = ['north', 'south', 'east', 'west'];
    const startEdgeIndex = Math.floor(Math.random() * 4);
    let endEdgeIndex = (startEdgeIndex + 2) % 4;
    const randomOffsetStart = (Math.random() - 0.5) * (roomSize - edgeOffset * 2);
    const randomOffsetEnd = (Math.random() - 0.5) * (roomSize - edgeOffset * 2);

    switch (edges[startEdgeIndex]) {
        case 'north': birdRef.startPos.set(randomOffsetStart, BIRD_Y_POSITION, -halfRoomSize - edgeOffset); break;
        case 'south': birdRef.startPos.set(randomOffsetStart, BIRD_Y_POSITION, halfRoomSize + edgeOffset); break;
        case 'east': birdRef.startPos.set(halfRoomSize + edgeOffset, BIRD_Y_POSITION, randomOffsetStart); break;
        case 'west': birdRef.startPos.set(-halfRoomSize - edgeOffset, BIRD_Y_POSITION, randomOffsetStart); break;
    }
    switch (edges[endEdgeIndex]) {
        case 'north': birdRef.endPos.set(randomOffsetEnd, BIRD_Y_POSITION, -halfRoomSize - edgeOffset); break;
        case 'south': birdRef.endPos.set(randomOffsetEnd, BIRD_Y_POSITION, halfRoomSize + edgeOffset); break;
        case 'east': birdRef.endPos.set(halfRoomSize + edgeOffset, BIRD_Y_POSITION, randomOffsetEnd); break;
        case 'west': birdRef.endPos.set(-halfRoomSize - edgeOffset, BIRD_Y_POSITION, randomOffsetEnd); break;
    }

    // 4. Set Bird State
    birdRef.mesh.position.copy(birdRef.startPos);
    birdRef.velocity.subVectors(birdRef.endPos, birdRef.startPos).normalize().multiplyScalar(BIRD_SPEED);
    const lookAtTarget = new THREE.Vector3(birdRef.endPos.x, BIRD_Y_POSITION - 1, birdRef.endPos.z);
    birdRef.mesh.lookAt(lookAtTarget);
    birdRef.mesh.visible = true;
    birdRef.active = true;
    birdRef.state = 'entering';
    birdRef.wingAngle = 0;
    birdRef.wingDirection = 1;
    console.log(`Bird starting at (${birdRef.startPos.x.toFixed(1)}, ${birdRef.startPos.z.toFixed(1)}), ending at (${birdRef.endPos.x.toFixed(1)}, ${birdRef.endPos.z.toFixed(1)})`);

    // If bringing an object, attach it visually now
    if (birdRef.action === 'bring' && birdRef.targetObject) {
        const targetMesh = itemMeshes.get(birdRef.targetObjectId);
        if (targetMesh) {
            targetMesh.position.copy(birdRef.mesh.position);
            targetMesh.position.y = BIRD_Y_POSITION - 0.5;
            targetMesh.visible = true;
        }
    }
}
// --- End Bird Sequence Setup Function ---

// --- Bird Animation Update Function ---
// Needs access to: bird, player, itemMeshes, worldData, currentRoomId, updateItemVisibility, defeatedDragons, spearState, spearOriginalSpawn
function updateBirdAnimation(birdRef, worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn) {
    if (!birdRef.active) return;

    // Move bird
    birdRef.mesh.position.add(birdRef.velocity);

    // Animate wings
    birdRef.wingAngle += birdRef.wingDirection * BIRD_WING_SPEED;
    if (Math.abs(birdRef.wingAngle) > BIRD_WING_MAX_ANGLE) {
        birdRef.wingDirection *= -1;
        birdRef.wingAngle = birdRef.wingDirection * BIRD_WING_MAX_ANGLE;
    }
    birdRef.mesh.userData.leftWing.rotation.z = birdRef.wingAngle;
    birdRef.mesh.userData.rightWing.rotation.z = -birdRef.wingAngle;

    // Attach carried object visually
    if (birdRef.targetObject) {
        const targetY = BIRD_Y_POSITION - 0.5; // Slightly below bird
        if (birdRef.targetObjectType === 'player') {
            player.position.copy(birdRef.mesh.position);
            player.position.y = targetY;
        } else {
            const targetMesh = itemMeshes.get(birdRef.targetObjectId);
            if (targetMesh) {
                targetMesh.position.copy(birdRef.mesh.position);
                targetMesh.position.y = targetY;
            }
        }
    }

    // Check state transitions
    const distanceToEnd = birdRef.mesh.position.distanceTo(birdRef.endPos);
    const distanceToCenter = birdRef.mesh.position.length(); // Approx distance to center
    const centerThreshold = 7;

    // State transitions and actions
    if (birdRef.state === 'entering' && distanceToCenter < centerThreshold) {
        console.log("Bird reached center area");
        if (birdRef.action === 'take') {
            console.log(`Bird picking up ${birdRef.targetObjectType}: ${birdRef.targetObjectId || 'player'}`);
            if (birdRef.targetObjectType !== 'player') {
                const targetMesh = itemMeshes.get(birdRef.targetObjectId);
                if (targetMesh) targetMesh.visible = true; // Ensure visible while carried
            }
            birdRef.state = 'crossing';
        } else { // 'bring' action
            console.log(`Bird dropping ${birdRef.targetObjectType}: ${birdRef.targetObjectId || 'player'}`);
            if (birdRef.targetObject) {
                const targetItemData = worldData.items.find(item => item.id === birdRef.targetObjectId);
                const dropPosition = new THREE.Vector3(
                    (Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8
                );

                if (birdRef.targetObjectType === 'player') {
                    player.position.set(dropPosition.x, 0.25, dropPosition.z);
                    console.log(`Player dropped at (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)})`);
                } else if (targetItemData) {
                    const targetMesh = itemMeshes.get(birdRef.targetObjectId);
                    const dropY = targetItemData.isDragon ? 0.4 : 0.2;
                    if (targetMesh) {
                        targetMesh.position.set(dropPosition.x, dropY, dropPosition.z);
                        targetMesh.visible = true;
                    }
                    targetItemData.currentRoomId = currentRoomId;
                    targetItemData.position.x = dropPosition.x;
                    targetItemData.position.y = dropY;
                    targetItemData.position.z = dropPosition.z;
                    console.log(`${birdRef.targetObjectId} dropped at (${targetItemData.position.x.toFixed(1)}, ${targetItemData.position.z.toFixed(1)}) in room ${currentRoomId}`);
                }
                birdRef.targetObject = null;
                birdRef.targetObjectId = null;
                birdRef.targetObjectType = null;
                updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn);
            }
            birdRef.state = 'crossing';
        }
    } else if (distanceToEnd < 1.0) { // Reached exit edge
        console.log("Bird reached exit edge");
        birdRef.state = 'exiting';
        birdRef.active = false;
        birdRef.mesh.visible = false;

        if (birdRef.action === 'take' && birdRef.targetObject) {
             const targetItemData = worldData.items.find(item => item.id === birdRef.targetObjectId);

             if (birdRef.targetObjectType === 'player') {
                 console.log("Bird took player - position will be randomized on room entry");
                 const possibleRooms = worldData.rooms.filter(r => r.id !== currentRoomId);
                 if (possibleRooms.length > 0) {
                     const targetRoomId = possibleRooms[Math.floor(Math.random() * possibleRooms.length)].id;
                     player.userData.forceNextRoomId = targetRoomId; // Flag for main loop transition logic
                     console.log(`Player will be moved to room ${targetRoomId}`);
                 } else {
                     console.log("Bird couldn't find another room to take the player to.");
                     player.position.set(0, 0.25, 0); // Drop back at center
                 }
             } else if (targetItemData) {
                const possibleRooms = worldData.rooms.filter(r => r.id !== currentRoomId);
                if (possibleRooms.length > 0) {
                    const targetRoom = possibleRooms[Math.floor(Math.random() * possibleRooms.length)];
                    targetItemData.currentRoomId = targetRoom.id;
                    targetItemData.position.x = 0;
                    targetItemData.position.y = targetItemData.isDragon ? 0.4 : 0.2;
                    targetItemData.position.z = 0;
                    console.log(`${birdRef.targetObjectId} taken by bird to room ${targetRoom.id}`);
                    updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn); // Hide item from current room
                } else {
                     console.log("Bird couldn't find another room to take the item to.");
                     targetItemData.currentRoomId = null; // Remove from world state? Or drop back?
                     updateItemVisibility(worldData, currentRoomId, inventory, defeatedDragons, spearState, spearOriginalSpawn);
                }
             }
        }

        // Reset bird state fully
        birdRef.targetObject = null;
        birdRef.targetObjectId = null;
        birdRef.targetObjectType = null;
        birdRef.action = null;
        birdRef.state = 'inactive';
    }
}
// --- End Bird Animation Update Function ---

export { BIRD_SPAWN_CHANCE, createBirdMesh, startBirdSequence, updateBirdAnimation };