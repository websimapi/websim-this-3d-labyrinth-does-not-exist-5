let keys = {};
let touchId = null;
let moveJoystickActive = false;
let lookJoystickActive = false;
let moveJoystickPos = { x: 0, y: 0 };
let lookJoystickPos = { x: 0, y: 0 };
let moveJoystickElement, moveJoystickHandle;
let lookJoystickElement, lookJoystickHandle;
let moveStartPos = { x: 0, y: 0 };
let lookStartPos = { x: 0, y: 0 };
const moveSensitivity = 0.1;
const lookSensitivity = 0.003;
let isMobile = window.innerWidth < 768;

// Setup keyboard controls
function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', () => {
        document.body.requestPointerLock();
    });
}

// Setup mobile controls
function setupMobileControls() {
    moveJoystickElement = document.getElementById('moveJoystick');
    moveJoystickHandle = moveJoystickElement.querySelector('.joystick-handle');
    lookJoystickElement = document.getElementById('lookJoystick');
    lookJoystickHandle = lookJoystickElement.querySelector('.joystick-handle');
    
    // Move joystick
    moveJoystickElement.addEventListener('touchstart', handleMoveJoystickStart);
    moveJoystickElement.addEventListener('touchmove', handleMoveJoystickMove);
    moveJoystickElement.addEventListener('touchend', handleMoveJoystickEnd);
    
    // Look joystick
    lookJoystickElement.addEventListener('touchstart', handleLookJoystickStart);
    lookJoystickElement.addEventListener('touchmove', handleLookJoystickMove);
    lookJoystickElement.addEventListener('touchend', handleLookJoystickEnd);
}

// Move joystick handlers
function handleMoveJoystickStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = moveJoystickElement.getBoundingClientRect();
    
    moveStartPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
    
    moveJoystickActive = true;
    moveJoystickPos = { x: 0, y: 0 };
    updateJoystickPosition(moveJoystickHandle, 0, 0);
}

function handleMoveJoystickMove(event) {
    if (!moveJoystickActive) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    let dx = touch.clientX - moveStartPos.x;
    let dy = touch.clientY - moveStartPos.y;
    
    // Limit joystick movement to circle
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = moveJoystickElement.offsetWidth / 2.5;
    
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    moveJoystickPos = {
        x: dx / maxDistance,
        y: dy / maxDistance
    };
    
    updateJoystickPosition(moveJoystickHandle, dx, dy);
}

function handleMoveJoystickEnd(event) {
    event.preventDefault();
    moveJoystickActive = false;
    moveJoystickPos = { x: 0, y: 0 };
    updateJoystickPosition(moveJoystickHandle, 0, 0);
}

// Look joystick handlers
function handleLookJoystickStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = lookJoystickElement.getBoundingClientRect();
    
    lookStartPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
    
    lookJoystickActive = true;
    lookJoystickPos = { x: 0, y: 0 };
    updateJoystickPosition(lookJoystickHandle, 0, 0);
}

function handleLookJoystickMove(event) {
    if (!lookJoystickActive) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    let dx = touch.clientX - lookStartPos.x;
    let dy = touch.clientY - lookStartPos.y;
    
    // Limit joystick movement to circle
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = lookJoystickElement.offsetWidth / 2.5;
    
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    lookJoystickPos = {
        x: dx / maxDistance,
        y: dy / maxDistance
    };
    
    updateJoystickPosition(lookJoystickHandle, dx, dy);
    
    // Rotate player based on look joystick
    window.rotatePlayer(lookJoystickPos.x * 0.05);
}

function handleLookJoystickEnd(event) {
    event.preventDefault();
    lookJoystickActive = false;
    lookJoystickPos = { x: 0, y: 0 };
    updateJoystickPosition(lookJoystickHandle, 0, 0);
}

// Update joystick visual position
function updateJoystickPosition(handle, dx, dy) {
    handle.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
}

// Handle mouse look
function handleMouseMove(event) {
    if (document.pointerLockElement) {
        const movementX = event.movementX || 0;
        window.rotatePlayer(movementX * lookSensitivity);
    }
}

// Update controls
function updateControls() {
    if (!window.getPlayerDirection) return;
    
    const playerDirection = window.getPlayerDirection();
    const moveSpeed = 0.15;
    
    let forward = 0;
    let right = 0;
    
    // Keyboard controls
    if (keys['KeyW'] || keys['ArrowUp']) forward = 1;
    if (keys['KeyS'] || keys['ArrowDown']) forward = -1;
    if (keys['KeyD'] || keys['ArrowRight']) right = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) right = -1;
    
    // Mobile controls
    if (moveJoystickActive) {
        forward = -moveJoystickPos.y;
        right = moveJoystickPos.x;
    }
    
    // Calculate movement vector
    const moveZ = forward * moveSpeed;
    const moveX = right * moveSpeed;
    
    // Apply movement relative to camera direction
    const angle = Math.atan2(playerDirection.x, playerDirection.z);
    const vx = moveX * Math.cos(angle) - moveZ * Math.sin(angle);
    const vz = moveX * Math.sin(angle) + moveZ * Math.cos(angle);
    
    window.setPlayerVelocity(vx, vz);
}

// Setup controls based on device
function setupControls() {
    setupKeyboardControls();
    if (isMobile) {
        setupMobileControls();
        // Show mobile controls
        document.querySelector('.mobile-controls').style.display = 'flex';
    } else {
        // Hide mobile controls
        document.querySelector('.mobile-controls').style.display = 'none';
    }
    
    // Update controls every frame
    function animateControls() {
        updateControls();
        requestAnimationFrame(animateControls);
    }
    
    animateControls();
}

// Initialize controls when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to make sure other scripts are loaded
    setTimeout(setupControls, 1000);
    
    // Update mobile status on resize
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        if (isMobile) {
            document.querySelector('.mobile-controls').style.display = 'flex';
        } else {
            document.querySelector('.mobile-controls').style.display = 'none';
        }
    });
});

