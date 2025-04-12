// UI Element References
const roomNameElement = document.getElementById('room-name');
const inventoryElement = document.getElementById('inventory');
const gameMessageElement = document.getElementById('game-message');

// UI Update Function
// Needs access to: currentRoom, inventory
function updateUI(currentRoom, inventory) {
    if (roomNameElement) {
        roomNameElement.textContent = `Room: ${currentRoom.name}`;
    }
    if (inventoryElement) {
        const inventoryText = inventory.length > 0 ? inventory.join(', ') : 'Empty';
        inventoryElement.textContent = `Inventory: ${inventoryText}`;
    }
    // Note: gameMessageElement is updated directly in main.js for win/lose conditions
}

export { roomNameElement, inventoryElement, gameMessageElement, updateUI };