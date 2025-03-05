import * as THREE from 'three';

let scene, camera, renderer;
let labyrinthMesh, wallTexture;
let mazeSize = 15;
let cellSize = 5;
let wallHeight = 4;
let playerHeight = 2;
let playerPosition = new THREE.Vector3(cellSize / 2, playerHeight, cellSize / 2);
let playerVelocity = new THREE.Vector3();
let playerDirection = new THREE.Vector3(0, 0, 1);
let maze = [];
let wallMaterial;
let floorMaterial;
let isMobile = window.innerWidth < 768;
let playerCollider;
let rooms = [];

// Setup
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.FogExp2(0x000000, 0.05);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.copy(playerPosition);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 20, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    // Player collider
    playerCollider = new THREE.Sphere(playerPosition, 0.5);
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

// Generate maze using recursive backtracking
function generateMaze(size) {
    // Initialize maze with walls
    maze = Array(size).fill().map(() => Array(size).fill(1));
    
    // Define directions: right, down, left, up
    const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0]
    ];
    
    function carve(x, y) {
        maze[x][y] = 0; // Mark as path
        
        // Shuffle directions
        const shuffledDirections = [...directions].sort(() => Math.random() - 0.5);
        
        for (let [dx, dy] of shuffledDirections) {
            const nx = x + dx * 2;
            const ny = y + dy * 2;
            
            if (nx >= 0 && nx < size && ny >= 0 && ny < size && maze[nx][ny] === 1) {
                maze[x + dx][y + dy] = 0; // Carve passage
                carve(nx, ny); // Recursive call
            }
        }
    }
    
    // Start from a random position
    const startX = Math.floor(Math.random() * Math.floor(size / 2)) * 2 + 1;
    const startY = Math.floor(Math.random() * Math.floor(size / 2)) * 2 + 1;
    carve(startX, startY);
    
    // Add some rooms for variety
    addRooms(size, 3, 5);
    
    // Ensure start position is open
    maze[1][1] = 0;
    
    return maze;
}

// Add random rooms to the maze
function addRooms(size, count, maxSize) {
    rooms = [];
    for (let i = 0; i < count; i++) {
        const roomWidth = Math.floor(Math.random() * (maxSize - 3)) + 3;
        const roomHeight = Math.floor(Math.random() * (maxSize - 3)) + 3;
        const x = Math.floor(Math.random() * (size - roomWidth - 2)) + 1;
        const y = Math.floor(Math.random() * (size - roomHeight - 2)) + 1;
        
        // Carve out the room
        for (let rx = x; rx < x + roomWidth; rx++) {
            for (let ry = y; ry < y + roomHeight; ry++) {
                if (rx < size && ry < size) {
                    maze[rx][ry] = 0;
                }
            }
        }
        
        rooms.push({ x, y, width: roomWidth, height: roomHeight });
    }
}

// Build the 3D labyrinth from the maze array
function buildLabyrinth() {
    const geometry = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    
    // Create labyrinth group
    labyrinthMesh = new THREE.Group();
    
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(mazeSize * cellSize, mazeSize * cellSize);
    floorGeometry.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set((mazeSize * cellSize) / 2 - cellSize / 2, 0, (mazeSize * cellSize) / 2 - cellSize / 2);
    floor.receiveShadow = true;
    labyrinthMesh.add(floor);
    
    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(mazeSize * cellSize, mazeSize * cellSize);
    ceilingGeometry.rotateX(Math.PI / 2);
    const ceiling = new THREE.Mesh(ceilingGeometry, floorMaterial);
    ceiling.position.set((mazeSize * cellSize) / 2 - cellSize / 2, wallHeight, (mazeSize * cellSize) / 2 - cellSize / 2);
    labyrinthMesh.add(ceiling);
    
    // Walls
    for (let x = 0; x < mazeSize; x++) {
        for (let z = 0; z < mazeSize; z++) {
            if (maze[x][z] === 1) {
                const wall = new THREE.Mesh(geometry, wallMaterial);
                wall.position.set(x * cellSize, wallHeight / 2, z * cellSize);
                wall.castShadow = true;
                wall.receiveShadow = true;
                labyrinthMesh.add(wall);
            }
        }
    }
    
    // Add point lights in rooms
    rooms.forEach(room => {
        const x = room.x * cellSize + (room.width * cellSize) / 2;
        const z = room.y * cellSize + (room.height * cellSize) / 2;
        
        const pointLight = new THREE.PointLight(0xffaa00, 1, 20);
        pointLight.position.set(x, wallHeight * 0.8, z);
        pointLight.castShadow = true;
        labyrinthMesh.add(pointLight);
        
        // Add a glowing sphere to represent the light
        const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(pointLight.position);
        labyrinthMesh.add(sphere);
    });
    
    scene.add(labyrinthMesh);
}

// Find a random open position in the maze
function findRandomOpenPosition() {
    let x, z;
    do {
        x = Math.floor(Math.random() * (mazeSize - 2)) + 1;
        z = Math.floor(Math.random() * (mazeSize - 2)) + 1;
    } while (maze[x][z] !== 0);
    
    return new THREE.Vector3(x * cellSize + cellSize / 2, playerHeight, z * cellSize + cellSize / 2);
}

