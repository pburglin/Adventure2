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

    // --- NEW: Update Spear Touch Button Visibility ---
    const touchSpearButton = document.getElementById('touch-spear');
    // Only try to update if the button exists (i.e., touch controls were initialized)
    if (touchSpearButton) {
        const hasSpear = inventory.includes('spear');
        if (hasSpear) {
            touchSpearButton.classList.remove('hidden');
            // console.log("UI Update: Showing spear button");
        } else {
            touchSpearButton.classList.add('hidden');
            // console.log("UI Update: Hiding spear button");
        }
    }
    // --- End Spear Touch Button Visibility ---

    // Note: gameMessageElement is updated directly in main.js for win/lose conditions
}

export { roomNameElement, inventoryElement, gameMessageElement, updateUI };