// src/shared/components/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
          <div style={sx.text.center}>
            <AlertTriangle size={48} color="#ef4444" />
            <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mt(4))}>
              Une erreur est survenue
            </h2>
            <button 
              onClick={() => window.location.reload()}
              style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(4))}
            >
              Rafraîchir
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;