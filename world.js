// Define the layout of the game world
// Each room has an ID, a color, and connections (north, south, east, west)
// Connections are represented by the ID of the connected room, or null if there's no connection.

export const worldData = {
    rooms: [
        { id: 0, name: "Gold Castle Entrance", color: 0xAAAAAA, connections: { north: 1, south: null, east: null, west: null }, winConditionItem: 'chalice' }, // Locked by Gold Key
        { id: 1, name: "Main Hall", color: 0xBBBBBB, connections: { north: { lockedBy: 'gold_key', roomId: 2 }, south: 0, east: 3, west: 4 } },
        { id: 2, name: "Throne Room", color: 0xFFFFE0, connections: { north: null, south: 1, east: null, west: null } }, // Simplified maze for now
        { id: 3, name: "East Wing", color: 0xCCCCCC, connections: { north: null, south: null, east: 5, west: 1 } }, // Connect East Wing to Throne Room
        { id: 4, name: "West Wing", color: 0xDDDDDD, connections: { north: null, south: null, east: 1, west: null } },
        { id: 5, name: "Blue Maze 1", color: 0x0000FF, connections: { north: null, south: null, east: null, west: 3 } }, // New room
        // Add more rooms later (Black Castle, White Castle, mazes, etc.)
    ],
    items: [
        { id: 'gold_key', name: "Gold Key", color: 0xFFD700, currentRoomId: 3, position: { x: 2, y: 0.2, z: -2 } }, // Location can change
        { id: 'chalice', name: "Chalice", color: 0xC0C0C0, currentRoomId: 2, position: { x: 0, y: 0.25, z: 0 } }, // Location can change
        { id: 'spear', name: "Spear", color: 0xAAAAFF, currentRoomId: 4, position: { x: -2, y: 0.25, z: 2 } }, // Location can change (but also has special respawn)
        { id: 'dragon_yorgle', name: "Yorgle (Yellow Dragon)", color: 0xFFFF00, currentRoomId: 1, position: { x: -2, y: 0.5, z: 0 }, isDragon: true }, // Location can change
        { id: 'dragon_grundle', name: "Grundle (Green Dragon)", color: 0x00FF00, currentRoomId: 3, position: { x: 0, y: 0.5, z: 0 }, isDragon: true }, // Location can change
        { id: 'dragon_rhindle', name: "Rhindle (Red Dragon)", color: 0xFF0000, currentRoomId: 2, position: { x: 0, y: 0.5, z: 0 }, isDragon: true }, // Location can change
        // Add more items later (bridge, magnet, etc.)
    ],
    startRoomId: 0,
};

export function getRoomById(id) {
    return worldData.rooms.find(room => room.id === id);
}