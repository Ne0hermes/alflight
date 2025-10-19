import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID;
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin;

export const AppleSignIn = ({ onSuccess, onError }) => {
  const buttonRef = useRef(null);
  const { actions } = useAuthStore();

  useEffect(() => {
    // Check if AppleID JS is loaded
    if (!window.AppleID) {
      console.error('Apple Sign In JS not loaded');
      return;
    }

    if (!APPLE_CLIENT_ID) {
      console.error('VITE_APPLE_CLIENT_ID not configured');
      return;
    }

    // Initialize Apple Sign In
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: 'name email',
      redirectURI: APPLE_REDIRECT_URI,
      state: generateState(),
      nonce: generateNonce(),
      usePopup: true,
    });

    // Listen for authorization success
    document.addEventListener('AppleIDSignInOnSuccess', handleSuccess);
    document.addEventListener('AppleIDSignInOnFailure', handleFailure);

    return () => {
      document.removeEventListener('AppleIDSignInOnSuccess', handleSuccess);
      document.removeEventListener('AppleIDSignInOnFailure', handleFailure);
    };
  }, []);

  const generateState = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const generateNonce = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const handleSuccess = async (event) => {
    try {
      const { authorization } = event.detail;
      const result = await actions.signInApple(
        authorization.id_token,
        authorization.code
      );

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
      
      if (onError) {
        onError(error);
      }
    }
  };

  const handleFailure = (event) => {
    console.error('Apple sign in failed:', event.detail);
    
    if (onError) {
      onError(new Error(event.detail.error || 'Apple sign in failed'));
    }
  };

  const handleClick = async () => {
    try {
      await window.AppleID.auth.signIn();
    } catch (error) {
      console.error('Apple sign in error:', error);
      if (onError) {
        onError(error);
      }
    }
  };

  return (
    <div className="apple-signin-container">
      <div
        ref={buttonRef}
        id="appleid-signin"
        className="signin-button"
        data-color="black"
        data-border="true"
        data-type="sign in"
        data-width="280"
        data-height="40"
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          color: '#fff',
          border: '1px solid #000',
          borderRadius: '8px',
          padding: '8px 24px',
          fontSize: '16px',
          fontWeight: '500',
          width: '280px',
          height: '40px',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          style={{ marginRight: '8px' }}
          fill="currentColor"
        >
          <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
        </svg>
        Sign in with Apple
      </div>
    </div>
  );
};

export default AppleSignIn;