// Check for collisions with walls
function checkCollisions() {
    const position = playerPosition.clone();
    const radius = playerCollider.radius;
    
    // Calculate maze coordinates
    const mazeX = Math.floor(position.x / cellSize);
    const mazeZ = Math.floor(position.z / cellSize);
    
    // Check adjacent cells for walls
    for (let x = Math.max(0, mazeX - 1); x <= Math.min(mazeSize - 1, mazeX + 1); x++) {
        for (let z = Math.max(0, mazeZ - 1); z <= Math.min(mazeSize - 1, mazeZ + 1); z++) {
            if (maze[x][z] === 1) {
                // Wall cell center
                const wallCenter = new THREE.Vector3(
                    x * cellSize + cellSize / 2,
                    position.y,
                    z * cellSize + cellSize / 2
                );
                
                // Box center to player vector
                const boxToPlayer = new THREE.Vector3().subVectors(position, wallCenter);
                
                // Calculate closest point on box to player
                const closestPoint = new THREE.Vector3(
                    Math.max(Math.min(boxToPlayer.x, cellSize / 2), -cellSize / 2),
                    0,
                    Math.max(Math.min(boxToPlayer.z, cellSize / 2), -cellSize / 2)
                );
                
                // Add box center to get world coordinates
                closestPoint.add(wallCenter);
                
                // Calculate distance from closest point to player
                const distance = position.distanceTo(closestPoint);
                
                // If distance is less than player radius, collision occurred
                if (distance < radius) {
                    // Calculate push direction
                    const pushDir = new THREE.Vector3().subVectors(position, closestPoint).normalize();
                    const pushAmount = radius - distance;
                    
                    // Push player away from wall
                    position.addScaledVector(pushDir, pushAmount);
                }
            }
        }
    }
    
    // Update player position after collision checks
    playerPosition.copy(position);
    playerCollider.center.copy(position);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    isMobile = window.innerWidth < 768;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update player position
    playerPosition.add(playerVelocity);
    
    // Check for collisions
    checkCollisions();
    
    // Update camera position and rotation
    camera.position.copy(playerPosition);
    camera.lookAt(
        playerPosition.x + playerDirection.x,
        playerPosition.y,
        playerPosition.z + playerDirection.z
    );
    
    // Slowly reduce velocity (friction)
    playerVelocity.multiplyScalar(0.9);
    
    renderer.render(scene, camera);
}

// Generate a new labyrinth
window.generateLabyrinth = function(labyrinthData) {
    // Remove previous labyrinth if exists
    if (labyrinthMesh) {
        scene.remove(labyrinthMesh);
        labyrinthMesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    // Check if scene exists, if not initialize
    if (!scene) {
        init();
    }
    
    // Generate new maze
    mazeSize = labyrinthData.difficulty === 'easy' ? 15 : 
               labyrinthData.difficulty === 'medium' ? 25 : 35;
    
    maze = generateMaze(mazeSize);
    
    // Create textures from SVG data
    if (labyrinthData.wallTexture) {
        // Create wall texture from SVG
        const loader = new THREE.TextureLoader();
        wallTexture = loader.load(labyrinthData.wallTexture);
        wallTexture.wrapS = THREE.RepeatWrapping;
        wallTexture.wrapT = THREE.RepeatWrapping;
        wallTexture.repeat.set(1, 1);
        
        // Wall material with the generated texture
        wallMaterial = new THREE.MeshStandardMaterial({
            map: wallTexture,
            roughness: 0.7,
            metalness: 0.2
        });
        
        // Floor material based on biome
        const floorColor = getFloorColorForBiome(labyrinthData.biome);
        floorMaterial = new THREE.MeshStandardMaterial({
            color: floorColor,
            roughness: 0.9,
            metalness: 0.1
        });
    } else {
        // Fallback materials if texture generation failed
        wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.7,
            metalness: 0.2
        });
        
        floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            metalness: 0.1
        });
    }
    
    // Build the labyrinth in 3D
    buildLabyrinth();
    
    // Reset player position
    playerPosition = findRandomOpenPosition();
    playerCollider.center.copy(playerPosition);
    playerVelocity.set(0, 0, 0);
    
    // Adjust fog based on mood
    if (labyrinthData.mood) {
        const mood = labyrinthData.mood.toLowerCase();
        if (mood.includes('eerie') || mood.includes('spooky') || mood.includes('mysterious')) {
            scene.fog = new THREE.FogExp2(0x000000, 0.08);
        } else if (mood.includes('bright') || mood.includes('sunny') || mood.includes('clear')) {
            scene.fog = new THREE.FogExp2(0x000000, 0.02);
        } else {
            scene.fog = new THREE.FogExp2(0x000000, 0.05);
        }
    }
    
    // Update description visibility
    const descriptionElement = document.querySelector('.labyrinth-description');
    if (descriptionElement) {
        descriptionElement.classList.add('visible');
    }
};

// Get floor color based on biome
function getFloorColorForBiome(biome) {
    if (!biome) return 0x555555;
    
    biome = biome.toLowerCase();
    
    if (biome.includes('desert')) return 0xd2b48c;
    if (biome.includes('jungle') || biome.includes('forest')) return 0x4c7f46;
    if (biome.includes('arctic') || biome.includes('snow')) return 0xe6e6fa;
    if (biome.includes('volcanic') || biome.includes('lava')) return 0x800000;
    if (biome.includes('ocean') || biome.includes('sea')) return 0x1e90ff;
    if (biome.includes('cave')) return 0x696969;
    if (biome.includes('swamp') || biome.includes('marsh')) return 0x6b8e23;
    if (biome.includes('mountain')) return 0x808080;
    if (biome.includes('crystal') || biome.includes('gem')) return 0xadd8e6;
    
    // Default
    return 0x555555;
}

// Make functions available globally for controls.js
window.getPlayerPosition = function() {
    return playerPosition;
};

window.getPlayerDirection = function() {
    return playerDirection;
};

window.setPlayerVelocity = function(vx, vz) {
    playerVelocity.x = vx;
    playerVelocity.z = vz;
};

window.rotatePlayer = function(angleY) {
    const rotation = new THREE.Quaternion();
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
    playerDirection.applyQuaternion(rotation);
};

export { init, animate, playerPosition, playerDirection, playerVelocity };

