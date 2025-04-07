# 3D Adventure Remake

A simple 3D adventure game built with JavaScript and the Three.js library, inspired by the Atari 2600 classic, "Adventure".

## Overview

This project recreates the core gameplay loop of "Adventure" in a 3D environment. Players navigate a series of interconnected rooms, collect items, battle dragons, and strive to return the enchanted Chalice to the Gold Castle.

You can try it online here: [https://adventure2b.netlify.app](https://adventure2b.netlify.app)

## Features

*   **3D World:** Explore a world rendered in 3D using Three.js.
*   **Room Navigation:** Move between distinct rooms using keyboard controls. Each room has a unique color.
*   **Item Collection:** Pick up key items like the Gold Key, Sword, and the Chalice by walking over them.
*   **Inventory System:** Keep track of collected items via a simple UI display.
*   **Dragon Encounters:** Face fearsome dragons (represented by colored cubes) that roam certain rooms and pursue the player.
*   **Combat:** Use the Sword to defeat dragons.
*   **Game Over Condition:** Getting caught by a dragon without the Sword ends the game.
*   **Win Condition:** Successfully bring the Chalice back to the starting room (Gold Castle Entrance).
*   **Locked Doors:** (Logic exists) Some connections might require specific items (like a key) to pass through.
*   **Visual Feedback:** The scene background flickers to indicate events like item pickups, dragon kills, player death, and winning the game.

## How to Play

1.  **Run the Game:** Simply open the `index.html` file in a modern web browser that supports ES Modules and WebGL.
2.  **Controls:**
    *   Use **WASD** or the **Arrow Keys** to move the player (yellow cube) around the current room.
3.  **Objective:**
    *   Explore the castle rooms.
    *   Find the **Sword** to defend yourself against dragons.
    *   Find the **Gold Key** (if needed for locked doors - currently implemented but not used in `world.js`).
    *   Locate the **Chalice** in the Throne Room.
    *   Avoid or defeat the **Dragons** (Yellow, Green, Red).
    *   Return the **Chalice** to the **Gold Castle Entrance** (the starting room) to win the game.

## Technology Stack

*   HTML5
*   CSS3
*   JavaScript (ES Modules)
*   Three.js (via CDN)

## Project Structure

*   `index.html`: The main HTML file that sets up the canvas and UI elements.
*   `style.css`: Basic styling for the UI.
*   `main.js`: Core game logic, including Three.js setup, rendering loop, player controls, collision detection, room transitions, and UI updates.
*   `world.js`: Defines the game world structure, including room layouts, connections, item definitions (positions, colors, types), and dragon placements.
*   `README.md`: This file.

## Potential Future Enhancements

*   Implement more complex mazes (Blue, Black, White Castles).
*   Add more items (Bridge, Magnet).
*   Implement actual locked doors requiring keys.
*   Add sound effects and background music.
*   Improve 3D models for player, items, and dragons.
*   Refine dragon AI and movement.
