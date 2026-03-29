// register-frontend.js
(() => {
    // --- Set Active Cashier ---
    const cashierNameEl = document.getElementById('current-cashier-name');
    let activeUserId = 1; // Fallback just in case

    if (window.currentUser) {
        activeUserId = window.currentUser.id;
        if (cashierNameEl) {
            cashierNameEl.textContent = window.currentUser.first_name;
        }
    }

    // --- Global Cart Persistence (Plugs the refresh loophole!) ---
    window.globalActiveCart = window.globalActiveCart || [];
    window.globalParkedTickets = window.globalParkedTickets || [];
    
    // Bind our local variable to the global array
    let currentCart = window.globalActiveCart;
    let activeSubtotal = 0;
    let activeTax = 0;
    let activeTotal = 0;
    const TAX_RATE = 0.07; 

    // UI Elements
    const cartList = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const lastScannedMsg = document.getElementById('last-scanned-msg');
    const modal = document.getElementById('checkout-modal');
    const modalTotalDisplay = document.getElementById('modal-total-display');

    // --- Scanner Logic & Manager Intercept ---
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const overrideModal = document.getElementById('override-modal');

    const handleKeydown = (e) => {
        const currentTime = Date.now();
        if (currentTime - lastKeyTime > 50) barcodeBuffer = ""; 
        
        if (e.key === 'Enter' && barcodeBuffer.length > 3) {
            e.preventDefault(); 
            
            // NEW: Check if we are waiting for a manager swipe
            if (!overrideModal.classList.contains('hidden')) {
                attemptOverride(barcodeBuffer);
            } else {
                processBarcode(barcodeBuffer); // Normal item scan
            }
            
            barcodeBuffer = "";
        } else if (e.key !== 'Enter') {
            barcodeBuffer += e.key;
        }
        lastKeyTime = currentTime;
    };
    
    // Attach listener to document
    document.addEventListener('keydown', handleKeydown);

    // --- Manual Entry & Touch Keypad Logic ---
    const manualInput = document.getElementById('manual-barcode-input');
    
    // 1. Handle Number Pad Taps
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            manualInput.value += e.target.textContent;
            manualInput.focus();
        });
    });

    // 2. Clear Button
    document.getElementById('btn-clear').addEventListener('click', () => {
        manualInput.value = "";
        manualInput.focus();
    });

    // 3. Physical Keyboard "Enter" Support
    manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (manualInput.value) {
                processBarcode(manualInput.value);
                manualInput.value = "";
            }
        }
    });

    // 4. On-Screen "ENTER" Button
    document.getElementById('manual-add-btn').addEventListener('click', () => {
        if (manualInput.value) {
            processBarcode(manualInput.value);
            manualInput.value = "";
        }
    });

    // --- Security & Action Execution ---
    let pendingOverrideAction = null;

    function executeVoid() {
        if (currentCart.length > 0) {
            const removedItem = currentCart.pop();
            updateCartUI();
            lastScannedMsg.textContent = `Voided: ${removedItem.name}`;
            lastScannedMsg.style.color = "#E53935";
        } else {
            alert("Cart is empty.");
        }
    }

    function executeNoSale() {
        alert("Drawer Opened (No Sale).");
        lastScannedMsg.textContent = "No Sale Processed.";
        lastScannedMsg.style.color = "#9E9E9E";
    }

    // --- Manager Override Modal Logic ---
    let overridePinInput = "";
    const overridePinDisplay = document.getElementById('override-pin-display');
    const overrideMsg = document.getElementById('override-msg');

    function openOverrideModal(actionType) {
        pendingOverrideAction = actionType;
        overridePinInput = "";
        overridePinDisplay.textContent = "";
        overrideMsg.textContent = "Enter Manager PIN or Swipe Card";
        overrideMsg.style.color = "#aaa";
        overrideModal.classList.remove('hidden');
    }

    function closeOverrideModal() {
        overrideModal.classList.add('hidden');
        pendingOverrideAction = null;
        overridePinInput = "";
    }

    document.getElementById('cancel-override-btn').addEventListener('click', closeOverrideModal);

    // Override PIN Pad Clicks
    document.querySelectorAll('.override-pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.textContent;
            if (overridePinInput.length < 10) {
                overridePinInput += val;
                overridePinDisplay.textContent = "*".repeat(overridePinInput.length);
            }
        });
    });

    document.getElementById('override-pin-clear').addEventListener('click', () => {
        overridePinInput = "";
        overridePinDisplay.textContent = "";
    });

    document.getElementById('override-pin-enter').addEventListener('click', () => {
        attemptOverride(overridePinInput);
    });

    // Database Check
    async function attemptOverride(credential) {
        if (!credential) return;
        
        try {
            overrideMsg.textContent = "Verifying...";
            const manager = await window.api.loginEmployee(credential);
            
            if (manager) {
                // Verify this specific manager has the right permission!
                let hasPermission = false;
                if (pendingOverrideAction === 'void' && manager.can_void_transactions) hasPermission = true;
                if (pendingOverrideAction === 'no_sale' && manager.can_open_drawer) hasPermission = true;

                if (hasPermission) {
                    // 1. Save the action we want to run into a safe temporary variable
                    const actionToRun = pendingOverrideAction; 
                    
                    // 2. Now it is safe to close and reset the modal
                    closeOverrideModal(); 
                    
                    // 3. Execute the saved action!
                    if (actionToRun === 'void') executeVoid();
                    if (actionToRun === 'no_sale') executeNoSale();
                } else {
                    overrideMsg.textContent = "User lacks required permissions.";
                    overrideMsg.style.color = "#E53935";
                    overridePinInput = "";
                    overridePinDisplay.textContent = "";
                }
            } else {
                overrideMsg.textContent = "Invalid PIN or Card.";
                overrideMsg.style.color = "#E53935";
                overridePinInput = "";
                overridePinDisplay.textContent = "";
            }
        } catch (error) {
            console.error(error);
            overrideMsg.textContent = "System Error.";
        }
    }

    // 5. VOID Button
    document.getElementById('btn-void').addEventListener('click', () => {
        if (window.currentUser.can_void_transactions) {
            executeVoid();
        } else {
            openOverrideModal('void');
        }
    });

    // 6. NO SALE Button
    document.getElementById('btn-no-sale').addEventListener('click', () => {
        if (window.currentUser.can_open_drawer) {
            executeNoSale();
        } else {
            openOverrideModal('no_sale');
        }
    });

    // 7. QTY Button (Multiplies the last scanned item)
    document.getElementById('btn-qty').addEventListener('click', () => {
        const qtyValue = parseInt(manualInput.value);
        
        if (isNaN(qtyValue) || qtyValue <= 0) {
            alert("Please enter a valid quantity, then press QTY.");
            return;
        }

        if (currentCart.length === 0) {
            alert("Scan an item first before changing quantity.");
            return;
        }

        // We already have 1 in the cart, so add (qtyValue - 1) more copies
        const lastItem = currentCart[currentCart.length - 1];
        for (let i = 0; i < qtyValue - 1; i++) {
            currentCart.push(lastItem);
        }

        updateCartUI();
        manualInput.value = "";
        lastScannedMsg.textContent = `Quantity updated to ${qtyValue}x for ${lastItem.name}`;
        lastScannedMsg.style.color = "#FFD54F";
    });

    // 8. NO SALE Button (Pops the drawer)
    document.getElementById('btn-no-sale').addEventListener('click', () => {
        if (!window.currentUser.can_open_drawer) {
            alert("You do not have permission to open the drawer.");
            return;
        }
        
        // Future: Send silent print command with drawer kick hex code here!
        alert("Drawer Opened (No Sale).");
        lastScannedMsg.textContent = "No Sale Processed.";
        lastScannedMsg.style.color = "#9E9E9E";
    });

    // --- DB Call & Cart ---
    async function processBarcode(barcode) {
        try {
            const itemData = await window.api.scanItem(barcode);
            if (itemData) {
                currentCart.push(itemData);
                updateCartUI();
                lastScannedMsg.textContent = `Added: ${itemData.name} ($${itemData.price.toFixed(2)})`;
                lastScannedMsg.style.color = "#4CAF50";
            } else {
                lastScannedMsg.textContent = `Error: Item not found`;
                lastScannedMsg.style.color = "#E53935";
            }
        } catch (error) {
            console.error(error);
        }
    }

    function updateCartUI() {
        cartList.innerHTML = '';
        activeSubtotal = 0;

        // 1. Group the items by ID
        const groupedItems = {};

        currentCart.forEach((item) => {
            activeSubtotal += item.price; // Keep a running subtotal
            
            if (groupedItems[item.id]) {
                groupedItems[item.id].qty += 1;
                groupedItems[item.id].totalPrice += item.price;
            } else {
                groupedItems[item.id] = {
                    name: item.name,
                    price: item.price,
                    qty: 1,
                    totalPrice: item.price
                };
            }
        });

        // 2. Rebuild the visual list from the grouped object
        Object.values(groupedItems).forEach((group) => {
            const li = document.createElement('li');
            li.className = 'cart-item';
            
            // If there's more than 1, add a bold green multiplier next to the name
            const displayName = group.qty > 1 
                ? `${group.name} <span style="color: #4CAF50; font-weight: bold; margin-left: 8px;">x${group.qty}</span>` 
                : group.name;
            
            li.innerHTML = `<span>${displayName}</span> <span>$${group.totalPrice.toFixed(2)}</span>`;
            cartList.appendChild(li);
        });

        // 3. Do the final math
        activeTax = activeSubtotal * TAX_RATE;
        activeTotal = activeSubtotal + activeTax;

        subtotalEl.textContent = `$${activeSubtotal.toFixed(2)}`;
        taxEl.textContent = `$${activeTax.toFixed(2)}`;
        totalEl.textContent = `$${activeTotal.toFixed(2)}`;

        checkoutBtn.disabled = currentCart.length === 0;
    }

    // --- Checkout Logic ---
    const cashModal = document.getElementById('cash-modal');
    const cashAmountInput = document.getElementById('cash-amount-input');
    const cashTotalDisplay = document.getElementById('cash-total-display');
    
    const changeModal = document.getElementById('change-modal');
    const changeDueDisplay = document.getElementById('change-due-display');

    let pendingTenderType = "";

    // Open Main Checkout Modal
    checkoutBtn.addEventListener('click', () => {
        modalTotalDisplay.textContent = totalEl.textContent;
        modal.classList.remove('hidden');
    });

    document.getElementById('cancel-checkout-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Handle Tender Selection
    document.querySelectorAll('.tender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pendingTenderType = e.target.getAttribute('data-tender');
            
            if (pendingTenderType === 'Cash') {
                // Hide main modal, show cash input modal
                modal.classList.add('hidden');
                cashTotalDisplay.textContent = `Due: $${activeTotal.toFixed(2)}`;
                cashAmountInput.value = '';
                cashModal.classList.remove('hidden');
                cashAmountInput.focus();
            } else {
                // Process non-cash immediately (exact amount)
                finalizeSale(pendingTenderType, activeTotal, 0);
            }
        });
    });

    // Handle Cash Confirm
    document.getElementById('confirm-cash-btn').addEventListener('click', () => {
        const amountTendered = parseFloat(cashAmountInput.value);
        
        if (isNaN(amountTendered) || amountTendered < activeTotal) {
            alert("Not enough cash provided! Please enter a valid amount.");
            return;
        }
        
        const changeDue = amountTendered - activeTotal;
        cashModal.classList.add('hidden');
        finalizeSale('Cash', amountTendered, changeDue);
    });

    // Handle Cash Cancel (Go back to tender select)
    document.getElementById('cancel-cash-btn').addEventListener('click', () => {
        cashModal.classList.add('hidden');
        modal.classList.remove('hidden'); 
    });

    // --- Open Tickets Logic ---
    const parkBtn = document.getElementById('btn-park-ticket');
    const recallBtn = document.getElementById('btn-recall-ticket');
    const recallModal = document.getElementById('recall-modal');
    const openTicketCount = document.getElementById('open-ticket-count');
    const recallTableBody = document.getElementById('recall-table-body');

    function updateTicketCount() {
        if (openTicketCount) {
            openTicketCount.textContent = window.globalParkedTickets.length;
        }
    }

    // 1. Park the Active Order
    if (parkBtn) {
        parkBtn.addEventListener('click', () => {
            if (currentCart.length === 0) {
                alert("Cart is already empty.");
                return;
            }

            // Save a copy of the active cart to the global parked array
            window.globalParkedTickets.push({
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                cartData: [...currentCart] // Deep copy the array
            });

            // Empty the active cart (but keep the global reference intact)
            currentCart.length = 0; 
            updateCartUI();
            updateTicketCount();
            
            lastScannedMsg.textContent = "Order Parked.";
            lastScannedMsg.style.color = "#FF9800";
        });
    }

    // 2. Open the Recall Modal
    if (recallBtn) {
        recallBtn.addEventListener('click', () => {
            recallTableBody.innerHTML = '';

            if (window.globalParkedTickets.length === 0) {
                recallTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #888; padding: 20px;">No open tickets.</td></tr>';
            } else {
                window.globalParkedTickets.forEach((ticket, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${ticket.timestamp}</td>
                        <td>${ticket.cartData.length} items</td>
                        <td><button class="action-btn recall-action-btn" data-index="${index}" style="background: #4CAF50; padding: 5px 15px; font-size: 0.9rem;">Resume</button></td>
                    `;
                    recallTableBody.appendChild(tr);
                });

                // Attach click listeners to the dynamically created Resume buttons
                document.querySelectorAll('.recall-action-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        if (currentCart.length > 0) {
                            alert("Please park or finish the current active order before recalling another.");
                            return;
                        }

                        const indexToRecall = e.target.getAttribute('data-index');
                        const ticketToResume = window.globalParkedTickets.splice(indexToRecall, 1)[0]; // Remove from parked list
                        
                        // Push all items back into the active cart
                        ticketToResume.cartData.forEach(item => currentCart.push(item));
                        
                        updateCartUI();
                        updateTicketCount();
                        recallModal.classList.add('hidden');
                        
                        lastScannedMsg.textContent = "Order Resumed.";
                        lastScannedMsg.style.color = "#4CAF50";
                    });
                });
            }

            recallModal.classList.remove('hidden');
        });
    }

    document.getElementById('close-recall-btn').addEventListener('click', () => {
        recallModal.classList.add('hidden');
    });

    // The Final Database Call
    async function finalizeSale(tenderType, amountTendered, changeDue) {
        const orderData = {
            userId: activeUserId, 
            subtotal: activeSubtotal,
            tax: activeTax,
            total: activeTotal,
            tenderType: tenderType,
            amountTendered: amountTendered,
            changeDue: changeDue,
            cart: currentCart
        };

        try {
            // 1. Send to backend and get the new Ticket ID back
            const response = await window.api.processCheckout(orderData);
            const newTicketId = response.ticketId;
            
            // 2. Populate the Digital Receipt
            document.getElementById('receipt-date').textContent = new Date().toLocaleString();
            document.getElementById('receipt-ticket-id').textContent = newTicketId.toString().padStart(6, '0');
            document.getElementById('receipt-cashier-name').textContent = window.currentUser ? window.currentUser.first_name : 'System';
           
            const receiptItems = document.getElementById('receipt-items');
            receiptItems.innerHTML = '';
            
            // Group items for the printed receipt
            const receiptGrouped = {};
            currentCart.forEach(item => {
                if(receiptGrouped[item.id]) {
                    receiptGrouped[item.id].qty += 1;
                    receiptGrouped[item.id].totalPrice += item.price;
                } else {
                    receiptGrouped[item.id] = { name: item.name, qty: 1, totalPrice: item.price };
                }
            });

            // Inject the grouped items into the receipt table
            Object.values(receiptGrouped).forEach(group => {
                const displayName = group.qty > 1 ? `${group.name} x${group.qty}` : group.name;
                receiptItems.innerHTML += `<tr><td style="padding-bottom: 5px;">${displayName}</td><td style="text-align: right; padding-bottom: 5px;">$${group.totalPrice.toFixed(2)}</td></tr>`;
            });

            document.getElementById('receipt-subtotal').textContent = `$${activeSubtotal.toFixed(2)}`;
            document.getElementById('receipt-tax').textContent = `$${activeTax.toFixed(2)}`;
            document.getElementById('receipt-total').textContent = `$${activeTotal.toFixed(2)}`;
            document.getElementById('receipt-tender-type').textContent = tenderType;
            document.getElementById('receipt-tender-amount').textContent = `$${amountTendered.toFixed(2)}`;
            document.getElementById('receipt-change-due').textContent = `$${changeDue.toFixed(2)}`;

            // 3. Reset Register UI
            currentCart = [];
            updateCartUI();
            modal.classList.add('hidden');
            lastScannedMsg.textContent = "Ready for next customer...";
            lastScannedMsg.style.color = "#fff";

            // 4. Determine which modal to show next
            if (tenderType === 'Cash') {
                // For cash, always show the huge change due screen first!
                changeDueDisplay.textContent = `$${changeDue.toFixed(2)}`;
                changeModal.classList.remove('hidden');
            } else {
                // For cards, skip change and go straight to the receipt
                document.getElementById('receipt-modal').classList.remove('hidden');
            }

        } catch (error) {
            console.error("Database error processing transaction:", error);
            alert("Database error processing transaction.");
        }
    }

    // Close Change Modal
    document.getElementById('close-change-btn').addEventListener('click', () => {
        changeModal.classList.add('hidden');
    });

    // Clean up scanner listener when closing applet
    const closeBtn = document.getElementById('close-register-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.removeEventListener('keydown', handleKeydown);
        });
    }

    // When closing the huge Cash Change modal, immediately pop up the Receipt Modal
    document.getElementById('close-change-btn').addEventListener('click', () => {
        changeModal.classList.add('hidden');
        document.getElementById('receipt-modal').classList.remove('hidden');
    });

    // Close the Receipt Modal and prep for the next customer
    document.getElementById('close-receipt-btn').addEventListener('click', () => {
        document.getElementById('receipt-modal').classList.add('hidden');
    });

    // Fire the silent print bridge
    document.getElementById('print-receipt-btn').addEventListener('click', async () => {
        // 1. Grab just the HTML inside the receipt area
        const receiptContent = document.getElementById('printable-receipt-area').innerHTML;
        
        try {
            // 2. Send it to the ghost window!
            await window.api.printReceipt(receiptContent);
            
            // 3. Close the modal and prep for the next customer
            document.getElementById('receipt-modal').classList.add('hidden');
        } catch (error) {
            console.error("Print failed:", error);
            alert("Printer error. Check connection.");
        }
    });

    updateCartUI();
    updateTicketCount();
})();