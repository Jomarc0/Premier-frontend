console.log('[SW] Service Worker script loaded');

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

console.log('[SW] Firebase scripts imported');

const firebaseConfig = {
    apiKey: "AIzaSyDrkoZYMiXZGN3dP3OMQx8fzDFE5Zg_Qy4",
    authDomain: "batrasco-249e2.firebaseapp.com",
    projectId: "batrasco-249e2",
    storageBucket: "batrasco-249e2.firebasestorage.app",
    messagingSenderId: "305280697087",
    appId: "1:305280697087:web:3e90a05a495d278e7742ca"
};

console.log('[SW] Initializing Firebase with config:', firebaseConfig.projectId);

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    console.log('[SW] Firebase initialized successfully');

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] Background message received:', payload);
        
        const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.body || 'You have a new notification',
            icon: '/icon.png',
            badge: '/badge.png',
            tag: 'batrasco-notification-' + Date.now(),
            requireInteraction: false,
            data: payload.data || {},
            actions: [
                {
                    action: 'open',
                    title: 'View'
                },
                {
                    action: 'close',
                    title: 'Dismiss'
                }
            ]
        };
        
        console.log('[SW] Showing notification:', notificationTitle);
        
        return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // Handle notification clicks
    self.addEventListener('notificationclick', (event) => {
        console.log('[SW] Notification clicked:', event.action);
        
        event.notification.close();
        
        if (event.action === 'close') {
            return;
        }
        
        // Open or focus the dashboard
        event.waitUntil(
            clients.matchAll({ 
                type: 'window', 
                includeUncontrolled: true 
            }).then(clientList => {
                // Check if dashboard is already open
                for (let client of clientList) {
                    if (client.url.includes('dashboard') && 'focus' in client) {
                        console.log('[SW] Focusing existing window');
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    console.log('[SW] Opening new window');
                    return clients.openWindow('/passenger/dashboard.php');
                }
            })
        );
    });

    console.log('[SW] All event listeners registered');

} catch (error) {
    console.error('[SW] Firebase initialization error:', error);
}

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activated');
    event.waitUntil(clients.claim());
});

// Service worker installation
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker installed');
    self.skipWaiting();
});

console.log('[SW] Service Worker setup complete');