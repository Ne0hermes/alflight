import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get, set, del } from 'idb-keyval';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// IndexedDB keys
const IDB_USER_KEY = 'alflight_user';
const IDB_ENTITLEMENTS_KEY = 'alflight_entitlements';
const IDB_ENTITLEMENTS_TIMESTAMP = 'alflight_entitlements_timestamp';

// Cache duration (1 hour)
const ENTITLEMENTS_CACHE_DURATION = 60 * 60 * 1000;

export const useAuthStore = create(
  immer((setState, getState) => ({
    // State
    user: null,
    entitlements: [],
    status: 'idle', // idle | loading | authenticated | error
    error: null,
    isOffline: false,

    // Actions
    actions: {
      // Initialize from cache on app start
      async initialize() {
        setState(state => {
          state.status = 'loading';
        });

        try {
          // Try to load cached data
          const [cachedUser, cachedEntitlements] = await Promise.all([
            get(IDB_USER_KEY),
            get(IDB_ENTITLEMENTS_KEY)
          ]);

          if (cachedUser) {
            setState(state => {
              state.user = cachedUser;
            });
          }

          if (cachedEntitlements) {
            setState(state => {
              state.entitlements = cachedEntitlements;
            });
          }

          // Try to fetch fresh data from server
          await getState().actions.fetchMe();
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          setState(state => {
            state.status = 'error';
            state.error = error.message;
          });
        }
      },

      // Fetch current user from server
      async fetchMe() {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            credentials: 'include', // Include cookies
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.status === 401) {
            // Not authenticated
            setState(state => {
              state.user = null;
              state.entitlements = [];
              state.status = 'idle';
            });
            
            // Clear cache
            await Promise.all([
              del(IDB_USER_KEY),
              del(IDB_ENTITLEMENTS_KEY),
              del(IDB_ENTITLEMENTS_TIMESTAMP)
            ]);
            
            return null;
          }

          if (!response.ok) {
            throw new Error('Failed to fetch user');
          }

          const data = await response.json();
          
          // Update state
          setState(state => {
            state.user = data.user;
            state.entitlements = data.entitlements || [];
            state.status = 'authenticated';
            state.error = null;
            state.isOffline = false;
          });

          // Cache data
          await Promise.all([
            set(IDB_USER_KEY, data.user),
            set(IDB_ENTITLEMENTS_KEY, data.entitlements || []),
            set(IDB_ENTITLEMENTS_TIMESTAMP, Date.now())
          ]);

          return data;
        } catch (error) {
          console.error('Failed to fetch user:', error);
          
          // If offline, use cached data
          if (!navigator.onLine || error.message.includes('Failed to fetch')) {
            setState(state => {
              state.isOffline = true;
            });
            
            const cachedTimestamp = await get(IDB_ENTITLEMENTS_TIMESTAMP);
            if (cachedTimestamp && Date.now() - cachedTimestamp < ENTITLEMENTS_CACHE_DURATION) {
              // Cache is still valid
              setState(state => {
                state.status = 'authenticated';
              });
              return;
            }
          }
          
          setState(state => {
            state.status = 'error';
            state.error = error.message;
          });
          
          throw error;
        }
      },

      // Google Sign In
      async signInGoogle(credential) {
        setState(state => {
          state.status = 'loading';
          state.error = null;
        });

        try {
          const response = await fetch(`${API_BASE_URL}/auth/google`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: credential }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to sign in with Google');
          }

          const data = await response.json();
          
          // Update state
          setState(state => {
            state.user = data.user;
            state.entitlements = data.entitlements || [];
            state.status = 'authenticated';
            state.error = null;
          });

          // Cache data
          await Promise.all([
            set(IDB_USER_KEY, data.user),
            set(IDB_ENTITLEMENTS_KEY, data.entitlements || []),
            set(IDB_ENTITLEMENTS_TIMESTAMP, Date.now())
          ]);

          return data;
        } catch (error) {
          console.error('Google sign in failed:', error);
          setState(state => {
            state.status = 'error';
            state.error = error.message;
          });
          throw error;
        }
      },

      // Apple Sign In
      async signInApple(idToken, code) {
        setState(state => {
          state.status = 'loading';
          state.error = null;
        });

        try {
          const response = await fetch(`${API_BASE_URL}/auth/apple`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken, code }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to sign in with Apple');
          }

          const data = await response.json();
          
          // Update state
          setState(state => {
            state.user = data.user;
            state.entitlements = data.entitlements || [];
            state.status = 'authenticated';
            state.error = null;
          });

          // Cache data
          await Promise.all([
            set(IDB_USER_KEY, data.user),
            set(IDB_ENTITLEMENTS_KEY, data.entitlements || []),
            set(IDB_ENTITLEMENTS_TIMESTAMP, Date.now())
          ]);

          return data;
        } catch (error) {
          console.error('Apple sign in failed:', error);
          setState(state => {
            state.status = 'error';
            state.error = error.message;
          });
          throw error;
        }
      },

      // Logout
      async logout() {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        }

        // Clear state
        setState(state => {
          state.user = null;
          state.entitlements = [];
          state.status = 'idle';
          state.error = null;
        });

        // Clear cache
        await Promise.all([
          del(IDB_USER_KEY),
          del(IDB_ENTITLEMENTS_KEY),
          del(IDB_ENTITLEMENTS_TIMESTAMP)
        ]);
      },

      // Refresh entitlements
      async refreshEntitlements() {
        if (getState().status !== 'authenticated') {
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/entitlements`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch entitlements');
          }

          const data = await response.json();
          
          setState(state => {
            state.entitlements = data.items || [];
            state.isOffline = false;
          });

          // Cache entitlements
          await Promise.all([
            set(IDB_ENTITLEMENTS_KEY, data.items || []),
            set(IDB_ENTITLEMENTS_TIMESTAMP, Date.now())
          ]);

          return data.items;
        } catch (error) {
          console.error('Failed to refresh entitlements:', error);
          
          // If offline, use cached data
          if (!navigator.onLine || error.message.includes('Failed to fetch')) {
            setState(state => {
              state.isOffline = true;
            });
          }
          
          throw error;
        }
      },

      // Delete account (stub for now)
      async deleteAccount() {
        if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/account/delete`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to delete account');
          }

          // Clear everything
          await getState().actions.logout();
        } catch (error) {
          console.error('Failed to delete account:', error);
          throw error;
        }
      },
    },

    // Computed values
    get isAuthenticated() {
      return getState().status === 'authenticated' && getState().user !== null;
    },

    get hasEntitlement() {
      return (key) => {
        const entitlements = getState().entitlements;
        const entitlement = entitlements.find(e => e.key === key);
        
        if (!entitlement) return false;
        
        // Check if active and not expired
        if (!entitlement.active) return false;
        
        if (entitlement.expiresAt) {
          const expiresAt = new Date(entitlement.expiresAt);
          if (expiresAt < new Date()) return false;
        }
        
        return true;
      };
    }
  }))
);