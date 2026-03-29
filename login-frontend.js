// login-frontend.js
(() => {
    let currentInput = "";
    const pinDisplay = document.getElementById('pin-display');
    const statusMsg = document.getElementById('login-status-msg');

    // 1. PIN Pad Clicks
    document.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.textContent;
            
            if (val === 'C') {
                currentInput = "";
                updateDisplay();
            } else if (val === '↵') {
                attemptLogin(currentInput);
            } else {
                if (currentInput.length < 10) { // Limit length for PINs
                    currentInput += val;
                    updateDisplay();
                }
            }
        });
    });

    function updateDisplay() {
        // Show a star for every digit typed
        pinDisplay.textContent = "*".repeat(currentInput.length);
    }

    // 2. MSR Card Swipe Listener (Keyboard Wedge)
    let swipeBuffer = "";
    let lastKeyTime = Date.now();
    
    const handleSwipe = (e) => {
        const currentTime = Date.now();
        if (currentTime - lastKeyTime > 50) swipeBuffer = ""; 
        
        if (e.key === 'Enter' && swipeBuffer.length > 5) {
            e.preventDefault(); 
            attemptLogin(swipeBuffer);
            swipeBuffer = "";
        } else if (e.key !== 'Enter') {
            swipeBuffer += e.key;
        }
        lastKeyTime = currentTime;
    };
    
    document.addEventListener('keydown', handleSwipe);

    // 3. Database Authentication
    async function attemptLogin(credential) {
        if (!credential) return;
        
        try {
            statusMsg.textContent = "Authenticating...";
            const user = await window.api.loginEmployee(credential);
            
            if (user) {
                // Success! Set global user and unlock OS
                window.currentUser = user; 
                document.removeEventListener('keydown', handleSwipe); // Cleanup
                window.unlockTerminal();
            } else {
                // Fail
                statusMsg.textContent = "Invalid PIN or Card.";
                statusMsg.style.color = "#E53935";
                currentInput = "";
                updateDisplay();
                
                setTimeout(() => {
                    statusMsg.textContent = "Enter PIN or Swipe Card";
                    statusMsg.style.color = "#888";
                }, 2000);
            }
        } catch (error) {
            console.error(error);
            statusMsg.textContent = "System Error.";
        }
    }
})();