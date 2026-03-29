// ==========================================
// --- 1. SYSTEM CONSTANTS & CLOCK ---
// ==========================================
const systemApplets = [
    { id: 'register', name: 'Register', style: 'app-register' },
    { id: 'profile', name: 'Profile / Time Clock', style: 'app-profile' },
    { id: 'inventory', name: 'Inventory', style: 'app-inventory' },
    { id: 'customers', name: 'Customers & Loyalty', style: 'app-customers' },
    { id: 'settings', name: 'Settings', style: 'app-settings' }
];

function updateClock() {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    
    const timeEl = document.getElementById('sys-time');
    const dateEl = document.getElementById('sys-date');

    // Only update the text if the elements actually exist on the screen!
    if (timeEl) timeEl.textContent = now.toLocaleTimeString([], timeOptions);
    if (dateEl) dateEl.textContent = now.toLocaleDateString([], dateOptions);
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// --- 2. SECURITY & BOOT STATE ---
// ==========================================
window.currentUser = null;

window.lockTerminal = function() {
    window.currentUser = null;
    document.getElementById('global-nav').style.display = 'none';
    const container = document.getElementById('applet-container');
    container.innerHTML = ''; 
    loadAppletView('login');
};

window.unlockTerminal = function() {
    console.log("Logged in as:", window.currentUser.first_name);
    document.getElementById('global-nav').style.display = 'flex';
    renderHomeDashboard();
};

// OSK Target Variable (Declared high so navigation functions can access it)
let activeInput = null;

// ==========================================
// --- 3. APPLET INJECTION LOGIC ---
// ==========================================
async function loadAppletView(appletId) {
    // CLEANUP: Prevent Detached Focus AND wipe OSK memory
    if (document.activeElement) document.activeElement.blur();
    const osk = document.getElementById('virtual-keyboard');
    if (osk) osk.classList.add('osk-hidden');
    if (typeof activeInput !== 'undefined') activeInput = null;

    const container = document.getElementById('applet-container');

    try {
        const response = await fetch(`${appletId}-applet.html`);
        if (!response.ok) throw new Error("Applet HTML file not found.");
        const htmlText = await response.text();
        
        container.classList.add('applet-view-mode');
        container.innerHTML = htmlText;

        // Load the applet's specific JS file dynamically
        const existingScript = document.getElementById(`${appletId}-script`);
        if (existingScript) existingScript.remove();
        
        const script = document.createElement('script');
        script.src = `${appletId}-frontend.js`;
        script.id = `${appletId}-script`;
        document.body.appendChild(script);

    } catch (error) {
        console.error("Failed to load applet:", error);
        container.innerHTML = `<h2 style="color: white; padding: 20px;">Error loading ${appletId}</h2>`;
    }
}

// ==========================================
// --- 4. MAIN OS RENDERING ---
// ==========================================
async function renderHomeDashboard() {
    if (!window.currentUser) {
        window.lockTerminal();
        return;
    }

    try {
        // CLEANUP: Prevent Detached Focus AND wipe OSK memory
        if (document.activeElement) document.activeElement.blur(); 
        const osk = document.getElementById('virtual-keyboard');
        if (osk) osk.classList.add('osk-hidden'); 
        if (typeof activeInput !== 'undefined') activeInput = null;

        // Fetch DB settings FIRST
        const dbSettings = await window.api.getSettings(); 
        
        // NOW grab container and wipe it
        const container = document.getElementById('applet-container');
        container.classList.remove('applet-view-mode');
        container.innerHTML = ''; 

        const settingsMap = {};
        dbSettings.forEach(s => settingsMap[s.setting_key] = s.setting_value);

        systemApplets.forEach(applet => {
            if (applet.id === 'login') return; // Never draw login on the grid

            let isVisible = true;
            if (applet.id !== 'settings') {
                const visibilityKey = `app_${applet.id}_visible`;
                if (settingsMap[visibilityKey] === 'false') {
                    isVisible = false;
                }
            }

            if (isVisible) {
                const button = document.createElement('button');
                button.className = `applet-btn ${applet.style}`;
                button.innerHTML = `<span>${applet.name}</span>`;
                
                button.addEventListener('click', () => loadAppletView(applet.id));
                container.appendChild(button);
            }
        });
    } catch (error) {
        console.error("Failed to load dashboard settings:", error);
    }
}

// ==========================================
// --- 5. GLOBAL NAVIGATION LOGIC ---
// ==========================================
document.getElementById('nav-home-btn').addEventListener('click', () => {
    if (window.currentUser) renderHomeDashboard(); 
});

document.getElementById('nav-logout-btn').addEventListener('click', () => {
    // True Hard Refresh to clear all memory and secure terminal
    window.location.reload(); 
});

// ==========================================
// --- 6. GLOBAL ON-SCREEN KEYBOARD (OSK) ---
// ==========================================
const oskHTML = `
    <div id="virtual-keyboard" class="osk-hidden">
        <div class="osk-row">
            <button class="osk-key" data-val="1">1</button>
            <button class="osk-key" data-val="2">2</button>
            <button class="osk-key" data-val="3">3</button>
            <button class="osk-key" data-val="4">4</button>
            <button class="osk-key" data-val="5">5</button>
            <button class="osk-key" data-val="6">6</button>
            <button class="osk-key" data-val="7">7</button>
            <button class="osk-key" data-val="8">8</button>
            <button class="osk-key" data-val="9">9</button>
            <button class="osk-key" data-val="0">0</button>
            <button class="osk-key wide action" data-val="backspace">⌫</button>
        </div>
        <div class="osk-row">
            <button class="osk-key letter">q</button>
            <button class="osk-key letter">w</button>
            <button class="osk-key letter">e</button>
            <button class="osk-key letter">r</button>
            <button class="osk-key letter">t</button>
            <button class="osk-key letter">y</button>
            <button class="osk-key letter">u</button>
            <button class="osk-key letter">i</button>
            <button class="osk-key letter">o</button>
            <button class="osk-key letter">p</button>
        </div>
        <div class="osk-row">
            <button class="osk-key letter">a</button>
            <button class="osk-key letter">s</button>
            <button class="osk-key letter">d</button>
            <button class="osk-key letter">f</button>
            <button class="osk-key letter">g</button>
            <button class="osk-key letter">h</button>
            <button class="osk-key letter">j</button>
            <button class="osk-key letter">k</button>
            <button class="osk-key letter">l</button>
            <button class="osk-key wide action" data-val="enter">Enter</button>
        </div>
        <div class="osk-row">
            <button class="osk-key wide action" id="osk-shift">⇧ Shift</button>
            <button class="osk-key letter">z</button>
            <button class="osk-key letter">x</button>
            <button class="osk-key letter">c</button>
            <button class="osk-key letter">v</button>
            <button class="osk-key letter">b</button>
            <button class="osk-key letter">n</button>
            <button class="osk-key letter">m</button>
            <button class="osk-key" data-val=",">,</button>
            <button class="osk-key" data-val=".">.</button>
        </div>
        <div class="osk-row">
            <button class="osk-key wide action" id="osk-close">⌨️ Hide</button>
            <button class="osk-key space" data-val=" ">Space</button>
            <button class="osk-key wide" data-val="-">-</button>
            <button class="osk-key wide" data-val="@">@</button>
        </div>
    </div>
`;

// Inject OSK into the DOM
document.body.insertAdjacentHTML('beforeend', oskHTML);

const virtualKeyboard = document.getElementById('virtual-keyboard');
let isShifted = false;

// Listen for any textbox click across the entire OS
document.addEventListener('focusin', (e) => {
    const target = e.target;
    const isTextInput = target.tagName === 'INPUT' && ['text', 'number', 'email', 'tel'].includes(target.type);
    
    if (isTextInput || target.tagName === 'TEXTAREA') {
        // EXCLUSIONS: Do not pop up inside the Register or Login PIN pads
        if (target.closest('#register-applet') || target.closest('#login-applet')) {
            return; 
        }
        
        activeInput = target;
        virtualKeyboard.classList.remove('osk-hidden');
    }
});

// Hide when clicking away
document.addEventListener('focusout', (e) => {
    setTimeout(() => {
        if (document.activeElement !== activeInput && !virtualKeyboard.contains(document.activeElement)) {
            virtualKeyboard.classList.add('osk-hidden');
            activeInput = null;
        }
    }, 100);
});

// Process the keystrokes
virtualKeyboard.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent keyboard from stealing focus from textbox
    
    if (!activeInput) return;

    const keyBtn = e.target.closest('.osk-key');
    if (!keyBtn) return;

    const val = keyBtn.getAttribute('data-val') || keyBtn.textContent;

    if (val === 'backspace' || val === '⌫') {
        activeInput.value = activeInput.value.slice(0, -1);
    } else if (val === 'enter' || val === 'Enter') {
        activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        virtualKeyboard.classList.add('osk-hidden');
        activeInput.blur();
        return;
    } else if (keyBtn.id === 'osk-shift') {
        isShifted = !isShifted;
        document.querySelectorAll('.osk-key.letter').forEach(btn => {
            btn.textContent = isShifted ? btn.textContent.toUpperCase() : btn.textContent.toLowerCase();
        });
        keyBtn.style.background = isShifted ? 'rgba(74, 144, 226, 0.6)' : '';
        return;
    } else if (keyBtn.id === 'osk-close') {
        virtualKeyboard.classList.add('osk-hidden');
        activeInput.blur();
        return;
    } else {
        // Type the character
        activeInput.value += isShifted && keyBtn.classList.contains('letter') ? val.toUpperCase() : val;
        
        // Auto un-shift after one letter like iOS
        if (isShifted && keyBtn.classList.contains('letter')) {
            isShifted = false;
            document.getElementById('osk-shift').style.background = '';
            document.querySelectorAll('.osk-key.letter').forEach(btn => btn.textContent = btn.textContent.toLowerCase());
        }
    }

    // Force the applet to recognize the new text (crucial for live search bars)
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
});

// ==========================================
// --- BOOT SEQUENCE ---
// ==========================================
window.lockTerminal();