// inventory-frontend.js
(() => {
    const tableBody = document.getElementById('inventory-table-body');
    const itemModal = document.getElementById('item-modal');
    const stockModal = document.getElementById('stock-modal');

    // Load Data on Boot
    async function loadInventory() {
        try {
            const items = await window.api.getAllItems();
            renderTable(items);
        } catch (error) {
            console.error("Failed to load inventory:", error);
        }
    }

    function renderTable(items) {
        tableBody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.sku_barcode}</td>
                <td><strong>${item.name}</strong></td>
                <td>$${item.price.toFixed(2)}</td>
                <td style="color: ${item.stock_qty <= 5 ? '#E53935' : '#4CAF50'}; font-weight: bold;">
                    ${item.stock_qty}
                </td>
                <td>
                    <button class="btn-small btn-stock" onclick="openStockModal(${item.id}, '${item.name}')">Stock/Audit</button>
                    <button class="btn-small btn-edit" onclick='openEditModal(${JSON.stringify(item)})'>Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteItem(${item.id})">Delete</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Add a safety check before adding the event listener
    const btnAddItem = document.getElementById('btn-add-item');

    if (btnAddItem) {
        btnAddItem.addEventListener('click', () => {
            document.getElementById('item-form').reset();
            document.getElementById('form-item-id').value = '';
            document.getElementById('item-modal-title').textContent = "Add New Item";
            document.getElementById('form-item-stock').disabled = false; 
            itemModal.classList.remove('hidden');
        });
    } else {
        console.error("The Add Item button is missing. Did the HTML inject correctly?");
    }

    window.openEditModal = function(item) {
        document.getElementById('form-item-id').value = item.id;
        document.getElementById('form-item-name').value = item.name;
        document.getElementById('form-item-sku').value = item.sku_barcode;
        document.getElementById('form-item-price').value = item.price;
        // Disable initial stock input (must use audit modal to change stock later)
        document.getElementById('form-item-stock').value = item.stock_qty;
        document.getElementById('form-item-stock').disabled = true; 
        
        document.getElementById('item-modal-title').textContent = "Edit Item";
        itemModal.classList.remove('hidden');
    };

    document.getElementById('item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemData = {
            id: document.getElementById('form-item-id').value,
            name: document.getElementById('form-item-name').value,
            sku_barcode: document.getElementById('form-item-sku').value,
            price: parseFloat(document.getElementById('form-item-price').value),
            stock_qty: parseInt(document.getElementById('form-item-stock').value) || 0,
            is_weight_embedded: 0
        };

        await window.api.saveItem(itemData);
        closeModals();
        loadInventory();
    });

    // --- Stock Adjustment Logic (Audits & Orders) ---
    window.openStockModal = function(itemId, itemName) {
        document.getElementById('stock-form').reset();
        document.getElementById('adjust-item-id').value = itemId;
        document.getElementById('adjust-item-name').textContent = itemName;
        stockModal.classList.remove('hidden');
    };

    document.getElementById('stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const logData = {
            item_id: document.getElementById('adjust-item-id').value,
            user_id: 1, // Future: Pull from active session
            change_amount: parseInt(document.getElementById('adjust-amount').value),
            reason: document.getElementById('adjust-reason').value
        };

        await window.api.logInventory(logData);
        closeModals();
        loadInventory();
    });

    // --- Deletion Logic ---
    window.deleteItem = async function(itemId) {
        if(confirm("Are you sure you want to permanently delete this item?")) {
            await window.api.deleteItem(itemId);
            loadInventory();
        }
    };

    window.closeModals = function() {
        itemModal.classList.add('hidden');
        stockModal.classList.add('hidden');
    };

    // Close the Inventory Applet
    document.getElementById('close-inventory-btn').addEventListener('click', () => {
        renderHomeDashboard();
    });
    
    // Boot
    loadInventory();
})();