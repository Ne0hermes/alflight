// src/features/performance/components/APIConfiguration.jsx
import React, { useState, useEffect } from 'react';
import { Key, Save, Eye, EyeOff, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import apiKeyManager from '../../../utils/apiKeyManager';

const APIConfiguration = ({ onClose }) => {
  // 2 clés gérées séparément : Anthropic (Claude, défaut) + OpenAI (legacy)
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Charger la configuration existante
  useEffect(() => {
    setAnthropicKey(apiKeyManager.getAnthropicAPIKey() || '');
    setOpenaiKey(apiKeyManager.getAPIKey() || '');
    setProvider(apiKeyManager.getActiveProvider());
  }, []);

  const handleSave = async () => {
    const activeKey = provider === 'anthropic' ? anthropicKey.trim() : openaiKey.trim();
    if (!activeKey) {
      setMessage({ type: 'error', text: `Veuillez entrer une clé API ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}` });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Sauvegarder les 2 clés (si saisies) + le provider actif
      if (anthropicKey.trim()) apiKeyManager.setAnthropicAPIKey(anthropicKey.trim());
      if (openaiKey.trim()) apiKeyManager.setAPIKey(openaiKey.trim());
      apiKeyManager.setActiveProvider(provider);

      setMessage({
        type: 'success',
        text: `Configuration sauvegardée ! Provider actif : ${provider === 'anthropic' ? 'Claude (Anthropic)' : 'GPT-4o (OpenAI)'}. Rechargement…`
      });

      setTimeout(() => {
        if (onClose) onClose();
        window.location.reload();
      }, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur lors de la sauvegarde: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        ⚙️ Configuration de l'API d'analyse IA
      </h4>

      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div>
          <p style={sx.text.sm}>
            L'analyse IA permet d'extraire automatiquement les tableaux de performance
            depuis les pages du MANEX. <strong>Claude (Anthropic)</strong> est plus précis
            sur les tableaux numériques structurés et est le choix recommandé.
          </p>
        </div>
      </div>

      {/* Sélection du provider actif */}
      <div style={sx.spacing.mb(4)}>
        <label style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Fournisseur d'IA actif
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={sx.combine(sx.components.input.base, sx.spacing.mt(1))}
        >
          <option value="anthropic">Claude 3.5+ Sonnet (Anthropic) — recommandé</option>
          <option value="openai">GPT-4o Vision (OpenAI) — legacy</option>
        </select>
      </div>

      {/* Bloc Anthropic */}
      <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(3))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          🟣 Clé API Anthropic (Claude)
          {provider === 'anthropic' && <span style={{ color: 'var(--text-primary)', marginLeft: 8, fontWeight: 600 }}>● ACTIF</span>}
        </h5>
        <div style={{ position: 'relative' }}>
          <input
            type={showAnthropicKey ? 'text' : 'password'}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            style={sx.combine(sx.components.input.base, { paddingRight: '40px' })}
          />
          <button
            onClick={() => setShowAnthropicKey(!showAnthropicKey)}
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px'
            }}
          >
            {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <ol style={sx.combine(sx.text.xs, sx.spacing.mt(2), { paddingLeft: 18 })}>
          <li>Créez un compte sur <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a></li>
          <li>Allez dans "API Keys" et générez une clé</li>
          <li>Copiez la clé (format <code>sk-ant-...</code>) et collez-la ci-dessus</li>
        </ol>
        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
          💰 Coût estimé : ~0.01–0.02 €/page MANEX (Claude 3.5+ Sonnet Vision)
        </p>
      </div>

      {/* Bloc OpenAI */}
      <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(3))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          🟢 Clé API OpenAI (GPT-4o)
          {provider === 'openai' && <span style={{ color: 'var(--text-primary)', marginLeft: 8, fontWeight: 600 }}>● ACTIF</span>}
        </h5>
        <div style={{ position: 'relative' }}>
          <input
            type={showOpenaiKey ? 'text' : 'password'}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            style={sx.combine(sx.components.input.base, { paddingRight: '40px' })}
          />
          <button
            onClick={() => setShowOpenaiKey(!showOpenaiKey)}
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px'
            }}
          >
            {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
          Optionnel — conserve si tu veux pouvoir comparer GPT-4o vs Claude.
        </p>
      </div>

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

      <div style={sx.combine(sx.flex.between, sx.spacing.mt(4))}>
        <button
          onClick={onClose}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            isSaving && { opacity: 0.5, cursor: 'not-allowed' }
          )}
        >
          <Save size={16} style={{ marginRight: '8px' }} />
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(4), sx.text.center)}>
        🔒 Tes clés API sont stockées localement dans le navigateur et n'ont jamais transitent par nos serveurs.
      </div>
    </div>
  );
};

export default APIConfiguration;
