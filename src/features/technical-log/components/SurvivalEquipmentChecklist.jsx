// src/features/technical-log/components/SurvivalEquipmentChecklist.jsx
import React, { useState, useEffect, memo } from 'react';
import { Shield, AlertTriangle, CheckCircle, Package, Radio, Map, Heart, Flashlight, Anchor, Info } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const SurvivalEquipmentChecklist = memo(({ aircraftReg, flightZones = {} }) => {
  // Catégories d'équipements SAR selon les standards OACI/EASA
  const [equipment, setEquipment] = useState({
    // Équipements de survie - Général
    survival: {
      lifeJackets: { checked: false, quantity: 0, label: 'Gilets de sauvetage', required: true },
      lifeRaft: { checked: false, quantity: 0, label: 'Canot(s) de sauvetage', required: false },
      survivalKit: { checked: false, quantity: 0, label: 'Kit de survie', required: false },
      firstAidKit: { checked: false, quantity: 1, label: 'Trousse de premiers secours', required: true },
      fireExtinguisher: { checked: false, quantity: 1, label: 'Extincteur(s)', required: true },
      axe: { checked: false, quantity: 0, label: 'Hache de secours', required: false },
      flashlight: { checked: false, quantity: 1, label: 'Lampe(s) torche', required: true },
      smokingHood: { checked: false, quantity: 0, label: 'Cagoule(s) anti-fumée', required: false }
    },
    // Équipements de localisation d'urgence
    emergency: {
      elt: { checked: false, label: 'ELT (Emergency Locator Transmitter)', frequency: '406 MHz', required: true },
      plb: { checked: false, label: 'PLB (Personal Locator Beacon)', quantity: 0, required: false },
      epirb: { checked: false, label: 'EPIRB (Marine)', quantity: 0, required: false },
      flares: { checked: false, label: 'Fusées de détresse', quantity: 0, required: false },
      mirror: { checked: false, label: 'Miroir de signalisation', quantity: 0, required: false },
      whistle: { checked: false, label: 'Sifflet de détresse', quantity: 0, required: false },
      dyeMarker: { checked: false, label: 'Marqueur colorant (mer)', quantity: 0, required: false }
    },
    // Équipements spécifiques survol maritime
    maritime: {
      lifeJacketsWithLight: { checked: false, label: 'Gilets avec lampe', quantity: 0 },
      lifeRaftCapacity: { checked: false, label: 'Capacité totale canots', capacity: 0 },
      seaAnchor: { checked: false, label: 'Ancre flottante', quantity: 0 },
      bailer: { checked: false, label: 'Écope', quantity: 0 },
      paddles: { checked: false, label: 'Pagaies', quantity: 0 },
      pyrotechnics: { checked: false, label: 'Signaux pyrotechniques', quantity: 0 }
    },
    // Équipements pour régions hostiles
    hostile: {
      polarKit: { checked: false, label: 'Kit polaire (vêtements chauds)' },
      desertKit: { checked: false, label: 'Kit désertique (eau, protection solaire)' },
      jungleKit: { checked: false, label: 'Kit jungle (machette, répulsif)' },
      mountainKit: { checked: false, label: 'Kit montagne (cordes, crampons)' },
      shelterMaterial: { checked: false, label: 'Matériel d\'abri', quantity: 0 },
      waterPurification: { checked: false, label: 'Pastilles purification eau', quantity: 0 },
      emergencyRations: { checked: false, label: 'Rations de survie', quantity: 0 }
    },
    // Communication d'urgence
    communication: {
      satellitePhone: { checked: false, label: 'Téléphone satellite' },
      vhfPortable: { checked: false, label: 'VHF portable étanche' },
      emergencyTransponder: { checked: false, label: 'Transpondeur de détresse' },
      signallingCards: { checked: false, label: 'Cartes de signalisation sol-air' }
    }
  });

  const [notes, setNotes] = useState('');
  const [lastCheck, setLastCheck] = useState(null);
  const [nextCheckDue, setNextCheckDue] = useState(null);

  // Charger les données sauvegardées
  useEffect(() => {
    const key = `survivalEquipment_${aircraftReg}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      setEquipment(data.equipment || equipment);
      setNotes(data.notes || '');
      setLastCheck(data.lastCheck || null);
      setNextCheckDue(data.nextCheckDue || null);
    }
  }, [aircraftReg]);

  // Sauvegarder les changements
  const handleSave = () => {
    const key = `survivalEquipment_${aircraftReg}`;
    const data = {
      equipment,
      notes,
      lastCheck: new Date().toISOString(),
      nextCheckDue: calculateNextCheck(),
      aircraftReg
    };
    localStorage.setItem(key, JSON.stringify(data));
    setLastCheck(data.lastCheck);
    setNextCheckDue(data.nextCheckDue);
    alert('Checklist des équipements de survie sauvegardée !');
  };

  // Calculer la prochaine vérification (30 jours par défaut)
  const calculateNextCheck = () => {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    return next.toISOString();
  };

  // Gérer les changements de checkbox
  const handleCheckChange = (category, item) => {
    setEquipment(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [item]: {
          ...prev[category][item],
          checked: !prev[category][item].checked
        }
      }
    }));
  };

  // Gérer les changements de quantité
  const handleQuantityChange = (category, item, value) => {
    setEquipment(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [item]: {
          ...prev[category][item],
          quantity: parseInt(value) || 0
        }
      }
    }));
  };

  // Calculer les statistiques
  const getStats = () => {
    let total = 0;
    let checked = 0;
    let required = 0;
    let requiredChecked = 0;

    Object.values(equipment).forEach(category => {
      Object.values(category).forEach(item => {
        total++;
        if (item.checked) checked++;
        if (item.required) {
          required++;
          if (item.checked) requiredChecked++;
        }
      });
    });

    return { total, checked, required, requiredChecked };
  };

  const stats = getStats();
  const isComplete = stats.requiredChecked === stats.required;

  const inputStyle = {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    width: '60px'
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      {/* En-tête */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
          <Shield size={20} style={{ marginRight: '8px' }} />
          Équipements de Survie & SAR (Search and Rescue)
        </h4>
        
        {/* Statut de vérification */}
        <div style={{ textAlign: 'right' }}>
          {lastCheck && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Dernière vérification: {new Date(lastCheck).toLocaleDateString()}
            </p>
          )}
          {nextCheckDue && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Prochaine vérification: {new Date(nextCheckDue).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
          <span style={sx.text.sm}>
            Progression: {stats.checked}/{stats.total} équipements vérifiés
          </span>
          <span style={sx.combine(sx.text.sm, isComplete ? sx.text.success : sx.text.warning)}>
            {isComplete ? '✓ Tous les équipements requis sont présents' : `${stats.required - stats.requiredChecked} équipement(s) requis manquant(s)`}
          </span>
        </div>
        <div style={{
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(stats.checked / stats.total) * 100}%`,
            height: '100%',
            backgroundColor: isComplete ? '#10b981' : '#f59e0b',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Équipements de survie général */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Package size={16} style={{ marginRight: '6px' }} />
          Équipements de survie - Général
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(equipment.survival).map(([key, item]) => (
            <div key={key} style={sx.combine(sx.flex.between, sx.spacing.p(2), {
              backgroundColor: item.checked ? '#f0fdf4' : '#fafafa',
              borderRadius: '6px',
              border: `1px solid ${item.checked ? '#86efac' : '#e5e7eb'}`
            })}>
              <label style={sx.combine(sx.flex.start, { cursor: 'pointer' })}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckChange('survival', key)}
                  style={{ marginRight: '8px' }}
                />
                <span style={sx.text.sm}>
                  {item.label}
                  {item.required && <span style={{ color: '#ef4444' }}> *</span>}
                </span>
              </label>
              {item.quantity !== undefined && (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange('survival', key, e.target.value)}
                  min="0"
                  style={inputStyle}
                  placeholder="Qté"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Équipements de localisation d'urgence */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Radio size={16} style={{ marginRight: '6px' }} />
          Équipements de localisation d'urgence
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(equipment.emergency).map(([key, item]) => (
            <div key={key} style={sx.combine(sx.flex.between, sx.spacing.p(2), {
              backgroundColor: item.checked ? '#f0fdf4' : '#fafafa',
              borderRadius: '6px',
              border: `1px solid ${item.checked ? '#86efac' : '#e5e7eb'}`
            })}>
              <label style={sx.combine(sx.flex.start, { cursor: 'pointer' })}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckChange('emergency', key)}
                  style={{ marginRight: '8px' }}
                />
                <span style={sx.text.sm}>
                  {item.label}
                  {item.frequency && <span style={sx.text.secondary}> ({item.frequency})</span>}
                  {item.required && <span style={{ color: '#ef4444' }}> *</span>}
                </span>
              </label>
              {item.quantity !== undefined && (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange('emergency', key, e.target.value)}
                  min="0"
                  style={inputStyle}
                  placeholder="Qté"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Équipements maritimes */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Anchor size={16} style={{ marginRight: '6px' }} />
          Équipements spécifiques survol maritime
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(equipment.maritime).map(([key, item]) => (
            <div key={key} style={sx.combine(sx.flex.between, sx.spacing.p(2), {
              backgroundColor: item.checked ? '#f0fdf4' : '#fafafa',
              borderRadius: '6px',
              border: `1px solid ${item.checked ? '#86efac' : '#e5e7eb'}`
            })}>
              <label style={sx.combine(sx.flex.start, { cursor: 'pointer' })}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckChange('maritime', key)}
                  style={{ marginRight: '8px' }}
                />
                <span style={sx.text.sm}>{item.label}</span>
              </label>
              {item.quantity !== undefined && (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange('maritime', key, e.target.value)}
                  min="0"
                  style={inputStyle}
                  placeholder="Qté"
                />
              )}
              {item.capacity !== undefined && (
                <input
                  type="number"
                  value={item.capacity}
                  onChange={(e) => setEquipment(prev => ({
                    ...prev,
                    maritime: {
                      ...prev.maritime,
                      [key]: {
                        ...prev.maritime[key],
                        capacity: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  style={inputStyle}
                  placeholder="Pers."
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Équipements régions hostiles */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Map size={16} style={{ marginRight: '6px' }} />
          Équipements pour régions hostiles
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(equipment.hostile).map(([key, item]) => (
            <div key={key} style={sx.combine(sx.flex.between, sx.spacing.p(2), {
              backgroundColor: item.checked ? '#f0fdf4' : '#fafafa',
              borderRadius: '6px',
              border: `1px solid ${item.checked ? '#86efac' : '#e5e7eb'}`
            })}>
              <label style={sx.combine(sx.flex.start, { cursor: 'pointer' })}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckChange('hostile', key)}
                  style={{ marginRight: '8px' }}
                />
                <span style={sx.text.sm}>{item.label}</span>
              </label>
              {item.quantity !== undefined && (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange('hostile', key, e.target.value)}
                  min="0"
                  style={inputStyle}
                  placeholder="Qté"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Communication d'urgence */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Radio size={16} style={{ marginRight: '6px' }} />
          Communication d'urgence
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          {Object.entries(equipment.communication).map(([key, item]) => (
            <div key={key} style={sx.combine(sx.flex.between, sx.spacing.p(2), {
              backgroundColor: item.checked ? '#f0fdf4' : '#fafafa',
              borderRadius: '6px',
              border: `1px solid ${item.checked ? '#86efac' : '#e5e7eb'}`
            })}>
              <label style={sx.combine(sx.flex.start, { cursor: 'pointer' })}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckChange('communication', key)}
                  style={{ marginRight: '8px' }}
                />
                <span style={sx.text.sm}>{item.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={sx.spacing.mb(4)}>
        <label style={sx.components.label.base}>
          Notes et observations
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="État des équipements, dates de péremption, remarques..."
          rows={3}
          style={sx.combine(sx.components.input.base, { resize: 'vertical' })}
        />
      </div>

      {/* Information réglementaire */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>Information réglementaire</p>
          <p style={sx.text.xs}>
            Les équipements marqués d'un astérisque (*) sont généralement requis par la réglementation.
            Consultez votre manuel de vol et les exigences locales pour votre type d'opération.
            Pour les vols au-dessus de l'eau ou en régions hostiles, des équipements supplémentaires peuvent être obligatoires.
          </p>
        </div>
      </div>
      
      {/* Zones traversées et équipements supplémentaires requis */}
      {(flightZones.maritime || flightZones.mountain || flightZones.hostile) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>Zones dangereuses détectées - Équipements supplémentaires requis</p>
            <ul style={sx.combine(sx.text.xs, { marginLeft: '20px', marginTop: '8px' })}>
              {flightZones.maritime && (
                <li>
                  <strong>Zone maritime :</strong> Gilets de sauvetage avec lampe, canot(s) de sauvetage,
                  ELT 406 MHz, fusées de détresse obligatoires (survol {'>'} 50 NM des côtes)
                </li>
              )}
              {flightZones.mountain && (
                <li>
                  <strong>Zone montagneuse :</strong> ELT 406 MHz, kit de survie montagne,
                  matériel de signalisation visuelle recommandés
                </li>
              )}
              {flightZones.hostile && (
                <li>
                  <strong>Région hostile :</strong> Kit de survie adapté au climat,
                  rations et eau pour 48h minimum, abri de survie
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      
      {/* Liens vers la réglementation */}
      <div style={sx.combine(sx.spacing.mb(4), sx.spacing.p(3), {
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      })}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          📚 Réglementation et références officielles
        </h5>
        <div style={{ display: 'grid', gap: '8px' }}>
          <a 
            href="https://www.ecologie.gouv.fr/sites/default/files/Guide_SAR_France.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            style={sx.combine(sx.text.xs, { color: '#3b82f6', textDecoration: 'none' })}
          >
            → Guide SAR France - Ministère de la Transition écologique
          </a>
          <a 
            href="https://www.easa.europa.eu/en/document-library/regulations/commission-regulation-eu-no-9652012" 
            target="_blank" 
            rel="noopener noreferrer"
            style={sx.combine(sx.text.xs, { color: '#3b82f6', textDecoration: 'none' })}
          >
            → EASA Part-NCO.IDE - Équipements obligatoires
          </a>
          <a 
            href="https://www.legifrance.gouv.fr/codes/section_ta/LEGITEXT000023086525/LEGISCTA000023619583/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={sx.combine(sx.text.xs, { color: '#3b82f6', textDecoration: 'none' })}
          >
            → Code des transports - Équipements de sécurité et de sauvetage
          </a>
          <a 
            href="https://www.icao.int/safety/OPS/OPS%20Section%20Documents/Annex%206%20-%20Operation%20of%20Aircraft/Part%20II%20-%20International%20General%20Aviation%20-%20Aeroplanes.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            style={sx.combine(sx.text.xs, { color: '#3b82f6', textDecoration: 'none' })}
          >
            → OACI Annexe 6 Partie II - Aviation générale internationale
          </a>
          <a 
            href="https://www.sia.aviation-civile.gouv.fr/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={sx.combine(sx.text.xs, { color: '#3b82f6', textDecoration: 'none' })}
          >
            → SIA France - Service de l'Information Aéronautique
          </a>
        </div>
        <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
          <strong>Rappel :</strong> Vérifiez toujours les exigences spécifiques selon :
          <ul style={{ marginLeft: '20px', marginTop: '4px' }}>
            <li>Le type d'aéronef et sa catégorie d'exploitation</li>
            <li>La zone géographique de vol (nationale/internationale)</li>
            <li>Les conditions météorologiques (VFR/IFR, jour/nuit)</li>
            <li>La distance par rapport aux côtes ou zones habitées</li>
          </ul>
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={sx.combine(sx.flex.between)}>
        <button
          onClick={handleSave}
          style={sx.combine(sx.components.button.base, sx.components.button.primary)}
        >
          <CheckCircle size={16} />
          Sauvegarder la checklist
        </button>
        
        {!isComplete && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, { flex: 1, marginLeft: '16px' })}>
            <AlertTriangle size={16} />
            <p style={sx.text.sm}>
              Attention: Des équipements requis ne sont pas cochés
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

SurvivalEquipmentChecklist.displayName = 'SurvivalEquipmentChecklist';

export default SurvivalEquipmentChecklist;