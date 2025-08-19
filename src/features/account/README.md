# ALFlight Authentication & Billing Module

## Overview

This module provides a complete authentication and subscription management system for ALFlight, featuring:
- OAuth authentication (Google & Apple Sign In)
- Subscription management with Stripe
- Offline-capable entitlements with IndexedDB caching
- Paywall components for gating PRO features

## Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:3000/api

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Apple Sign In
VITE_APPLE_CLIENT_ID=your-apple-service-id
VITE_APPLE_REDIRECT_URI=https://your-domain.com

# Stripe Price IDs
VITE_STRIPE_PRICE_ID_PRO_MONTHLY=price_xxx
VITE_STRIPE_PRICE_ID_PRO_YEARLY=price_xxx
```

### 2. Install Dependencies

```bash
npm install zustand immer idb-keyval lucide-react
```

### 3. Initialize Auth Store

In your main App component:

```jsx
import { useAuthStore } from './features/account/stores/authStore';

function App() {
  useEffect(() => {
    // Initialize auth on app start
    useAuthStore.getState().actions.initialize();
  }, []);

  return (
    // Your app content
  );
}
```

## Usage

### Basic Authentication

```jsx
import { AccountPanel } from './features/account/components/AccountPanel';

// Add the account panel to your app
<AccountPanel />
```

### Gating Features with ProGate

```jsx
import { ProGate } from './features/billing/components/ProGate';

// Basic usage - blocks content completely
<ProGate feature="Calculs de performance avancés">
  <AdvancedFeature />
</ProGate>

// With teaser - shows blurred preview
<ProGate feature="Cartes VAC HD" showTeaser={true}>
  <VACViewer />
</ProGate>

// With custom fallback for free users
<ProGate 
  feature="Export PDF" 
  fallback={<BasicExport />}
>
  <ProfessionalExport />
</ProGate>
```

### Checking Entitlements Programmatically

```jsx
import { useAuthStore } from './features/account/stores/authStore';

function MyComponent() {
  const { user, hasEntitlement, status } = useAuthStore();
  const isPro = hasEntitlement('pro');

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <SignInPrompt />;
  }

  return (
    <div>
      {isPro ? (
        <ProFeatures />
      ) : (
        <FreeFeatures />
      )}
    </div>
  );
}
```

### Managing Subscriptions

```jsx
import { ManageSubscriptionButton } from './features/billing/components/ManageSubscriptionButton';

// Add button for PRO users to manage their subscription
<ManageSubscriptionButton />
```

## Components

### Authentication Components

- **AccountPanel**: Complete account management UI
- **GoogleSignIn**: Google OAuth sign-in button
- **AppleSignIn**: Apple Sign In button

### Billing Components

- **ProGate**: Gates content behind PRO subscription
- **Paywall**: Modal paywall with pricing and features
- **ManageSubscriptionButton**: Opens Stripe Customer Portal

### Store

- **useAuthStore**: Zustand store for auth state
  - `user`: Current user object
  - `entitlements`: Array of active entitlements
  - `status`: Auth status (idle/loading/authenticated/error)
  - `isOffline`: Offline mode indicator
  - `hasEntitlement(key)`: Check if user has specific entitlement
  - `actions.signInGoogle()`: Google sign in
  - `actions.signInApple()`: Apple sign in
  - `actions.logout()`: Sign out
  - `actions.refreshEntitlements()`: Refresh entitlements from server

## Features

### Offline Support

The module caches user data and entitlements in IndexedDB for offline access:
- Entitlements are cached for 1 hour
- User can access PRO features offline if previously authenticated
- Automatic fallback to cache when network is unavailable

### Security

- JWT tokens stored in httpOnly cookies
- No sensitive data in localStorage
- Secure OAuth flows with Google and Apple
- Server-side validation of all entitlements

### PRO Features

Features gated behind PRO subscription:
- Advanced performance calculations with AI interpolation
- OCR analysis of flight manuals
- High-resolution VAC cards
- Professional PDF export
- Advanced weight & balance calculations
- Multi-source real-time weather
- Priority support

## Integration Examples

See `src/features/account/examples/ProGateExamples.jsx` for complete integration examples.

## Backend Requirements

This module requires the auth server to be running. See `alflight-auth-server/README.md` for backend setup instructions.

## Support

For issues or questions, please contact the ALFlight development team.