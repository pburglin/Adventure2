import * as THREE from 'three';
import { scene } from './sceneSetup.js';

// Ground Plane (representing a room)
const groundGeometry = new THREE.PlaneGeometry(10, 10); // Size of the room floor
// Initial color will be set in main.js based on the starting room
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
scene.add(ground);

// Door Visualization Setup
const doorGroup = new THREE.Group();
scene.add(doorGroup);
const doorColor = 0x8B4513; // Brown color for doors
const doorWidth = 2; // How wide the door visual is
const doorDepth = 0.2; // How thick the door visual is
const doorHeight = 0.01; // Slightly above the ground

// Function to create room visuals (doors and walls)
function createDoorVisuals(room) {
   // Clear existing doors and walls first
   while (doorGroup.children.length > 0) {
       doorGroup.remove(doorGroup.children[0]);
   }

   const roomSize = 10; // Must match groundGeometry size
   const halfRoomSize = roomSize / 2;
   const doorGeometryWidth = new THREE.PlaneGeometry(doorWidth, doorDepth);
   const doorGeometryDepth = new THREE.PlaneGeometry(doorDepth, doorWidth);
   const doorMaterial = new THREE.MeshStandardMaterial({ color: doorColor, side: THREE.DoubleSide });

   // North Door
   if (room.connections.north !== null) {
       const northDoor = new THREE.Mesh(doorGeometryWidth, doorMaterial);
       northDoor.rotation.x = -Math.PI / 2;
       northDoor.position.set(0, doorHeight, -halfRoomSize + doorDepth / 2);
       doorGroup.add(northDoor);
   }
   // South Door
   if (room.connections.south !== null) {
       const southDoor = new THREE.Mesh(doorGeometryWidth, doorMaterial);
       southDoor.rotation.x = -Math.PI / 2;
       southDoor.position.set(0, doorHeight, halfRoomSize - doorDepth / 2);
       doorGroup.add(southDoor);
   }
   // East Door
   if (room.connections.east !== null) {
       const eastDoor = new THREE.Mesh(doorGeometryDepth, doorMaterial);
       eastDoor.rotation.x = -Math.PI / 2;
       eastDoor.position.set(halfRoomSize - doorDepth / 2, doorHeight, 0);
       doorGroup.add(eastDoor);
   }
   // West Door
   if (room.connections.west !== null) {
       const westDoor = new THREE.Mesh(doorGeometryDepth, doorMaterial);
       westDoor.rotation.x = -Math.PI / 2;
       westDoor.position.set(-halfRoomSize + doorDepth / 2, doorHeight, 0);
       doorGroup.add(westDoor);
   }

   // Create maze walls if they exist
   if (room.walls) {
       const wallMaterial = new THREE.MeshStandardMaterial({
           color: 0x666666,
           metalness: 0.3,
           roughness: 0.8
       });
       
       room.walls.forEach(wall => {
           const wallGeometry = new THREE.BoxGeometry(
               wall.size.width,
               wall.size.height,
               wall.size.depth
           );
           const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
           wallMesh.position.set(
               wall.position.x,
               wall.position.y,
               wall.position.z
           );
           wallMesh.receiveShadow = true;
           wallMesh.castShadow = true;
           doorGroup.add(wallMesh);
       });
   }
}

// Function to update the ground color
function updateGroundColor(color) {
    groundMaterial.color.setHex(color);
}

export { ground, groundMaterial, doorGroup, createDoorVisuals, updateGroundColor, doorWidth }; // Export doorWidth for transition logic