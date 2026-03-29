// register-frontend.js
(() => {
    // --- Global State ---
    const cashierNameEl = document.getElementById('current-cashier-name');
    let activeUserId = 1; 

    if (window.currentUser) {
        activeUserId = window.currentUser.id;
        if (cashierNameEl) cashierNameEl.textContent = window.currentUser.first_name;
    }

    window.globalActiveCart = window.globalActiveCart || [];
    window.globalParkedTickets = window.globalParkedTickets || [];
    window.globalActiveCustomer = window.globalActiveCustomer || null;
    window.globalActiveDiscount = window.globalActiveDiscount || 0;
    
    let currentCart = window.globalActiveCart;
    let currentCustomer = window.globalActiveCustomer;
    let currentDiscountPercent = window.globalActiveDiscount;
    
    let activeSubtotal = 0;
    let activeTax = 0;
    let activeTotal = 0;
    let activeDiscountAmount = 0;
    const TAX_RATE = 0.07; 

    let activeLoyaltyRedeemed = 0;
    let activeGiftCardRedeemed = 0;
    let activeGiftCardHash = null;
    let remainingDue = 0;

    // UI Elements
    const cartList = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const lastScannedMsg = document.getElementById('last-scanned-msg');
    const modal = document.getElementById('checkout-modal');
    const modalTotalDisplay = document.getElementById('modal-total-display');

    // --- Customer Attachment (Table UI) ---
    const attachBtn = document.getElementById('btn-attach-customer');
    const attachModal = document.getElementById('attach-customer-modal');
    const searchInput = document.getElementById('attach-customer-search');
    const resultsList = document.getElementById('attach-customer-results');

    function updateCustomerUI() {
        if (!attachBtn) return;
        if (currentCustomer) {
            attachBtn.innerHTML = `👤 ${currentCustomer.first_name} ($${currentCustomer.loyalty_balance.toFixed(2)}) <span id="remove-customer" style="color: #ff4444; margin-left: 8px;">✕</span>`;
            document.getElementById('remove-customer').addEventListener('click', (e) => {
                e.stopPropagation();
                currentCustomer = null;
                window.globalActiveCustomer = null;
                activeLoyaltyRedeemed = 0; 
                updateCustomerUI();
            });
        } else {
            attachBtn.innerHTML = `👤 Attach Customer`;
        }
    }

    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            searchInput.value = '';
            resultsList.innerHTML = '';
            attachModal.classList.remove('hidden');
            setTimeout(() => searchInput.focus(), 10);
        });
    }

    if (document.getElementById('close-attach-customer-btn')) {
        document.getElementById('close-attach-customer-btn').addEventListener('click', () => attachModal.classList.add('hidden'));
    }

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value;
            if (term.length < 2) return;
            const results = await window.api.searchCustomers(term);
            resultsList.innerHTML = '';
            results.forEach(cust => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${cust.first_name} ${cust.last_name}</strong></td>
                    <td>${cust.phone || '-'}</td>
                    <td style="text-align: right; color: #4CAF50;">$${cust.loyalty_balance.toFixed(2)}</td>
                    <td style="text-align: center;"><button class="action-btn save-btn" style="padding: 5px 10px; font-size: 0.8rem;">Attach</button></td>
                `;
                tr.querySelector('button').addEventListener('click', () => {
                    currentCustomer = cust;
                    window.globalActiveCustomer = cust;
                    updateCustomerUI();
                    attachModal.classList.add('hidden');
                });
                resultsList.appendChild(tr);
            });
        });
    }

    // --- Quick Add Customer ---
    const quickAddBtn = document.getElementById('btn-quick-add-cust');
    const quickAddModal = document.getElementById('quick-add-modal');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            document.getElementById('qa-first').value = '';
            document.getElementById('qa-last').value = '';
            document.getElementById('qa-phone').value = '';
            quickAddModal.classList.remove('hidden');
            setTimeout(() => document.getElementById('qa-first').focus(), 10);
        });
    }

    if (document.getElementById('cancel-qa-btn')) document.getElementById('cancel-qa-btn').addEventListener('click', () => quickAddModal.classList.add('hidden'));
    
    if (document.getElementById('save-qa-btn')) {
        document.getElementById('save-qa-btn').addEventListener('click', async () => {
            const first = document.getElementById('qa-first').value.trim();
            const last = document.getElementById('qa-last').value.trim();
            const phone = document.getElementById('qa-phone').value.trim();
            if(!first || !last || !phone) return alert("All fields required.");
            
            try {
                const res = await window.api.saveCustomer({ first_name: first, last_name: last, phone: phone, email: '', loyalty_card_hash: '', loyalty_balance: 0 });
                currentCustomer = { id: res.id, first_name: first, last_name: last, phone: phone, loyalty_balance: 0 };
                window.globalActiveCustomer = currentCustomer;
                updateCustomerUI();
                quickAddModal.classList.add('hidden');
                attachModal.classList.add('hidden');
            } catch(e) { alert("Error saving customer. Phone might already exist."); }
        });
    }

    // --- Sell Gift Card Item ---
    const sellGcBtn = document.getElementById('btn-sell-gc');
    const sellGcModal = document.getElementById('sell-gc-modal');
    
    if (sellGcBtn) {
        sellGcBtn.addEventListener('click', () => {
            document.getElementById('sell-gc-hash').value = '';
            document.getElementById('sell-gc-amount').value = '';
            sellGcModal.classList.remove('hidden');
            setTimeout(() => document.getElementById('sell-gc-hash').focus(), 10);
        });
    }

    if (document.getElementById('cancel-sell-gc-btn')) document.getElementById('cancel-sell-gc-btn').addEventListener('click', () => sellGcModal.classList.add('hidden'));

    if (document.getElementById('confirm-sell-gc-btn')) {
        document.getElementById('confirm-sell-gc-btn').addEventListener('click', () => {
            const hash = document.getElementById('sell-gc-hash').value.trim();
            const amt = parseFloat(document.getElementById('sell-gc-amount').value);
            
            if (!hash || isNaN(amt) || amt <= 0) return alert("Valid swipe and amount required.");
            
            // Push it into the cart as a special un-taxable item!
            currentCart.push({
                id: 'GC-' + Date.now(),
                name: `Gift Card Load (${hash.substring(0,4)}...)`,
                price: amt,
                isGiftCard: true,
                gcHash: hash
            });
            
            updateCartUI();
            sellGcModal.classList.add('hidden');
            lastScannedMsg.textContent = "Gift Card loaded to cart.";
            lastScannedMsg.style.color = "#E91E63";
        });
    }

    // --- Discount Logic ---
    const discountBtn = document.getElementById('btn-discount');
    const discountModal = document.getElementById('discount-modal');
    const discountInput = document.getElementById('discount-input');

    if (discountBtn) {
        discountBtn.addEventListener('click', () => {
            discountInput.value = '';
            discountModal.classList.remove('hidden');
            setTimeout(() => discountInput.focus(), 10);
        });
    }

    if (document.getElementById('cancel-discount-btn')) document.getElementById('cancel-discount-btn').addEventListener('click', () => discountModal.classList.add('hidden'));

    if (document.getElementById('apply-discount-btn')) {
        document.getElementById('apply-discount-btn').addEventListener('click', () => {
            const val = parseFloat(discountInput.value);
            if (!isNaN(val) && val >= 0 && val <= 100) {
                currentDiscountPercent = val;
                window.globalActiveDiscount = val;
                updateCartUI();
            }
            discountModal.classList.add('hidden');
        });
    }

    // --- Scanner Logic ---
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const overrideModal = document.getElementById('override-modal');

    const handleKeydown = (e) => {
        if (!document.getElementById('register-applet')) {
            document.removeEventListener('keydown', handleKeydown);
            return;
        }

        const currentTime = Date.now();
        if (currentTime - lastKeyTime > 50) barcodeBuffer = ""; 
        
        if (e.key === 'Enter' && barcodeBuffer.length > 3) {
            e.preventDefault(); 
            
            const gcModal = document.getElementById('gc-checkout-modal');
            const sellGcModalOpen = document.getElementById('sell-gc-modal');

            if (gcModal && !gcModal.classList.contains('hidden')) {
                document.getElementById('gc-swipe-input').value = barcodeBuffer;
                document.getElementById('apply-gc-pay-btn').click();
            } else if (sellGcModalOpen && !sellGcModalOpen.classList.contains('hidden')) {
                document.getElementById('sell-gc-hash').value = barcodeBuffer;
                document.getElementById('sell-gc-amount').focus();
            } else if (overrideModal && !overrideModal.classList.contains('hidden')) {
                attemptOverride(barcodeBuffer);
            } else {
                processBarcode(barcodeBuffer); 
            }
            barcodeBuffer = "";
        } else if (e.key !== 'Enter') {
            barcodeBuffer += e.key;
        }
        lastKeyTime = currentTime;
    };
    
    document.addEventListener('keydown', handleKeydown);

    // --- Keypad Logic ---
    const manualInput = document.getElementById('manual-barcode-input');
    
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            manualInput.value += e.target.textContent;
            manualInput.focus();
        });
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        manualInput.value = "";
        manualInput.focus();
    });

    manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (manualInput.value) {
                processBarcode(manualInput.value);
                manualInput.value = "";
            }
        }
    });

    document.getElementById('manual-add-btn').addEventListener('click', () => {
        if (manualInput.value) {
            processBarcode(manualInput.value);
            manualInput.value = "";
        }
    });

    // --- Security / Override ---
    let pendingOverrideAction = null;

    function executeVoid() {
        if (currentCart.length > 0) {
            const removedItem = currentCart.pop();
            updateCartUI();
            lastScannedMsg.textContent = `Voided: ${removedItem.name}`;
            lastScannedMsg.style.color = "#E53935";
        } else alert("Cart is empty.");
    }

    function executeNoSale() {
        alert("Drawer Opened (No Sale).");
        lastScannedMsg.textContent = "No Sale Processed.";
        lastScannedMsg.style.color = "#9E9E9E";
    }

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

    if (document.getElementById('cancel-override-btn')) document.getElementById('cancel-override-btn').addEventListener('click', closeOverrideModal);

    document.querySelectorAll('.override-pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.textContent;
            if (overridePinInput.length < 10) {
                overridePinInput += val;
                overridePinDisplay.textContent = "*".repeat(overridePinInput.length);
            }
        });
    });

    if (document.getElementById('override-pin-enter')) document.getElementById('override-pin-enter').addEventListener('click', () => attemptOverride(overridePinInput));

    async function attemptOverride(credential) {
        if (!credential) return;
        try {
            overrideMsg.textContent = "Verifying...";
            const manager = await window.api.loginEmployee(credential);
            
            if (manager) {
                let hasPermission = false;
                if (pendingOverrideAction === 'void' && manager.can_void_transactions) hasPermission = true;
                if (pendingOverrideAction === 'no_sale' && manager.can_open_drawer) hasPermission = true;

                if (hasPermission) {
                    const actionToRun = pendingOverrideAction; 
                    closeOverrideModal(); 
                    if (actionToRun === 'void') executeVoid();
                    if (actionToRun === 'no_sale') executeNoSale();
                } else {
                    overrideMsg.textContent = "User lacks permissions.";
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
        } catch (error) { console.error(error); }
    }

    document.getElementById('btn-void').addEventListener('click', () => {
        if (window.currentUser.can_void_transactions) executeVoid();
        else openOverrideModal('void');
    });

    document.getElementById('btn-no-sale').addEventListener('click', () => {
        if (window.currentUser.can_open_drawer) executeNoSale();
        else openOverrideModal('no_sale');
    });

    document.getElementById('btn-qty').addEventListener('click', () => {
        const qtyValue = parseInt(manualInput.value);
        if (isNaN(qtyValue) || qtyValue <= 0) return alert("Enter valid quantity, then press QTY.");
        if (currentCart.length === 0) return alert("Scan an item first.");

        const lastItem = currentCart[currentCart.length - 1];
        for (let i = 0; i < qtyValue - 1; i++) currentCart.push(lastItem);

        updateCartUI();
        manualInput.value = "";
        lastScannedMsg.textContent = `Quantity updated to ${qtyValue}x for ${lastItem.name}`;
        lastScannedMsg.style.color = "#FFD54F";
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
        } catch (error) { console.error(error); }
    }

    function updateCartUI() {
        cartList.innerHTML = '';
        activeSubtotal = 0;
        
        // Split math for GC tax exemptions
        let taxableSubtotal = 0;
        let nonTaxableSubtotal = 0;

        const groupedItems = {};
        currentCart.forEach((item) => {
            activeSubtotal += item.price; 
            
            if (item.isGiftCard) nonTaxableSubtotal += item.price;
            else taxableSubtotal += item.price;

            if (groupedItems[item.id]) {
                groupedItems[item.id].qty += 1;
                groupedItems[item.id].totalPrice += item.price;
            } else {
                groupedItems[item.id] = { name: item.name, price: item.price, qty: 1, totalPrice: item.price };
            }
        });

        Object.values(groupedItems).forEach((group) => {
            const li = document.createElement('li');
            li.className = 'cart-item';
            const displayName = group.qty > 1 
                ? `${group.name} <span style="color: #4CAF50; font-weight: bold; margin-left: 8px;">x${group.qty}</span>` 
                : group.name;
            li.innerHTML = `<span>${displayName}</span> <span>$${group.totalPrice.toFixed(2)}</span>`;
            cartList.appendChild(li);
        });

        // Calculate Tax & Discounts (Gift Cards are exempt from both!)
        activeDiscountAmount = taxableSubtotal * (currentDiscountPercent / 100);
        const discountedTaxable = taxableSubtotal - activeDiscountAmount;
        
        activeTax = discountedTaxable * TAX_RATE;
        activeTotal = discountedTaxable + nonTaxableSubtotal + activeTax;

        if (currentDiscountPercent > 0) {
            subtotalEl.innerHTML = `<s>$${activeSubtotal.toFixed(2)}</s> <span style="color:#FF9800;">(-${currentDiscountPercent}%)</span> $${(discountedTaxable + nonTaxableSubtotal).toFixed(2)}`;
        } else {
            subtotalEl.textContent = `$${activeSubtotal.toFixed(2)}`;
        }
        
        taxEl.textContent = `$${activeTax.toFixed(2)}`;
        totalEl.textContent = `$${activeTotal.toFixed(2)}`;

        if (currentCart.length === 0) {
            activeLoyaltyRedeemed = 0;
            activeGiftCardRedeemed = 0;
            activeGiftCardHash = null;
        }

        checkoutBtn.disabled = currentCart.length === 0;
        if (!modal.classList.contains('hidden')) updateCheckoutDisplay(); 
    }

    // --- Checkout Logic ---
    const cashModal = document.getElementById('cash-modal');
    const cashAmountInput = document.getElementById('cash-amount-input');
    const cashTotalDisplay = document.getElementById('cash-total-display');
    const changeModal = document.getElementById('change-modal');
    const changeDueDisplay = document.getElementById('change-due-display');
    
    function updateCheckoutDisplay() {
        remainingDue = activeTotal - activeLoyaltyRedeemed - activeGiftCardRedeemed;
        if (remainingDue < 0) remainingDue = 0;
        
        let displayHTML = `Total: $${activeTotal.toFixed(2)}`;
        if (activeLoyaltyRedeemed > 0) displayHTML += `<br><span style="color:#E91E63; font-size:1.2rem;">- Points: $${activeLoyaltyRedeemed.toFixed(2)}</span>`;
        if (activeGiftCardRedeemed > 0) displayHTML += `<br><span style="color:#9C27B0; font-size:1.2rem;">- Gift Card: $${activeGiftCardRedeemed.toFixed(2)}</span>`;
        displayHTML += `<br><strong style="color:#4CAF50; font-size:1.8rem;">Due: $${remainingDue.toFixed(2)}</strong>`;
        
        modalTotalDisplay.innerHTML = displayHTML;
        
        const pointsBtn = document.getElementById('btn-pay-points');
        if (pointsBtn) {
            if (currentCustomer && currentCustomer.loyalty_balance > 0 && remainingDue > 0) {
                pointsBtn.style.display = 'block';
                pointsBtn.textContent = `Pay with Points ($${currentCustomer.loyalty_balance.toFixed(2)})`;
            } else {
                pointsBtn.style.display = 'none';
            }
        }
    }

    checkoutBtn.addEventListener('click', () => {
        updateCheckoutDisplay();
        modal.classList.remove('hidden');
    });

    document.getElementById('cancel-checkout-btn').addEventListener('click', () => modal.classList.add('hidden'));

    // Split: Pay with Points
    const pointsBtn = document.getElementById('btn-pay-points');
    if (pointsBtn) {
        pointsBtn.addEventListener('click', () => {
            if (!currentCustomer || remainingDue <= 0) return;
            let available = currentCustomer.loyalty_balance - activeLoyaltyRedeemed; 
            if (available <= 0) return;
            let amountToDeduct = remainingDue;
            if (available < remainingDue) amountToDeduct = available; 
            
            activeLoyaltyRedeemed += amountToDeduct;
            updateCheckoutDisplay();
            if (remainingDue <= 0) finalizeSale('Loyalty Points', activeTotal, 0);
        });
    }

    // Split: Pay with Gift Card
    const gcBtn = document.getElementById('btn-pay-giftcard');
    const gcModal = document.getElementById('gc-checkout-modal');
    const gcInput = document.getElementById('gc-swipe-input');

    if (gcBtn) {
        gcBtn.addEventListener('click', () => {
            if (remainingDue <= 0) return;
            document.getElementById('gc-remaining-display').textContent = `Remaining Due: $${remainingDue.toFixed(2)}`;
            gcInput.value = '';
            gcModal.classList.remove('hidden');
            setTimeout(() => gcInput.focus(), 10);
        });
    }

    if (document.getElementById('cancel-gc-pay-btn')) document.getElementById('cancel-gc-pay-btn').addEventListener('click', () => gcModal.classList.add('hidden'));

    if (document.getElementById('apply-gc-pay-btn')) {
        document.getElementById('apply-gc-pay-btn').addEventListener('click', async () => {
            const hash = gcInput.value;
            if (!hash) return;
            try {
                const gc = await window.api.checkGiftCard(hash);
                if (!gc || gc.balance <= 0) return alert("Invalid or empty Gift Card.");
                let amountToDeduct = remainingDue;
                if (gc.balance < remainingDue) amountToDeduct = gc.balance; 
                
                activeGiftCardRedeemed += amountToDeduct;
                activeGiftCardHash = hash;
                gcModal.classList.add('hidden');
                updateCheckoutDisplay();
                if (remainingDue <= 0) finalizeSale('Gift Card', activeTotal, 0);
            } catch (e) { alert("Error checking gift card."); }
        });
    }

    // Final Tender Selection
    let pendingTenderType = "";
    document.querySelectorAll('.tender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (remainingDue <= 0) return; 
            
            pendingTenderType = e.currentTarget.getAttribute('data-tender');
            if (!pendingTenderType) return;
            
            if (pendingTenderType === 'Cash') {
                modal.classList.add('hidden');
                cashTotalDisplay.textContent = `Due: $${remainingDue.toFixed(2)}`;
                cashAmountInput.value = '';
                cashModal.classList.remove('hidden');
                setTimeout(() => cashAmountInput.focus(), 10);
            } else {
                finalizeSale(pendingTenderType, remainingDue, 0);
            }
        });
    });

    // --- NEW: Cash Modal Numpad Logic ---
    document.querySelectorAll('.cash-num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.textContent;
            if (val === 'Exact') {
                cashAmountInput.value = remainingDue.toFixed(2);
            } else {
                cashAmountInput.value += val;
            }
            cashAmountInput.focus();
        });
    });

    document.querySelector('.cash-btn-clear').addEventListener('click', () => {
        cashAmountInput.value = "";
        cashAmountInput.focus();
    });

    document.getElementById('confirm-cash-btn').addEventListener('click', () => {
        const amountTendered = parseFloat(cashAmountInput.value);
        if (isNaN(amountTendered) || amountTendered < remainingDue) return alert("Not enough cash provided!");
        
        const changeDue = amountTendered - remainingDue;
        cashModal.classList.add('hidden');
        finalizeSale('Cash', amountTendered, changeDue);
    });

    document.getElementById('cancel-cash-btn').addEventListener('click', () => {
        cashModal.classList.add('hidden');
        modal.classList.remove('hidden'); 
    });

    // --- The Final Database Call ---
    async function finalizeSale(tenderType, amountTendered, changeDue) {
        // Calculate loyalty points earned 
        // Note: Do not award points ON the purchase of a gift card, only regular items
        let loyaltyEligibleTotal = 0;
        currentCart.forEach(item => { if (!item.isGiftCard) loyaltyEligibleTotal += item.price; });
        const loyaltyEarned = currentCustomer ? (loyaltyEligibleTotal * 0.05) : 0;
        
        let finalTenderType = tenderType;
        if ((activeLoyaltyRedeemed > 0 || activeGiftCardRedeemed > 0) && tenderType !== 'Loyalty Points' && tenderType !== 'Gift Card') {
            finalTenderType = `Split (${tenderType})`;
        }

        const orderData = {
            userId: activeUserId, 
            customerId: currentCustomer ? currentCustomer.id : null,
            subtotal: activeSubtotal,
            discountAmount: activeDiscountAmount,
            tax: activeTax,
            total: activeTotal,
            loyaltyEarned: loyaltyEarned,
            loyaltyRedeemed: activeLoyaltyRedeemed,
            giftCardRedeemed: activeGiftCardRedeemed,
            giftCardHash: activeGiftCardHash,
            tenderType: finalTenderType,
            amountTendered: amountTendered,
            changeDue: changeDue,
            cart: currentCart
        };

        try {
            const response = await window.api.processCheckout(orderData);
            const newTicketId = response.ticketId;
            
            // ACTIVATE ANY SOLD GIFT CARDS
            for (let item of currentCart) {
                if (item.isGiftCard) {
                    await window.api.issueGiftCard(item.gcHash, item.price, null);
                }
            }

            // Populate Receipt
            document.getElementById('receipt-date').textContent = new Date().toLocaleString();
            document.getElementById('receipt-ticket-id').textContent = newTicketId.toString().padStart(6, '0');
            document.getElementById('receipt-cashier-name').textContent = window.currentUser ? window.currentUser.first_name : 'System';
           
            const receiptItems = document.getElementById('receipt-items');
            receiptItems.innerHTML = '';
            
            const receiptGrouped = {};
            currentCart.forEach(item => {
                if(receiptGrouped[item.id]) {
                    receiptGrouped[item.id].qty += 1;
                    receiptGrouped[item.id].totalPrice += item.price;
                } else {
                    receiptGrouped[item.id] = { name: item.name, qty: 1, totalPrice: item.price };
                }
            });

            Object.values(receiptGrouped).forEach(group => {
                const displayName = group.qty > 1 ? `${group.name} x${group.qty}` : group.name;
                receiptItems.innerHTML += `<tr><td style="padding-bottom: 5px;">${displayName}</td><td style="text-align: right; padding-bottom: 5px;">$${group.totalPrice.toFixed(2)}</td></tr>`;
            });

            document.getElementById('receipt-subtotal').textContent = `$${activeSubtotal.toFixed(2)}`;
            document.getElementById('receipt-tax').textContent = `$${activeTax.toFixed(2)}`;
            document.getElementById('receipt-total').textContent = `$${activeTotal.toFixed(2)}`;
            document.getElementById('receipt-tender-type').textContent = finalTenderType;
            document.getElementById('receipt-tender-amount').textContent = `$${amountTendered.toFixed(2)}`;
            document.getElementById('receipt-change-due').textContent = `$${changeDue.toFixed(2)}`;

            // Reset Everything
            currentCart.length = 0;
            currentCustomer = null;
            currentDiscountPercent = 0;
            activeLoyaltyRedeemed = 0;
            activeGiftCardRedeemed = 0;
            activeGiftCardHash = null;
            window.globalActiveCustomer = null;
            window.globalActiveDiscount = 0;
            
            updateCustomerUI();
            updateCartUI();
            
            modal.classList.add('hidden');
            lastScannedMsg.textContent = "Ready for next customer...";
            lastScannedMsg.style.color = "#fff";

            if (tenderType === 'Cash') {
                changeDueDisplay.textContent = `$${changeDue.toFixed(2)}`;
                changeModal.classList.remove('hidden');
            } else {
                document.getElementById('receipt-modal').classList.remove('hidden');
            }

        } catch (error) {
            console.error(error);
            alert("Database error processing transaction.");
        }
    }

    if (document.getElementById('close-change-btn')) {
        document.getElementById('close-change-btn').addEventListener('click', () => {
            changeModal.classList.add('hidden');
            document.getElementById('receipt-modal').classList.remove('hidden');
        });
    }

    const closeBtn = document.getElementById('close-register-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.removeEventListener('keydown', handleKeydown);
            renderHomeDashboard(); 
        });
    }

    if (document.getElementById('close-receipt-btn')) document.getElementById('close-receipt-btn').addEventListener('click', () => document.getElementById('receipt-modal').classList.add('hidden'));

    updateCustomerUI();
    updateCartUI();
})();