// customers-frontend.js
(() => {
    const tableBody = document.getElementById('customers-table-body');
    const searchInput = document.getElementById('customer-search-input');
    const modal = document.getElementById('customer-modal');
    const form = document.getElementById('customer-form');
    
    let allCustomers = [];

    async function loadCustomers() {
        try {
            allCustomers = await window.api.getCustomers();
            renderTable(allCustomers);
        } catch (error) {
            console.error("Failed to load customers:", error);
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if(data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888; padding: 20px;">No customers found.</td></tr>';
            return;
        }

        data.forEach(cust => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${cust.first_name} ${cust.last_name}</strong></td>
                <td>${cust.phone || '-'}</td>
                <td><span style="background: #333; padding: 3px 8px; border-radius: 4px; font-family: monospace;">${cust.loyalty_card_hash ? 'Linked 💳' : 'None'}</span></td>
                <td style="text-align: right; color: #4CAF50; font-weight: bold;">$${cust.loyalty_balance.toFixed(2)}</td>
                <td style="text-align: center;">
                    <button class="action-btn edit-btn" data-id="${cust.id}" style="background: #FF9800; padding: 5px 10px; font-size: 0.8rem;">Edit</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Attach Edit Listeners
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const cust = allCustomers.find(c => c.id === id);
                if(cust) openModal(cust);
            });
        });
    }

    // --- Search Logic ---
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allCustomers.filter(c => 
            c.first_name.toLowerCase().includes(term) || 
            c.last_name.toLowerCase().includes(term) || 
            (c.phone && c.phone.includes(term)) ||
            (c.loyalty_card_hash && c.loyalty_card_hash.toLowerCase().includes(term))
        );
        renderTable(filtered);
    });

    // --- Form & Modal Logic ---
    function openModal(cust = null) {
        document.getElementById('customer-modal-title').textContent = cust ? 'Edit Customer' : 'Add Customer';
        document.getElementById('cust-id').value = cust ? cust.id : '';
        document.getElementById('cust-first').value = cust ? cust.first_name : '';
        document.getElementById('cust-last').value = cust ? cust.last_name : '';
        document.getElementById('cust-phone').value = cust ? cust.phone : '';
        document.getElementById('cust-email').value = cust ? cust.email : '';
        document.getElementById('cust-card').value = cust ? cust.loyalty_card_hash : '';
        document.getElementById('cust-balance').value = cust ? cust.loyalty_balance.toFixed(2) : '0.00';
        
        modal.classList.remove('hidden');
    }

    document.getElementById('add-customer-btn').addEventListener('click', () => openModal());
    document.getElementById('cancel-cust-btn').addEventListener('click', () => modal.classList.add('hidden'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const customerData = {
            id: document.getElementById('cust-id').value || null,
            first_name: document.getElementById('cust-first').value,
            last_name: document.getElementById('cust-last').value,
            phone: document.getElementById('cust-phone').value,
            email: document.getElementById('cust-email').value,
            loyalty_card_hash: document.getElementById('cust-card').value || null,
            loyalty_balance: parseFloat(document.getElementById('cust-balance').value) || 0.00
        };

        try {
            await window.api.saveCustomer(customerData);
            modal.classList.add('hidden');
            form.reset();
            loadCustomers(); // Refresh grid
        } catch (err) {
            console.error(err);
            alert("Error saving customer. Ensure phone number and loyalty card are unique.");
        }
    });

    // --- Issue Gift Card Logic ---
    const issueGcBtn = document.getElementById('issue-gc-btn');
    if (issueGcBtn) {
        issueGcBtn.addEventListener('click', async () => {
            const hash = document.getElementById('new-gc-hash').value;
            const amount = parseFloat(document.getElementById('new-gc-amount').value);
            const customerId = document.getElementById('cust-id').value; // Null if new customer
            const currentBalance = parseFloat(document.getElementById('cust-balance').value);

            if (!hash || isNaN(amount) || amount <= 0) {
                return alert("Please swipe a card and enter a valid amount.");
            }

            // If a customer exists, ensure they have enough points to convert!
            if (customerId && amount > currentBalance) {
                return alert("Cannot issue gift card: Amount exceeds customer's loyalty balance.");
            }

            try {
                await window.api.issueGiftCard(hash, amount, customerId || null);
                
                alert(`Successfully loaded $${amount.toFixed(2)} onto Gift Card!`);
                
                // Visually deduct it from the modal so the cashier sees the update
                if (customerId) {
                    document.getElementById('cust-balance').value = (currentBalance - amount).toFixed(2);
                }
                
                document.getElementById('new-gc-hash').value = '';
                document.getElementById('new-gc-amount').value = '';
                
            } catch (error) {
                console.error(error);
                alert("Error issuing Gift Card.");
            }
        });
    }
    
    document.getElementById('close-customers-btn').addEventListener('click', () => {
        renderHomeDashboard();
    });

    // Boot
    loadCustomers();
})();