import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const GoogleSignIn = ({ onSuccess, onError }) => {
  const buttonRef = useRef(null);
  const { actions } = useAuthStore();

  useEffect(() => {
    // Check if Google Identity Services is loaded
    if (!window.google?.accounts?.id) {
      console.error('Google Identity Services not loaded');
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('VITE_GOOGLE_CLIENT_ID not configured');
      return;
    }

    // Initialize Google Sign In
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render the button
    if (buttonRef.current) {
      window.google.accounts.id.renderButton(
        buttonRef.current,
        {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280,
        }
      );
    }

    // Optional: Display One Tap prompt
    // window.google.accounts.id.prompt();
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      const result = await actions.signInGoogle(response.credential);
      
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      
      if (onError) {
        onError(error);
      }
    }
  };

  return (
    <div className="google-signin-container">
      <div ref={buttonRef} id="googleSignInButton"></div>
    </div>
  );
};

export default GoogleSignIn;