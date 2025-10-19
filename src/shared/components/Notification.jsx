// src/shared/components/Notification.jsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

// Ajouter les animations globales une seule fois
if (typeof document !== 'undefined' && !document.getElementById('notification-animations')) {
  const style = document.createElement('style');
  style.id = 'notification-animations';
  style.textContent = `
    @keyframes notificationSlideIn {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes notificationSlideOut {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}

export const Notification = ({ 
  type = 'info', 
  message, 
  duration = 5000, 
  onClose,
  position = 'top-right' 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const icons = {
    success: <CheckCircle size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />
  };

  const styles = {
    success: {
      backgroundColor: '#10b981',
      color: 'white',
      borderLeft: '4px solid #047857'
    },
    error: {
      backgroundColor: '#ef4444',
      color: 'white',
      borderLeft: '4px solid #b91c1c'
    },
    warning: {
      backgroundColor: '#f59e0b',
      color: 'white',
      borderLeft: '4px solid #d97706'
    },
    info: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderLeft: '4px solid #1d4ed8'
    }
  };

  const positions = {
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' }
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...positions[position],
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '500px',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        ...styles[type],
        animation: isLeaving ? 'notificationSlideOut 0.3s ease-out' : 'notificationSlideIn 0.3s ease-out',
        opacity: isLeaving ? 0 : 1,
        transition: 'opacity 0.3s, transform 0.3s'
      }}
    >
      {icons[type]}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{message}</p>
      </div>
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.8,
          transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.opacity = 1}
        onMouseLeave={(e) => e.target.style.opacity = 0.8}
      >
        <X size={18} />
      </button>

    </div>
  );
};

// Hook pour gérer les notifications
let notificationId = 0;
const notifications = new Map();
let updateNotifications = null;

export const useNotifications = () => {
  const [notificationList, setNotificationList] = useState([]);

  useEffect(() => {
    updateNotifications = setNotificationList;
    return () => {
      updateNotifications = null;
    };
  }, []);

  const showNotification = (message, type = 'info', duration = 5000) => {
    const id = ++notificationId;
    const notification = { id, message, type, duration };
    
    notifications.set(id, notification);
    if (updateNotifications) {
      updateNotifications(Array.from(notifications.values()));
    }

    return id;
  };

  const hideNotification = (id) => {
    notifications.delete(id);
    if (updateNotifications) {
      updateNotifications(Array.from(notifications.values()));
    }
  };

  return {
    notifications: notificationList,
    showSuccess: (message, duration) => showNotification(message, 'success', duration),
    showError: (message, duration) => showNotification(message, 'error', duration),
    showWarning: (message, duration) => showNotification(message, 'warning', duration),
    showInfo: (message, duration) => showNotification(message, 'info', duration),
    hideNotification
  };
};

// Composant conteneur pour afficher toutes les notifications
export const NotificationContainer = () => {
  const { notifications, hideNotification } = useNotifications();

  return (
    <>
      {notifications.map((notif, index) => (
        <div key={notif.id} style={{ marginTop: index > 0 ? '10px' : 0 }}>
          <Notification
            type={notif.type}
            message={notif.message}
            duration={notif.duration}
            onClose={() => hideNotification(notif.id)}
            position="top-right"
          />
        </div>
      ))}
    </>
  );
};

// Fonction utilitaire pour afficher une notification sans hook
export const showNotification = (message, type = 'info', duration = 5000) => {
  const id = ++notificationId;
  const notification = { id, message, type, duration };
  
  notifications.set(id, notification);
  if (updateNotifications) {
    updateNotifications(Array.from(notifications.values()));
  }
  
  setTimeout(() => {
    notifications.delete(id);
    if (updateNotifications) {
      updateNotifications(Array.from(notifications.values()));
    }
  }, duration);
};

export default Notification;