// profile-frontend.js

const clockBtn = document.getElementById('time-clock-toggle');
const statusText = document.getElementById('shift-status-text');
const currentUserId = 1; // You'll pull this from the active logged-in session

clockBtn.addEventListener('click', async () => {
    try {
        // Call the backend bridge we set up earlier
        const response = await window.api.punchTimeClock(currentUserId);

        if (response.action === 'CLOCKED_IN') {
            clockBtn.textContent = 'CLOCK OUT';
            clockBtn.className = 'clock-btn btn-clock-out';
            statusText.textContent = 'Currently Clocked In';
            statusText.style.color = '#4CAF50'; // Green text
            
        } else if (response.action === 'CLOCKED_OUT') {
            clockBtn.textContent = 'CLOCK IN';
            clockBtn.className = 'clock-btn btn-clock-in';
            statusText.textContent = 'Currently Clocked Out';
            statusText.style.color = '#E53935'; // Red text
            
            // Update the UI with the backend's math
            document.getElementById('hours-count').textContent = response.totalHours;
        }
    } catch (error) {
        console.error("Failed to punch the clock:", error);
        alert("System error. Please notify a manager.");
    }
});

// Close the Profile Applet
    document.getElementById('close-profile-btn').addEventListener('click', () => {
        renderHomeDashboard();
    });