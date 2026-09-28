

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PUSH_NOTIFICATIONS_ENABLED } from '../constants';
import { useTranslation } from '../contexts/i18nContext';

const RealtimeNotificationHandler: React.FC = () => {
    const { notifications, user } = useAuth();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const prevNotificationsCount = useRef(notifications.length);
    const mountedAt = useRef(Date.now());
    const shownIds = useRef(new Set<string>());

    useEffect(() => {
        // La lista llega vacia y se rellena al cargar (0 -> N) en cada visita:
        // eso no es una notificacion nueva. Solo se avisa de la que se antepone
        // a una lista ya cargada (tiempo real) o, si la lista estaba vacia, de
        // una creada durante esta visita. Antes salia el aviso de la ultima
        // notificacion en cada carga de pagina mientras existiera.
        const hadList = prevNotificationsCount.current > 0;
        if (notifications.length > prevNotificationsCount.current) {
            const newNotification = notifications[0];
            const createdAt = newNotification ? new Date(newNotification.created_at).getTime() : 0;
            const isNew = !!newNotification
                && !shownIds.current.has(String(newNotification.id))
                && (hadList ? notifications.length === prevNotificationsCount.current + 1 : createdAt >= mountedAt.current - 2 * 60 * 1000);
            if (newNotification) shownIds.current.add(String(newNotification.id));
            if (isNew) {
                 // 1. Show in-app snackbar. En una respuesta de soporte el
                 // mensaje es solo el asunto: se antepone que es de soporte.
                 const snack = newNotification.type === 'support_reply'
                     ? `${t('header.supportReplyTitle')}: ${newNotification.message}`
                     : newNotification.message;
                 showNotification(snack, 'info');

                 // 2. Attempt to send a browser push notification
                 const sendPushNotification = async () => {
                    // Only proceed if browser supports push, user is logged in, and permission is granted
                    if (!PUSH_NOTIFICATIONS_ENABLED || !user || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') {
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

    }, [notifications, showNotification, user, t]);

    return null; // This component does not render anything.
};

export default RealtimeNotificationHandler;