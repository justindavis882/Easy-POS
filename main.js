const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Pull in your database and timeclock logic
const db = require('./database.js'); 
// Ensure your timeclock.js has `module.exports = { handleTimePunch };` at the bottom!
const { handleTimePunch } = require('./timeclock.js'); 

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        // Removes the default Windows top menu bar for a true "OS" feel
        autoHideMenuBar: true, 
        webPreferences: {
            // This is the bridge we built earlier!
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Load the main dashboard
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- THE API BRIDGE HANDLERS ---

// 1. Handle Barcode Scans
ipcMain.handle('scan-item', (event, barcode) => {
    return new Promise((resolve, reject) => {
        // Query the Easy POS database for the item
        db.get(`SELECT * FROM Items WHERE sku_barcode = ?`, [barcode], (err, row) => {
            if (err) {
                console.error("Database error during scan:", err);
                reject(err);
            } else {
                resolve(row); // Returns the item JSON to the frontend, or undefined if not found
            }
        });
    });
});

// 2. Handle Employee Login & Permissions
ipcMain.handle('login-employee', (event, credential) => {
    return new Promise((resolve, reject) => {
        // Explicitly select all permissions so they pass to the frontend!
        const query = `
            SELECT 
                Users.*, 
                Roles.role_name, 
                Roles.can_access_register,
                Roles.can_void_transactions,
                Roles.can_open_drawer,
                Roles.can_manage_inventory,
                Roles.can_manage_users
            FROM Users 
            JOIN Roles ON Users.role_id = Roles.id 
            WHERE (Users.msr_hash = ? OR Users.pin_code = ?) AND Users.is_active = 1
        `;
        db.get(query, [credential, credential], (err, user) => {
            if (err) reject(err);
            else resolve(user); 
        });
    });
});

// 3. Handle Time Clock Punches
ipcMain.handle('punch-timeclock', async (event, userId) => {
    try {
        const result = await handleTimePunch(userId);
        return result;
    } catch (error) {
        console.error("Timeclock error:", error);
        throw error;
    }
});

// --- INVENTORY API HANDLERS ---
ipcMain.handle('get-all-items', () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Items ORDER BY name ASC`, [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
});

ipcMain.handle('save-item', (event, item) => {
    return new Promise((resolve, reject) => {
        if (item.id) {
            // Edit existing item
            db.run(`UPDATE Items SET name = ?, sku_barcode = ?, price = ?, is_weight_embedded = ? WHERE id = ?`,
                [item.name, item.sku_barcode, item.price, item.is_weight_embedded, item.id],
                function(err) { if (err) reject(err); else resolve({ success: true }); }
            );
        } else {
            // Create new item
            db.run(`INSERT INTO Items (name, sku_barcode, price, stock_qty, is_weight_embedded) VALUES (?, ?, ?, ?, ?)`,
                [item.name, item.sku_barcode, item.price, item.stock_qty || 0, item.is_weight_embedded],
                function(err) { if (err) reject(err); else resolve({ success: true, id: this.lastID }); }
            );
        }
    });
});

ipcMain.handle('delete-item', (event, itemId) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM Items WHERE id = ?`, [itemId], function(err) {
            if (err) reject(err); else resolve({ success: true });
        });
    });
});

ipcMain.handle('log-inventory', (event, log) => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        // 1. Insert the audit log
        db.run(`INSERT INTO Inventory_Logs (item_id, user_id, change_amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [log.item_id, log.user_id, log.change_amount, log.reason, now],
            function(err) {
                if (err) return reject(err);
                // 2. Update the actual stock quantity in the Items table
                db.run(`UPDATE Items SET stock_qty = stock_qty + ? WHERE id = ?`,
                    [log.change_amount, log.item_id],
                    function(updateErr) {
                        if (updateErr) reject(updateErr); else resolve({ success: true });
                    }
                );
            }
        );
    });
});

// --- CHECKOUT API HANDLER ---
ipcMain.handle('process-checkout', (event, orderData) => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        
        // 1. Create the Master Ticket
        db.run(
            `INSERT INTO Tickets (user_id, subtotal, tax, total, tender_type, amount_tendered, change_due, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderData.userId, orderData.subtotal, orderData.tax, orderData.total, orderData.tenderType, orderData.amountTendered, orderData.changeDue, now],
            function(err) {
                if (err) return reject(err);
                
                const ticketId = this.lastID;
                let itemsProcessed = 0;
                
                // 2. Save the items and deduct inventory
                orderData.cart.forEach(item => {
                    db.run(
                        `INSERT INTO Ticket_Lines (ticket_id, item_id, qty, price_at_sale) VALUES (?, ?, ?, ?)`,
                        [ticketId, item.id, 1, item.price], 
                        (lineErr) => {
                            if (lineErr) console.error("Ticket Line Error:", lineErr);
                            
                            // Deduct the item from stock!
                            db.run(`UPDATE Items SET stock_qty = stock_qty - 1 WHERE id = ?`, [item.id], (invErr) => {
                                if (invErr) console.error("Inventory Deduction Error:", invErr);
                                
                                itemsProcessed++;
                                // Once all items are processed, tell the frontend it's done
                                if (itemsProcessed === orderData.cart.length) {
                                    resolve({ success: true, ticketId: ticketId });
                                }
                            });
                        }
                    );
                });
            }
        );
    });
});

