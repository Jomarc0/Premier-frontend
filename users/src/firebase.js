import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';


const firebaseConfig = {
    apiKey: "AIzaSyBsUaayGbxYDUm15rK34GxxOYrPjIVGHgA",
    authDomain: "premier-b25d6.firebaseapp.com",
    projectId: "premier-b25d6",
    storageBucket: "premier-b25d6.firebasestorage.app",
    messagingSenderId: "352529483146",
    appId: "1:352529483146:web:d9659a0a73ba1c9e7ff473",
    measurementId: "G-HH936CH0LH"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Replace with YOUR VAPID key from Step 4
const VAPID_KEY = "BOeAzSL4NeYDipdxbll3UnrKT7UC-qJLzSr4J7hb9qZLrE5qOBS9BMkFXuslBPLdWvbkIFOOtoO7CpF8LfYkIXk";

// Request permission and get FCM token
export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY
            });
            console.log('FCM Token:', token);
            return token;
        } else {
            console.log('Notification permission denied');
            return null;
        }
    } catch (error) {
        console.error('FCM error:', error);
        return null;
    }
};

// Handle foreground notifications
export const onForegroundMessage = (callback) => {
    return onMessage(messaging, (payload) => {
        console.log('Message received:', payload);
        callback(payload);
    });
};

export { messaging };