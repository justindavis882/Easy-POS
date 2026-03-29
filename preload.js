const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Register Applet
    scanItem: (barcode) => ipcRenderer.invoke('scan-item', barcode),
    processCheckout: (orderData) => ipcRenderer.invoke('process-checkout', orderData),
    
    // Silent Printing
    printReceipt: (htmlContent) => ipcRenderer.invoke('print-receipt', htmlContent),

    // Login / Timeclock
    loginEmployee: (msrHash) => ipcRenderer.invoke('login-employee', msrHash),
    punchTimeClock: (userId) => ipcRenderer.invoke('punch-timeclock', userId),

    // Inventory Applet
    getAllItems: () => ipcRenderer.invoke('get-all-items'),
    saveItem: (itemData) => ipcRenderer.invoke('save-item', itemData),
    deleteItem: (itemId) => ipcRenderer.invoke('delete-item', itemId),
    logInventory: (logData) => ipcRenderer.invoke('log-inventory', logData),

    // Settings Applet (These are the ones your console is looking for!)
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value),

    // User Management
    getUsers: () => ipcRenderer.invoke('get-users'),
    getRoles: () => ipcRenderer.invoke('get-roles'),
    saveUser: (userData) => ipcRenderer.invoke('save-user', userData),

    // Customer CRM
    getCustomers: () => ipcRenderer.invoke('get-customers'),
    saveCustomer: (customerData) => ipcRenderer.invoke('save-customer', customerData),
    deleteCustomer: (customerId) => ipcRenderer.invoke('delete-customer', customerId),
});