// --- SETTINGS API HANDLERS ---
ipcMain.handle('get-settings', () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Settings`, [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
});

ipcMain.handle('update-setting', (event, key, value) => {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE Settings SET setting_value = ? WHERE setting_key = ?`, [value, key], function(err) {
            if (err) reject(err); else resolve({ success: true });
        });
    });
});

// --- USER MANAGEMENT HANDLERS ---
ipcMain.handle('get-users', () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT Users.*, Roles.role_name FROM Users JOIN Roles ON Users.role_id = Roles.id`, [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
});

ipcMain.handle('get-roles', () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Roles`, [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
});

ipcMain.handle('save-user', (event, user) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO Users (first_name, last_name, pin_code, msr_hash, role_id) VALUES (?, ?, ?, ?, ?)`,
            [user.first_name, user.last_name, user.pin_code, user.msr_hash, user.role_id],
            function(err) { if (err) reject(err); else resolve({ success: true }); }
        );
    });
});

// --- SILENT PRINTING HANDLER ---
ipcMain.handle('print-receipt', async (event, receiptHTML) => {
    return new Promise((resolve, reject) => {
        // 1. Create a hidden "Ghost" window
        let printWindow = new BrowserWindow({
            show: false, // This keeps it completely invisible!
            webPreferences: { nodeIntegration: true }
        });

        // 2. Wrap the frontend HTML in a strict 80mm thermal wrapper
        const printLayout = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Force 80mm thermal printer dimensions */
                    @page { margin: 0; size: 80mm auto; }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        width: 72mm; /* Leave a tiny margin for the printer edge */
                        margin: 0 auto; 
                        padding: 10px 0; 
                        font-size: 12px; 
                        color: #000;
                        background: #fff;
                    }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 2px 0; }
                </style>
            </head>
            <body>
                ${receiptHTML}
            </body>
            </html>
        `;

        // 3. Load the HTML into the ghost window
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printLayout)}`);

        // 4. Once it loads, fire the silent print command
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: true, // Bypasses the Windows print dialog
                printBackground: true,
                margins: { marginType: 'none' }
            }, (success, failureReason) => {
                if (!success) console.error('Silent Print Failed:', failureReason);
                
                // 5. Destroy the ghost window to free up memory
                printWindow.close();
                resolve({ success });
            });
        });
    });
});

// --- CUSTOMER CRM HANDLERS ---
ipcMain.handle('get-customers', () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Customers ORDER BY last_name ASC`, [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
});

ipcMain.handle('save-customer', (event, c) => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        if (c.id) {
            // Update existing
            db.run(`UPDATE Customers SET first_name=?, last_name=?, phone=?, email=?, loyalty_card_hash=?, loyalty_balance=? WHERE id=?`,
                [c.first_name, c.last_name, c.phone, c.email, c.loyalty_card_hash, c.loyalty_balance, c.id],
                function(err) { if (err) reject(err); else resolve({ success: true }); }
            );
        } else {
            // Create new
            db.run(`INSERT INTO Customers (first_name, last_name, phone, email, loyalty_card_hash, loyalty_balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [c.first_name, c.last_name, c.phone, c.email, c.loyalty_card_hash, c.loyalty_balance || 0, now],
                function(err) { if (err) reject(err); else resolve({ success: true, id: this.lastID }); }
            );
        }
    });
});

ipcMain.handle('delete-customer', (event, id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM Customers WHERE id = ?`, [id], function(err) {
            if (err) reject(err); else resolve({ success: true });
        });
    });
});