import React, { useState } from 'react';
import { Check, X, Crown, Zap } from 'lucide-react';
import { PRODUCTS, FEATURES_COMPARISON } from '../config/products';
import { useAuthStore } from '../../account/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const Paywall = ({ feature = null, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState('pro_yearly');
  const [isLoading, setIsLoading] = useState(false);
  const { user, status } = useAuthStore();
  const product = PRODUCTS.pro;

  const handleCheckout = async () => {
    if (status !== 'authenticated') {
      alert('Veuillez vous connecter pour continuer');
      return;
    }

    setIsLoading(true);
    
    try {
      const plan = product.plans.find(p => p.id === selectedPlan);
      
      const response = await fetch(`${API_BASE_URL}/billing/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.priceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Erreur lors de la création de la session de paiement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {onClose && (
          <button style={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        )}

        <div style={styles.header}>
          <Crown size={48} style={{ color: '#fbbf24' }} />
          <h2 style={styles.title}>Débloquez ALFlight PRO</h2>
          {feature && (
            <p style={styles.featureBlocked}>
              La fonctionnalité "{feature}" nécessite un abonnement PRO
            </p>
          )}
        </div>

        {/* Plans */}
        <div style={styles.plans}>
          {product.plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...styles.plan,
                ...(selectedPlan === plan.id ? styles.planSelected : {}),
                ...(plan.popular ? styles.planPopular : {}),
              }}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div style={styles.popularBadge}>
                  <Zap size={14} />
                  Populaire
                </div>
              )}
              
              <div style={styles.planHeader}>
                <input
                  type="radio"
                  checked={selectedPlan === plan.id}
                  onChange={() => setSelectedPlan(plan.id)}
                  style={styles.radio}
                />
                <div>
                  <h3 style={styles.planName}>{plan.name}</h3>
                  <div style={styles.planPrice}>
                    <span style={styles.priceAmount}>{plan.price}€</span>
                    <span style={styles.priceInterval}>/{plan.interval === 'month' ? 'mois' : 'an'}</span>
                  </div>
                  {plan.savings && (
                    <div style={styles.savings}>{plan.savings}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div style={styles.features}>
          <h3 style={styles.featuresTitle}>Inclus dans PRO :</h3>
          <ul style={styles.featuresList}>
            {product.features.map((feature, index) => (
              <li key={index} style={styles.featureItem}>
                <Check size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Comparison table */}
        <div style={styles.comparison}>
          <table style={styles.comparisonTable}>
            <thead>
              <tr>
                <th style={styles.comparisonHeader}>Fonctionnalité</th>
                <th style={styles.comparisonHeader}>Gratuit</th>
                <th style={{ ...styles.comparisonHeader, ...styles.comparisonHeaderPro }}>PRO</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FEATURES_COMPARISON.free.features).map(([feature, freeValue]) => (
                <tr key={feature}>
                  <td style={styles.comparisonCell}>{feature}</td>
                  <td style={styles.comparisonCell}>
                    {typeof freeValue === 'boolean' ? (
                      freeValue ? (
                        <Check size={16} style={{ color: '#10b981' }} />
                      ) : (
                        <X size={16} style={{ color: '#ef4444' }} />
                      )
                    ) : (
                      <span>{freeValue}</span>
                    )}
                  </td>
                  <td style={styles.comparisonCell}>
                    {(() => {
                      const proValue = FEATURES_COMPARISON.pro.features[feature];
                      return typeof proValue === 'boolean' ? (
                        proValue ? (
                          <Check size={16} style={{ color: '#10b981' }} />
                        ) : (
                          <X size={16} style={{ color: '#ef4444' }} />
                        )
                      ) : (
                        <span style={{ fontWeight: '600' }}>{proValue}</span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div style={styles.cta}>
          <button
            style={styles.ctaButton}
            onClick={handleCheckout}
            disabled={isLoading}
          >
            {isLoading ? 'Chargement...' : 'Commencer l\'essai PRO'}
          </button>
          <p style={styles.ctaNote}>
            Annulation possible à tout moment • Paiement sécurisé par Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  header: {
    textAlign: 'center',
    padding: '40px 20px 20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '16px 0 8px',
  },
  featureBlocked: {
    color: '#666',
    fontSize: '16px',
    margin: '8px 0',
  },
  plans: {
    display: 'flex',
    gap: '16px',
    padding: '0 40px',
    marginBottom: '32px',
  },
  plan: {
    flex: 1,
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
  },
  planSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  planPopular: {
    borderColor: '#fbbf24',
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fbbf24',
    color: '#000',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  planHeader: {
    display: 'flex',
    gap: '12px',
  },
  radio: {
    marginTop: '4px',
  },
  planName: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  planPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  priceAmount: {
    fontSize: '24px',
    fontWeight: '700',
  },
  priceInterval: {
    color: '#666',
    fontSize: '14px',
  },
  savings: {
    marginTop: '8px',
    padding: '4px 8px',
    backgroundColor: '#10b981',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block',
  },
  features: {
    padding: '0 40px 32px',
  },
  featuresTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  featuresList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '12px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  comparison: {
    padding: '0 40px 32px',
  },
  comparisonTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  comparisonHeader: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #e5e7eb',
    fontSize: '14px',
    fontWeight: '600',
  },
  comparisonHeaderPro: {
    backgroundColor: '#fef3c7',
  },
  comparisonCell: {
    padding: '12px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
  },
  cta: {
    padding: '32px 40px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  ctaNote: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#666',
  },
};