// src/features/performance/components/APIConfiguration.jsx
import React, { useState, useEffect } from 'react';
import { Key, Save, Eye, EyeOff, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const APIConfiguration = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Charger la configuration existante
  useEffect(() => {
    // D'abord essayer de charger depuis les variables d'environnement
    const envKey = import.meta?.env?.VITE_OPENAI_API_KEY;
    const existingKey = localStorage.getItem('alflight_ai_api_key') || envKey;
    const existingProvider = localStorage.getItem('alflight_ai_provider') || 'openai';
    
    if (existingKey) {
      setApiKey(existingKey);
      // Si la clé vient de l'environnement, la sauvegarder dans localStorage
      if (envKey && !localStorage.getItem('alflight_ai_api_key')) {
        localStorage.setItem('alflight_ai_api_key', envKey);
        localStorage.setItem('openai_api_key', envKey); // Pour compatibilité
        
      }
    }
    setProvider(existingProvider);
  }, []);

  // Sauvegarder la configuration
  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Veuillez entrer une clé API' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Sauvegarder dans localStorage (en production, utiliser une méthode plus sécurisée)
      localStorage.setItem('alflight_ai_api_key', apiKey);
      localStorage.setItem('alflight_ai_provider', provider);
      
      // Mettre à jour les variables globales pour l'utilisation runtime
      if (provider === 'openai' && typeof window !== 'undefined') {
        window.REACT_APP_OPENAI_API_KEY = apiKey;
        window.REACT_APP_AI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
      }
      
      setMessage({ 
        type: 'success', 
        text: 'Configuration sauvegardée ! Rechargez la page pour appliquer les changements.' 
      });
      
      // Fermer après 2 secondes
      setTimeout(() => {
        if (onClose) onClose();
        // Recharger la page pour appliquer les changements
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `Erreur lors de la sauvegarde: ${error.message}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        ⚙️ Configuration de l'API d'analyse IA
      </h4>

      {/* Information */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div>
          <p style={sx.text.sm}>
            L'analyse IA permet d'extraire automatiquement les distances de performances
            depuis les tableaux de votre manuel de vol.
          </p>
          {apiKey && (
            <p style={{...sx.text.sm, marginTop: '8px', fontWeight: 'bold', color: '#10b981'}}>
              ✅ Clé API détectée et configurée automatiquement
            </p>
          )}
        </div>
      </div>

      {/* Sélection du provider */}
      <div style={sx.spacing.mb(4)}>
        <label style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Fournisseur d'IA
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={sx.combine(sx.components.input.base, sx.spacing.mt(1))}
        >
          <option value="openai">OpenAI GPT-4 Vision (recommandé)</option>
          <option value="claude">Claude Vision (bientôt disponible)</option>
          <option value="local">Modèle local (gratuit, moins précis)</option>
        </select>
      </div>

      {/* Instructions selon le provider */}
      {provider === 'openai' && (
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(4))}>
          <h5 style={sx.text.sm}>Pour obtenir une clé API OpenAI :</h5>
          <ol style={sx.combine(sx.text.xs, sx.spacing.mt(2))}>
            <li>1. Créez un compte sur <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">platform.openai.com</a></li>
            <li>2. Allez dans "API Keys" dans votre compte</li>
            <li>3. Cliquez sur "Create new secret key"</li>
            <li>4. Copiez la clé et collez-la ci-dessous</li>
          </ol>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
            💰 Coût estimé : ~0.01€ par analyse de tableau
          </p>
        </div>
      )}

      {provider === 'local' && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.text.sm}>
              Mode local : nécessite l'installation d'Ollama avec un modèle vision.
            </p>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
              Précision réduite par rapport aux modèles cloud.
            </p>
          </div>
        </div>
      )}

      {/* Champ de clé API */}
      {provider !== 'local' && (
        <div style={sx.spacing.mb(4)}>
          <label style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Clé API
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={sx.combine(sx.components.input.base, sx.spacing.mt(1), { paddingRight: '40px' })}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Message de statut */}
      {message && (
        <div style={sx.combine(
          sx.components.alert.base,
          message.type === 'success' ? sx.components.alert.success : sx.components.alert.danger,
          sx.spacing.mb(4)
        )}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <p style={sx.text.sm}>{message.text}</p>
        </div>
      )}

      {/* Boutons d'action */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mt(4))}>
        <button
          onClick={onClose}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || (provider !== 'local' && !apiKey.trim())}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            (isSaving || (provider !== 'local' && !apiKey.trim())) && { 
              opacity: 0.5, 
              cursor: 'not-allowed' 
            }
          )}
        >
          <Save size={16} style={{ marginRight: '8px' }} />
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Note de sécurité */}
      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(4), sx.text.center)}>
        🔒 Votre clé API est stockée localement sur votre navigateur et n'est jamais partagée.
      </div>
    </div>

};

export default APIConfiguration;