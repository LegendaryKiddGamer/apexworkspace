const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let isQuitting = false;
let reminderTimers = new Map();
let reminderStateCache = {};
let reminderScanInterval = null;
let notifiedReminderKeys = new Set();

function showDesktopNotification(title, body) {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
    }
}

function clearReminderTimers() {
    for (const timeoutId of reminderTimers.values()) {
        clearTimeout(timeoutId);
    }
    reminderTimers.clear();
}

function reminderKey(reminder) {
    return `${reminder.id || 'unknown'}::${reminder.deadline || ''}`;
}

function scanDueReminderNotifications(reminderState = reminderStateCache) {
    const now = Date.now();

    Object.entries(reminderState || {}).forEach(([directoryName, reminders]) => {
        if (!Array.isArray(reminders)) return;

        reminders.forEach((reminder) => {
            if (!reminder || !reminder.deadline) return;

            const deadlineTime = new Date(reminder.deadline).getTime();
            if (!Number.isFinite(deadlineTime) || deadlineTime > now) return;

            const key = reminderKey(reminder);
            if (notifiedReminderKeys.has(key)) return;

            const reminderTitle = reminder.title || 'Apex Reminder';
            const reminderBody = `Deadline reached in ${directoryName}${reminder.description ? `: ${reminder.description}` : ''}`;
            showDesktopNotification(reminderTitle, reminderBody);
            notifiedReminderKeys.add(key);
        });
    });
}

function scheduleReminderNotifications(reminderState = {}) {
    reminderStateCache = reminderState || {};
    clearReminderTimers();
    scanDueReminderNotifications(reminderStateCache);

    const now = Date.now();
    Object.entries(reminderStateCache).forEach(([directoryName, reminders]) => {
        if (!Array.isArray(reminders)) return;

        reminders.forEach((reminder) => {
            if (!reminder || !reminder.deadline) return;

            const deadlineTime = new Date(reminder.deadline).getTime();
            if (!Number.isFinite(deadlineTime)) return;

            const delay = deadlineTime - now;
            if (delay <= 0) return;

            const reminderTitle = reminder.title || 'Apex Reminder';
            const reminderBody = `Deadline due in ${directoryName}${reminder.description ? `: ${reminder.description}` : ''}`;
            const key = reminderKey(reminder);

            const timeoutId = setTimeout(() => {
                if (!notifiedReminderKeys.has(key)) {
                    showDesktopNotification(reminderTitle, reminderBody);
                    notifiedReminderKeys.add(key);
                }
                reminderTimers.delete(reminder.id);
            }, delay);

            reminderTimers.set(reminder.id, timeoutId);
        });
    });

    if (!reminderScanInterval) {
        reminderScanInterval = setInterval(() => {
            scanDueReminderNotifications();
        }, 30 * 1000);
    }
}

function createWorkspaceWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#18181b',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.on('close', (event) => {
        if (isQuitting) return;
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.loadFile('index.html');
}

function showWorkspaceWindow() {
    if (!mainWindow) {
        createWorkspaceWindow();
        return;
    }

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

function createTray() {
    const trayIconPath = path.join(__dirname, '..', 'electron.icns');
    const trayIcon = nativeImage.createFromPath(trayIconPath);

    if (trayIcon.isEmpty()) {
        return;
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Apex Workspace Matrix OS');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Show Apex Workspace', click: showWorkspaceWindow },
        { label: 'Test Notification', click: () => showDesktopNotification('Apex Diagnostic Channel', 'Desktop notifications layer successfully verified!') },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]));
    tray.on('click', showWorkspaceWindow);
}

app.whenReady().then(() => {
    createWorkspaceWindow();
    createTray();

    app.on('activate', () => {
        showWorkspaceWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
    if (reminderScanInterval) clearInterval(reminderScanInterval);
    clearReminderTimers();
});

ipcMain.on('trigger-test-notification', (event) => {
    showDesktopNotification('Apex Diagnostic Channel', 'Desktop notifications layer successfully verified!');
});

ipcMain.on('show-reminder-notification', (event, payload = {}) => {
    const title = payload.title || 'Apex Reminder';
    const body = payload.body || 'A reminder action was triggered.';
    showDesktopNotification(title, body);
});

ipcMain.on('sync-reminder-state', (event, reminderState = {}) => {
    scheduleReminderNotifications(reminderState);
});
