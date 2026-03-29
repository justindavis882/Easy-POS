// settings-frontend.js
(() => {
    const loyaltyInput = document.getElementById('loyalty-input');

    // 1. Map Keys to Friendly Titles AND specific UI Lists
    const settingDefinitions = {
        // Global / Visibility
        'app_register_visible': { title: 'Show Register App', listId: 'list-global' },
        'app_inventory_visible': { title: 'Show Inventory App', listId: 'list-global' },
        'app_profile_visible': { title: 'Show Profile/Timeclock App', listId: 'list-global' },
        
        // Register
        'feature_open_tickets': { title: 'Open tickets', listId: 'list-register' },
        'feature_kitchen_printers': { title: 'Kitchen printers', listId: 'list-register' },
        'feature_customer_displays': { title: 'Customer displays', listId: 'list-register' },
        'feature_dining_options': { title: 'Dining options', listId: 'list-register' },
        'feature_weight_barcode': { title: 'Weight embedded barcodes', listId: 'list-register' },
        
        // Inventory
        'feature_low_stock': { title: 'Low stock notifications', listId: 'list-inventory' },
        'feature_negative_stock': { title: 'Negative stock alerts', listId: 'list-inventory' },
        
        // Users
        'feature_shifts': { title: 'Shifts Tracking', listId: 'list-users' },
        'feature_timeclock': { title: 'Time clock', listId: 'list-users' }
    };

    async function loadSettings() {
        try {
            const settings = await window.api.getSettings();
            
            // Clear all lists before populating
            document.querySelectorAll('.settings-list').forEach(list => list.innerHTML = '');

            settings.forEach(setting => {
                if (setting.setting_key === 'loyalty_percentage') {
                    loyaltyInput.value = setting.setting_value;
                    return; 
                }

                const def = settingDefinitions[setting.setting_key];
                if (!def) return; // Skip if it's not in our map

                const isChecked = setting.setting_value === 'true' ? 'checked' : '';
                const targetList = document.getElementById(def.listId);

                const li = document.createElement('li');
                li.className = 'setting-item';
                li.innerHTML = `
                    <div style="flex-grow: 1;">
                        <strong style="display: block; font-size: 1.1rem; margin-bottom: 4px; color: #fff;">${def.title}</strong>
                        <span style="color: #888; font-size: 0.9rem;">${setting.description}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" data-key="${setting.setting_key}" ${isChecked}>
                        <span class="slider"></span>
                    </label>
                `;
                targetList.appendChild(li);
            });

            // Attach save listeners to all toggles
            document.querySelectorAll('.switch input').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const key = e.target.getAttribute('data-key');
                    const value = e.target.checked ? 'true' : 'false';
                    await window.api.updateSetting(key, value);
                });
            });

        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    }

    // --- Tab Switching Logic ---
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // 1. Remove active class from all tabs
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            // 2. Hide all panes
            document.querySelectorAll('.settings-pane').forEach(p => p.classList.add('hidden'));
            
            // 3. Activate clicked tab
            const clickedTab = e.currentTarget;
            clickedTab.classList.add('active');
            
            // 4. Show target pane
            const targetId = clickedTab.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // Save Loyalty 
    document.getElementById('save-loyalty-btn').addEventListener('click', async () => {
        const val = loyaltyInput.value;
        await window.api.updateSetting('loyalty_percentage', val);
        alert('Loyalty settings saved!');
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        renderHomeDashboard(); 
    });

    // --- USER MANAGEMENT LOGIC ---
    const usersTableBody = document.getElementById('users-table-body');
    const roleSelect = document.getElementById('new-user-role');
    const userFormContainer = document.getElementById('add-user-form-container');

    async function loadUsersAndRoles() {
        try {
            // Load Roles for the dropdown
            const roles = await window.api.getRoles();
            roleSelect.innerHTML = '';
            roles.forEach(role => {
                roleSelect.innerHTML += `<option value="${role.id}">${role.role_name}</option>`;
            });

            // Load Users for the table
            const users = await window.api.getUsers();
            usersTableBody.innerHTML = '';
            users.forEach(user => {
                usersTableBody.innerHTML += `
                    <tr>
                        <td>${user.first_name} ${user.last_name}</td>
                        <td><span class="role-badge">${user.role_name}</span></td>
                        <td>***${user.pin_code.slice(-1)}</td>
                        <td style="color: ${user.is_active ? '#4CAF50' : '#E53935'}">${user.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Error loading users:", error);
        }
    }

    // Toggle Form
    document.getElementById('show-add-user-btn').addEventListener('click', () => userFormContainer.classList.remove('hidden'));
    document.getElementById('cancel-user-btn').addEventListener('click', () => userFormContainer.classList.add('hidden'));

    // Save New User
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const userData = {
            first_name: document.getElementById('new-user-first').value,
            last_name: document.getElementById('new-user-last').value,
            role_id: document.getElementById('new-user-role').value,
            pin_code: document.getElementById('new-user-pin').value,
            msr_hash: document.getElementById('new-user-msr').value || null
        };

        try {
            await window.api.saveUser(userData);
            document.getElementById('add-user-form').reset();
            userFormContainer.classList.add('hidden');
            loadUsersAndRoles(); // Refresh the table
        } catch (err) {
            alert("Error saving user. Ensure PIN/MSR is unique.");
        }
    });

    // Call this inside your existing Boot section
    loadUsersAndRoles();

    loadSettings();
})();