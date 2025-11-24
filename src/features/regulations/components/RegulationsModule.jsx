import React, { useState, useMemo } from 'react';
import {
  Book, Search, Filter, ChevronRight, ChevronDown,
  User, Navigation, Cloud, Fuel, Scale, TrendingUp,
  Settings, Shield, Info, ExternalLink, X, MessageSquarePlus, Send
} from 'lucide-react';
import { regulationsData, getAllRegulations } from '../data/regulationsData';
import { theme } from '@styles/theme';

const iconMap = {
  User: User,
  Navigation: Navigation,
  Cloud: Cloud,
  Fuel: Fuel,
  Scale: Scale,
  TrendingUp: TrendingUp,
  Settings: Settings,
  Shield: Shield
};

const RegulationsModule = () => {
  // Debug logging

  const [selectedModule, setSelectedModule] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedRegulations, setExpandedRegulations] = useState({});
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({
    type: 'correction',
    reference: '',
    module: '',
    description: '',
    contact: ''
  });

  // Obtenir les modules à afficher
  const modulesToDisplay = useMemo(() => {
    const result = selectedModule === 'all' 
      ? Object.entries(regulationsData || {})
      : [[selectedModule, regulationsData?.[selectedModule]]].filter(([, val]) => val);
    
    return result;
  }, [selectedModule]);

  // Filtrer les réglementations par recherche
  const filteredModules = useMemo(() => {
    if (!searchTerm) return modulesToDisplay;

    return modulesToDisplay
      .map(([moduleId, module]) => {
        const filteredSections = module.sections
          .map(section => {
            const filteredRegulations = section.regulations.filter(reg =>
              reg.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
              reg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              reg.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredRegulations.length > 0) {
              return { ...section, regulations: filteredRegulations };
            }
            return null;
          })
          .filter(Boolean);

        if (filteredSections.length > 0) {
          return [moduleId, { ...module, sections: filteredSections }];
        }
        return null;
      })
      .filter(Boolean);
  }, [modulesToDisplay, searchTerm]);

  const toggleSection = (moduleId, sectionId) => {
    const key = `${moduleId}-${sectionId}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleRegulation = (moduleId, sectionId, regIndex) => {
    const key = `${moduleId}-${sectionId}-${regIndex}`;
    setExpandedRegulations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const openDetailModal = (regulation, module, section) => {
    setShowDetailModal({
      regulation,
      module,
      section
    });
  };

  const handleSuggestionSubmit = () => {
    // Sauvegarder la suggestion dans le localStorage
    const suggestions = JSON.parse(localStorage.getItem('regulationsSuggestions') || '[]');
    const newSuggestion = {
      ...suggestionForm,
      date: new Date().toISOString(),
      id: Date.now()
    };
    suggestions.push(newSuggestion);
    localStorage.setItem('regulationsSuggestions', JSON.stringify(suggestions));

    // Afficher une notification
    alert('Merci pour votre suggestion ! Elle sera examinée lors de la prochaine mise à jour.');

    // Réinitialiser le formulaire et fermer le modal
    setSuggestionForm({
      type: 'correction',
      reference: '',
      module: '',
      description: '',
      contact: ''
    });
    setShowSuggestionModal(false);
  };

  // Vérification des données
  if (!regulationsData || Object.keys(regulationsData).length === 0) {
    return (
      <div style={styles.container}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Erreur de chargement des données</h2>
          <p>Les données réglementaires ne sont pas disponibles.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* En-tête */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>
            <Book size={28} style={{ marginRight: '12px' }} />
            Références Réglementaires
          </h1>
          <p style={styles.subtitle}>
            Consultez toutes les réglementations EASA applicables à l'aviation légère
          </p>
          <button
            onClick={() => setShowSuggestionModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              marginTop: '16px'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            <MessageSquarePlus size={20} />
            Suggérer une modification
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div style={styles.controlsBar}>
        <div style={styles.searchContainer}>
          <Search size={20} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher une référence, un titre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterContainer}>
          <Filter size={18} style={{ marginRight: '8px' }} />
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">Tous les modules</option>
            {Object.entries(regulationsData).map(([id, module]) => (
              <option key={id} value={id}>{module.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistiques */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Modules</span>
          <span style={styles.statValue}>{Object.keys(regulationsData).length}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Réglementations</span>
          <span style={styles.statValue}>{getAllRegulations().length}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Résultats</span>
          <span style={styles.statValue}>
            {filteredModules.reduce((acc, [, module]) => 
              acc + module.sections.reduce((acc2, section) => 
                acc2 + section.regulations.length, 0), 0)}
          </span>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={styles.content}>
        {filteredModules.length === 0 ? (
          <div style={styles.noResults}>
            <Info size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
            <p>Aucune réglementation trouvée pour "{searchTerm}"</p>
          </div>
        ) : (
          filteredModules.map(([moduleId, module]) => {
            const ModuleIcon = iconMap[module.icon] || Book;
            
            return (
              <div key={moduleId} style={styles.moduleCard}>
                <div style={styles.moduleHeader}>
                  <ModuleIcon size={24} style={{ marginRight: '12px', color: theme.colors.primary }} />
                  <div style={{ flex: 1 }}>
                    <h2 style={styles.moduleTitle}>{module.title}</h2>
                    <p style={styles.moduleDescription}>{module.description}</p>
                  </div>
                </div>

                <div style={styles.sectionsContainer}>
                  {module.sections.map((section) => {
                    const sectionKey = `${moduleId}-${section.id}`;
                    const isExpanded = expandedSections[sectionKey] === undefined ? false : expandedSections[sectionKey]; // Par défaut fermé

                    return (
                      <div key={section.id} style={styles.section}>
                        <button
                          onClick={() => toggleSection(moduleId, section.id)}
                          style={styles.sectionHeader}
                        >
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          <h3 style={styles.sectionTitle}>{section.title}</h3>
                          <span style={styles.sectionCount}>
                            {section.regulations.length} règle{section.regulations.length > 1 ? 's' : ''}
                          </span>
                        </button>

                        {isExpanded && (
                          <div style={styles.regulationsContainer}>
                            {section.regulations.map((regulation, index) => {
                              const regKey = `${moduleId}-${section.id}-${index}`;
                              const isRegExpanded = expandedRegulations[regKey];

                              return (
                                <div key={index} style={styles.regulationCard}>
                                  <div 
                                    style={styles.regulationHeader}
                                    onClick={() => toggleRegulation(moduleId, section.id, index)}
                                  >
                                    <div style={styles.regulationRef}>{regulation.ref}</div>
                                    <div style={styles.regulationTitle}>{regulation.title}</div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDetailModal(regulation, module.title, section.title);
                                      }}
                                      style={styles.detailButton}
                                    >
                                      <ExternalLink size={16} />
                                    </button>
                                  </div>

                                  {isRegExpanded && (
                                    <div style={styles.regulationContent}>
                                      {regulation.description && (
                                        <p style={styles.regulationDescription}>{regulation.description}</p>
                                      )}

                                      {regulation.requirements && (
                                        <ul style={styles.requirementsList}>
                                          {regulation.requirements.map((req, idx) => (
                                            <li key={idx} style={styles.requirementItem}>{req}</li>
                                          ))}
                                        </ul>
                                      )}

                                      {regulation.table && (
                                        <div style={styles.tableContainer}>
                                          <table style={styles.table}>
                                            <thead>
                                              <tr>
                                                {regulation.table.headers.map((header, idx) => (
                                                  <th key={idx} style={styles.tableHeader}>{header}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {regulation.table.rows.map((row, rowIdx) => (
                                                <tr key={rowIdx} style={rowIdx % 2 === 0 ? styles.tableRowEven : {}}>
                                                  {row.map((cell, cellIdx) => (
                                                    <td key={cellIdx} style={styles.tableCell}>{cell}</td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de détail */}
      {showDetailModal && (
        <div style={styles.modalOverlay} onClick={() => setShowDetailModal(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {showDetailModal.regulation.ref} - {showDetailModal.regulation.title}
              </h2>
              <button
                onClick={() => setShowDetailModal(null)}
                style={styles.modalCloseButton}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalMeta}>
                <span style={styles.modalModule}>{showDetailModal.module}</span>
                <span style={styles.modalSeparator}>›</span>
                <span style={styles.modalSection}>{showDetailModal.section}</span>
              </div>

              {showDetailModal.regulation.description && (
                <p style={styles.modalDescription}>{showDetailModal.regulation.description}</p>
              )}

              {showDetailModal.regulation.requirements && (
                <div style={styles.modalRequirements}>
                  <h3 style={styles.modalSubtitle}>Exigences</h3>
                  <ul style={styles.modalList}>
                    {showDetailModal.regulation.requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showDetailModal.regulation.table && (
                <div style={styles.modalTable}>
                  <h3 style={styles.modalSubtitle}>Tableau récapitulatif</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {showDetailModal.regulation.table.headers.map((header, idx) => (
                          <th key={idx} style={styles.tableHeader}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {showDetailModal.regulation.table.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} style={rowIdx % 2 === 0 ? styles.tableRowEven : {}}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} style={styles.tableCell}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={styles.modalFooter}>
                <p style={styles.modalNote}>
                  <Info size={16} style={{ marginRight: '8px' }} />
                  Cette référence est extraite de la réglementation EASA. 
                  Consultez toujours les sources officielles pour les informations les plus récentes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de suggestion */}
      {showSuggestionModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSuggestionModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <MessageSquarePlus size={24} style={{ marginRight: '12px' }} />
                Suggérer une modification
              </h2>
              <button
                onClick={() => setShowSuggestionModal(false)}
                style={styles.modalCloseButton}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ marginBottom: '20px', color: '#6b7280' }}>
                Vous avez repéré une erreur ou souhaitez suggérer l'ajout d'une référence ?
                Utilisez ce formulaire pour nous le signaler.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.formLabel}>Type de suggestion *</label>
                <select
                  value={suggestionForm.type}
                  onChange={(e) => setSuggestionForm({ ...suggestionForm, type: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="correction">Correction d'une erreur</option>
                  <option value="ajout">Ajout d'une nouvelle référence</option>
                  <option value="clarification">Demande de clarification</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.formLabel}>Référence concernée</label>
                <input
                  type="text"
                  placeholder="Ex: SERA.5005"
                  value={suggestionForm.reference}
                  onChange={(e) => setSuggestionForm({ ...suggestionForm, reference: e.target.value })}
                  style={styles.formInput}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.formLabel}>Module concerné</label>
                <select
                  value={suggestionForm.module}
                  onChange={(e) => setSuggestionForm({ ...suggestionForm, module: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">-- Sélectionner un module --</option>
                  {Object.entries(regulationsData).map(([id, module]) => (
                    <option key={id} value={id}>{module.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.formLabel}>Description de votre suggestion *</label>
                <textarea
                  placeholder="Décrivez précisément votre suggestion..."
                  value={suggestionForm.description}
                  onChange={(e) => setSuggestionForm({ ...suggestionForm, description: e.target.value })}
                  style={{
                    ...styles.formInput,
                    minHeight: '120px',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.formLabel}>Email de contact (optionnel)</label>
                <input
                  type="email"
                  placeholder="votre.email@exemple.com"
                  value={suggestionForm.contact}
                  onChange={(e) => setSuggestionForm({ ...suggestionForm, contact: e.target.value })}
                  style={styles.formInput}
                />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Si vous souhaitez être informé de la prise en compte de votre suggestion
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSuggestionModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSuggestionSubmit}
                  disabled={!suggestionForm.description}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: suggestionForm.description ? theme.colors.primary : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: suggestionForm.description ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Send size={16} />
                  Envoyer la suggestion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
  },
  controlsBar: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    padding: '0 24px',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchContainer: {
    flex: '1 1 400px',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
  },
  searchInput: {
    width: '100%',
    padding: '12px 12px 12px 44px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  filterContainer: {
    flex: '1 1 300px',
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
  },
  filterSelect: {
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  statsBar: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    padding: '0 24px',
    display: 'flex',
    gap: '24px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 48px',
  },
  noResults: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  moduleCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px',
    overflow: 'hidden',
  },
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  moduleTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: '4px',
  },
  moduleDescription: {
    fontSize: '14px',
    color: '#6b7280',
  },
  sectionsContainer: {
    padding: '16px',
  },
  section: {
    marginBottom: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  sectionTitle: {
    flex: 1,
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginLeft: '8px',
  },
  sectionCount: {
    fontSize: '13px',
    color: '#6b7280',
    backgroundColor: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  regulationsContainer: {
    marginTop: '12px',
    paddingLeft: '20px',
  },
  regulationCard: {
    marginBottom: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  regulationHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  regulationRef: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.primary,
    marginRight: '12px',
    padding: '4px 8px',
    backgroundColor: '#eff6ff',
    borderRadius: '4px',
  },
  regulationTitle: {
    flex: 1,
    fontSize: '15px',
    color: theme.colors.textPrimary,
  },
  detailButton: {
    padding: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'all 0.2s',
  },
  regulationContent: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  regulationDescription: {
    fontSize: '14px',
    color: '#4b5563',
    marginBottom: '12px',
    lineHeight: '1.6',
  },
  requirementsList: {
    marginLeft: '20px',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.8',
  },
  requirementItem: {
    marginBottom: '8px',
  },
  tableContainer: {
    marginTop: '16px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  tableHeader: {
    padding: '10px',
    backgroundColor: '#f3f4f6',
    borderBottom: '2px solid #d1d5db',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
  },
  tableCell: {
    padding: '10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#4b5563',
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  modalCloseButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  modalModule: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalSeparator: {
    color: '#9ca3af',
  },
  modalSection: {
    color: '#6b7280',
  },
  modalDescription: {
    fontSize: '15px',
    color: '#4b5563',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  modalRequirements: {
    marginBottom: '24px',
  },
  modalSubtitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: '12px',
  },
  modalList: {
    marginLeft: '20px',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.8',
  },
  modalTable: {
    marginBottom: '24px',
  },
  modalFooter: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
  },
  modalNote: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#374151',
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  formSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
};

export default RegulationsModule;