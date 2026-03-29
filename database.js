const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'retro_pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1-7. EXISTING TABLES
    db.run(`CREATE TABLE IF NOT EXISTS Roles (id INTEGER PRIMARY KEY AUTOINCREMENT, role_name TEXT UNIQUE, can_access_register BOOLEAN DEFAULT 0, can_void_transactions BOOLEAN DEFAULT 0, can_open_drawer BOOLEAN DEFAULT 0, can_manage_inventory BOOLEAN DEFAULT 0, can_manage_users BOOLEAN DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, role_id INTEGER, first_name TEXT, last_name TEXT, msr_hash TEXT UNIQUE, pin_code TEXT UNIQUE, is_active BOOLEAN DEFAULT 1, FOREIGN KEY (role_id) REFERENCES Roles (id))`);
    db.run("INSERT OR IGNORE INTO Users (role_id, first_name, last_name, pin_code) VALUES (1, 'Test', 'Admin', '1234')");
    db.run(`CREATE TABLE IF NOT EXISTS Time_Logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, clock_in TEXT, clock_out TEXT, total_hours REAL, FOREIGN KEY (user_id) REFERENCES Users (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS Items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sku_barcode TEXT UNIQUE, price REAL, stock_qty INTEGER, is_weight_embedded BOOLEAN DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS Inventory_Logs (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, user_id INTEGER, change_amount INTEGER, reason TEXT, timestamp TEXT, FOREIGN KEY (item_id) REFERENCES Items (id), FOREIGN KEY (user_id) REFERENCES Users (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS Tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, subtotal REAL, tax REAL, total REAL, tender_type TEXT, amount_tendered REAL, change_due REAL, timestamp TEXT, FOREIGN KEY (user_id) REFERENCES Users (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS Ticket_Lines (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, item_id INTEGER, qty INTEGER, price_at_sale REAL, FOREIGN KEY (ticket_id) REFERENCES Tickets (id), FOREIGN KEY (item_id) REFERENCES Items (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS Settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT UNIQUE, setting_value TEXT, description TEXT)`);

    // 8. THE MISSING CUSTOMERS TABLE
    db.run(`CREATE TABLE IF NOT EXISTS Customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT UNIQUE,
        email TEXT,
        loyalty_card_hash TEXT UNIQUE,
        loyalty_balance REAL DEFAULT 0.00,
        created_at TEXT
    )`);

    // --- INITIALIZATION ---
    db.run(`INSERT OR IGNORE INTO Roles (role_name, can_access_register, can_void_transactions, can_open_drawer, can_manage_inventory, can_manage_users) VALUES ('Admin', 1, 1, 1, 1, 1)`);
    db.run(`INSERT OR IGNORE INTO Roles (role_name, can_access_register, can_void_transactions, can_open_drawer, can_manage_inventory, can_manage_users) VALUES ('Cashier', 1, 0, 0, 0, 0)`);
    
    const defaultSettings = [
        ['feature_shifts', 'true', 'Track cash that goes in and out of your drawer.'],
        ['feature_timeclock', 'true', 'Track employees clock in/out time.'],
        ['feature_open_tickets', 'true', 'Allow to save and edit orders before completing.'],
        ['feature_kitchen_printers', 'true', 'Send orders to kitchen printer.'],
        ['feature_customer_displays', 'false', 'Display order information to customers.'],
        ['feature_dining_options', 'true', 'Mark orders as dine in, takeout or delivery.'],
        ['feature_low_stock', 'false', 'Get daily email on items that are low.'],
        ['feature_negative_stock', 'false', 'Warn cashiers attempting to sell more than available.'],
        ['feature_weight_barcode', 'true', 'Allow to scan barcodes with embedded weight.'],
        ['loyalty_percentage', '5.00', 'Percentage of purchase credited to points.'],
        // App Visibility
        ['app_register_visible', 'true', 'Show the Register app on the Home Screen.'],
        ['app_profile_visible', 'true', 'Show the Profile / Time Clock app on the Home Screen.'],
        ['app_inventory_visible', 'true', 'Show the Inventory app on the Home Screen.'],
        ['app_customers_visible', 'true', 'Show the Customers CRM app on the Home Screen.']
    ];

    defaultSettings.forEach(setting => {
        db.run(`INSERT OR IGNORE INTO Settings (setting_key, setting_value, description) VALUES (?, ?, ?)`, setting);
    });
});

module.exports = db;