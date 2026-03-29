// timeclock.js (Backend Node.js/SQLite Logic)
const db = require('./database.js');

async function handleTimePunch(userId) {
    const now = new Date().toISOString(); // e.g., '2026-03-27T21:44:45.000Z'

    return new Promise((resolve, reject) => {
        // Step 1: Check if there is an OPEN time punch (clock_out is NULL)
        db.get(
            `SELECT id, clock_in FROM Time_Logs WHERE user_id = ? AND clock_out IS NULL`,
            [userId],
            (err, openLog) => {
                if (err) return reject(err);

                if (openLog) {
                    // --- CLOCK OUT LOGIC ---
                    const clockInTime = new Date(openLog.clock_in);
                    const clockOutTime = new Date(now);
                    
                    // Calculate hours worked (Milliseconds -> Hours)
                    const diffMs = clockOutTime - clockInTime;
                    const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

                    db.run(
                        `UPDATE Time_Logs SET clock_out = ?, total_hours = ? WHERE id = ?`,
                        [now, totalHours, openLog.id],
                        function(updateErr) {
                            if (updateErr) return reject(updateErr);
                            resolve({ action: 'CLOCKED_OUT', totalHours: totalHours });
                        }
                    );
                } else {
                    // --- CLOCK IN LOGIC ---
                    db.run(
                        `INSERT INTO Time_Logs (user_id, clock_in) VALUES (?, ?)`,
                        [userId, now],
                        function(insertErr) {
                            if (insertErr) return reject(insertErr);
                            resolve({ action: 'CLOCKED_IN' });
                        }
                    );
                }
            }
        );
    });
}

module.exports = { handleTimePunch };