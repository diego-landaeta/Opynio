

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const RealtimeNotificationHandler: React.FC = () => {
    const { notifications, user } = useAuth();
    const { showNotification } = useNotification();
    const isInitialLoad = useRef(true);
    const prevNotificationsCount = useRef(notifications.length);

    useEffect(() => {
        // Skip the initial render to avoid showing notifications for existing unread messages on load.
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            prevNotificationsCount.current = notifications.length;
            return;
        }

        // If a new notification has been added (prepended to the start of the array)
        if (notifications.length > prevNotificationsCount.current) {
            const newNotification = notifications[0];
            if (newNotification) {
                 // 1. Show in-app snackbar
                 showNotification(newNotification.message, 'info');

                 // 2. Attempt to send a browser push notification
                 const sendPushNotification = async () => {
                    // Only proceed if browser supports push, user is logged in, and permission is granted
                    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') {
                        return;
                    }
                    try {
                        const registration = await navigator.serviceWorker.ready;
                        // The URL must include the hash for HashRouter to work correctly on notification click
                        const url = `/empresa/${newNotification.related_business_id}`;

                        await registration.showNotification('¡Nueva respuesta a tu reseña!', {
                            body: newNotification.message,
                            icon: '/icon-192.png',
                            badge: '/icon-192.png', // A badge for Android devices
                            data: {
                                url: url
                            },
                        });
                    } catch (error) {
                        console.error('Error showing push notification:', error);
                    }
                 };

                 sendPushNotification();
            }
        }
        
        prevNotificationsCount.current = notifications.length;

    }, [notifications, showNotification, user]);

    return null; // This component does not render anything.
};

export default RealtimeNotificationHandler;