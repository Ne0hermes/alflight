// src/features/checklist/ChecklistModule.jsx
import React, { memo, useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  Save,
  Download,
  Upload,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  RotateCcw,
  X
} from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useChecklistStore } from '@core/stores/checklistStore';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

export const ChecklistModule = memo(({ wizardMode = false, config = {} }) => {
  const {
    checklists,
    activeChecklist,
    addChecklist,
    updateChecklist,
    deleteChecklist,
    duplicateChecklist,
    setActiveChecklist,
    toggleItem,
    resetChecklist,
    importChecklists,
    exportChecklists
  } = useChecklistStore();

  const [showForm, setShowForm] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Gérer le redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCreateChecklist = () => {
    setEditingChecklist(null);
    setShowForm(true);
  };

  const handleEditChecklist = (checklist) => {
    setEditingChecklist(checklist);
    setShowForm(true);
  };

  const handleDeleteChecklist = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette checklist ?')) {
      deleteChecklist(id);
    }
  };

  const handleDuplicateChecklist = (id) => {
    duplicateChecklist(id);
  };

  const handleExport = () => {
    const dataStr = exportChecklists();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `checklists-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          importChecklists(e.target.result);
          alert('Import réussi !');
        } catch (error) {
          alert('Erreur lors de l\'import : ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const toggleSection = (sectionIndex) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex]
    }));
  };

  // Calculer les statistiques de progression
  const getChecklistStats = (checklist) => {
    let totalItems = 0;
    let checkedItems = 0;
    
    checklist.sections.forEach(section => {
      section.items.forEach(item => {
        totalItems++;
        if (item.checked) checkedItems++;
      });
    });
    
    return {
      total: totalItems,
      checked: checkedItems,
      percentage: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
    };
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-checklist.jpg"
          eyebrow="OPS · CHECKLISTS COCKPIT"
          title="Checklists"
        />
      )}

      {/* En-tête */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        {/* Titre */}
        <div style={sx.combine(sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            <CheckSquare size={20} />
            <span style={sx.spacing.ml(2)}>Gestion des Checklists</span>
          </h3>
        </div>

        {/* Contrôles organisés en colonnes responsive */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '16px',
          alignItems: isMobile ? 'stretch' : 'center',
          flexWrap: 'wrap'
        }}>
          {/* Sélecteur de checklist */}
          {checklists.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '8px',
              alignItems: isMobile ? 'stretch' : 'center',
              flex: '1 1 auto',
              minWidth: isMobile ? '100%' : '300px'
            }}>
              <label style={sx.combine(sx.text.sm, sx.text.secondary, {
                whiteSpace: 'nowrap',
                marginBottom: isMobile ? '4px' : '0'
              })}>
                Sélectionner :
              </label>
              <select
                value={activeChecklist?.id || ''}
                onChange={(e) => setActiveChecklist(e.target.value)}
                style={sx.combine(
                  sx.components.input.base,
                  {
                    padding: '8px 12px',
                    flex: '1',
                    fontSize: 'var(--fs-body)',
                    cursor: 'pointer'
                  }
                )}
              >
                <option value="">-- Choisir une checklist --</option>
                {checklists.map(checklist => {
                  const stats = getChecklistStats(checklist);
                  return (
                    <option key={checklist.id} value={checklist.id}>
                      {checklist.name} {stats.percentage > 0 ? `(${stats.percentage}% complété)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Boutons d'action */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'stretch' : 'flex-end'
          }}>
            <label style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary,
              {
                cursor: 'pointer',
                flex: isMobile ? '1' : 'initial',
                justifyContent: 'center'
              }
            )}>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <Upload size={16} />
              <span style={{ marginLeft: '6px' }}>Importer</span>
            </label>
            <button
              onClick={handleExport}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.secondary,
                {
                  flex: isMobile ? '1' : 'initial',
                  justifyContent: 'center'
                }
              )}
              disabled={checklists.length === 0}
            >
              <Download size={16} />
              <span style={{ marginLeft: '6px' }}>Exporter</span>
            </button>
            <button
              onClick={handleCreateChecklist}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.primary,
                {
                  flex: isMobile ? '1 1 100%' : 'initial',
                  justifyContent: 'center'
                }
              )}
            >
              <Plus size={16} />
              <span style={{ marginLeft: '6px' }}>Nouvelle checklist</span>
            </button>
          </div>
        </div>

      </section>

      {/* Checklist active */}
      {activeChecklist ? (
        <section style={sx.combine(sx.components.section.base)}>
          <ActiveChecklistView
            checklist={activeChecklist}
            onEdit={() => handleEditChecklist(activeChecklist)}
            onDelete={() => handleDeleteChecklist(activeChecklist.id)}
            onDuplicate={() => handleDuplicateChecklist(activeChecklist.id)}
            onToggleItem={toggleItem}
            onReset={() => resetChecklist(activeChecklist.id)}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
          />
        </section>
      ) : (
        <div style={sx.combine(sx.components.card.base, sx.text.left, sx.spacing.p(8))}>
          <CheckSquare size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
          <p style={sx.combine(sx.text.lg, sx.text.secondary, sx.spacing.mb(2))}>
            Aucune checklist sélectionnée
          </p>
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Créez votre première checklist ou sélectionnez-en une existante
          </p>
        </div>
      )}

      {/* Modal de création/édition */}
      {showForm && (
        <ChecklistForm
          checklist={editingChecklist}
          onSave={(data) => {
            if (editingChecklist) {
              updateChecklist(editingChecklist.id, data);
            } else {
              addChecklist(data);
            }
            setShowForm(false);
            setEditingChecklist(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingChecklist(null);
          }}
        />
      )}
    </div>
  );
});

// Composant pour afficher la checklist active
const ActiveChecklistView = memo(({ 
  checklist, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggleItem, 
  onReset,
  expandedSections,
  onToggleSection 
}) => {
  // Définir la fonction avant de l'utiliser
  const getChecklistStats = (checklist) => {
    let totalItems = 0;
    let checkedItems = 0;
    
    checklist.sections.forEach(section => {
      section.items.forEach(item => {
        totalItems++;
        if (item.checked) checkedItems++;
      });
    });
    
    return {
      total: totalItems,
      checked: checkedItems,
      percentage: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
    };
  };
  
  const stats = getChecklistStats(checklist);

  return (
    <div>
      {/* En-tête de la checklist */}
      <div style={sx.spacing.mb(4)}>
        <h4 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(1))}>
          {checklist.name}
        </h4>
        {checklist.description && (
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
            {checklist.description}
          </p>
        )}
        <div style={sx.combine(sx.flex.start, sx.spacing.gap(3), sx.spacing.mb(3))}>
          <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
            <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Créée le {new Date(checklist.createdAt).toLocaleDateString('fr-FR')}
          </span>
          {checklist.updatedAt && (
            <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Modifiée le {new Date(checklist.updatedAt).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
        {/* Boutons déplacés en dessous des dates */}
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <button
            onClick={onReset}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            title="Réinitialiser tous les éléments"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onDuplicate}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            title="Dupliquer"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onEdit}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            style={sx.combine(sx.components.button.base, sx.components.button.danger)}
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(1))}>
          <span style={sx.combine(sx.text.sm, sx.text.bold)}>
            Progression
          </span>
          <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {stats.checked} / {stats.total} ({stats.percentage}%)
          </span>
        </div>
        <div style={{ 
          height: '8px', 
          backgroundColor: 'var(--border-subtle)', 
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${stats.percentage}%`,
            backgroundColor: stats.percentage === 100 ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Sections de la checklist */}
      {checklist.sections.map((section, sectionIndex) => {
        const sectionStats = {
          total: section.items.length,
          checked: section.items.filter(item => item.checked).length
        };
        const isExpanded = expandedSections[sectionIndex] !== false; // Par défaut ouvert
        
        return (
          <div key={section.id} style={sx.combine(sx.components.card.base, sx.spacing.mb(3))}>
            <div 
              style={sx.combine(sx.flex.between, sx.spacing.mb(isExpanded ? 3 : 0), { cursor: 'pointer' })}
              onClick={() => onToggleSection(sectionIndex)}
            >
              <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.flex.start)}>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                <span style={sx.spacing.ml(1)}>{section.name}</span>
                <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(2))}>
                  ({sectionStats.checked}/{sectionStats.total})
                </span>
              </h5>
              {section.critical && (
                <span style={sx.combine(sx.text.xs, {
                  padding: '2px 8px',
                  backgroundColor: 'var(--bg-overlay)',
                  color: 'var(--color-red-critical)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-overlay)'
                })}>
                  <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Critique
                </span>
              )}
            </div>
            
            {isExpanded && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {section.items.map((item, itemIndex) => (
                  <label
                    key={item.id}
                    style={sx.combine(
                      sx.flex.start,
                      sx.spacing.p(2),
                      {
                        backgroundColor: item.checked ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
                        border: `1px solid ${item.checked ? 'var(--bg-overlay)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => onToggleItem(checklist.id, section.id, item.id)}
                      style={{ marginRight: '12px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={sx.combine(
                        sx.text.sm,
                        item.checked && { textDecoration: 'line-through', color: 'var(--text-secondary)' }
                      )}>
                        {item.text}
                      </span>
                      {item.note && (
                        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                          💡 {item.note}
                        </p>
                      )}
                    </div>
                    {item.warning && (
                      <AlertTriangle size={16} style={{ color: 'var(--accent-primary)', marginLeft: '8px' }} />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Message de completion */}
      {stats.percentage === 100 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mt(4))}>
          <CheckSquare size={20} />
          <div>
            <p style={sx.text.sm}>
              <strong>Checklist complétée !</strong>
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Tous les éléments ont été vérifiés. Bon vol !
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

// Composant pour le formulaire de création/édition
const ChecklistForm = memo(({ checklist, onSave, onCancel }) => {
  const [formData, setFormData] = useState(() => {
    // Créer une copie profonde pour éviter les problèmes d'objet non-extensible
    const initialData = {
      name: checklist?.name || '',
      description: checklist?.description || '',
      category: checklist?.category || 'preflight',
      sections: checklist?.sections ? 
        checklist.sections.map(section => ({
          ...section,
          items: section.items ? [...section.items] : []
        })) : 
        [
          {
            id: Date.now().toString(),
            name: 'Section 1',
            critical: false,
            items: [
              { id: Date.now().toString() + '-1', text: '', note: '', warning: false, checked: false }
            ]
          }
        ]
    };
    return initialData;
  });

  const handleAddSection = () => {
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, {
        id: Date.now().toString(),
        name: `Section ${prev.sections.length + 1}`,
        critical: false,
        items: [
          { id: Date.now().toString() + '-1', text: '', note: '', warning: false, checked: false }
        ]
      }]
    }));
  };

  const handleRemoveSection = (sectionIndex) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex)
    }));
  };

  const handleAddItem = (sectionIndex) => {
    setFormData(prev => {
      const newSections = prev.sections.map((section, index) => {
        if (index === sectionIndex) {
          return {
            ...section,
            items: [...section.items, {
              id: Date.now().toString(),
              text: '',
              note: '',
              warning: false,
              checked: false
            }]
          };
        }
        return section;
      });
      return { ...prev, sections: newSections };
    });
  };

  const handleRemoveItem = (sectionIndex, itemIndex) => {
    setFormData(prev => {
      const newSections = prev.sections.map((section, index) => {
        if (index === sectionIndex) {
          return {
            ...section,
            items: section.items.filter((_, idx) => idx !== itemIndex)
          };
        }
        return section;
      });
      return { ...prev, sections: newSections };
    });
  };

  const handleSectionChange = (sectionIndex, field, value) => {
    setFormData(prev => {
      const newSections = prev.sections.map((section, index) => {
        if (index === sectionIndex) {
          return { ...section, [field]: value };
        }
        return section;
      });
      return { ...prev, sections: newSections };
    });
  };

  const handleItemChange = (sectionIndex, itemIndex, field, value) => {
    setFormData(prev => {
      const newSections = prev.sections.map((section, sIdx) => {
        if (sIdx === sectionIndex) {
          return {
            ...section,
            items: section.items.map((item, iIdx) => {
              if (iIdx === itemIndex) {
                return { ...item, [field]: value };
              }
              return item;
            })
          };
        }
        return section;
      });
      return { ...prev, sections: newSections };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      alert('Le nom de la checklist est obligatoire');
      return;
    }
    
    // Vérifier que chaque section a au moins un item avec du texte
    const validSections = formData.sections.filter(section => 
      section.items.some(item => item.text.trim())
    );
    
    if (validSections.length === 0) {
      alert('La checklist doit contenir au moins un élément');
      return;
    }
    
    // Nettoyer les items vides
    const cleanedSections = validSections.map(section => ({
      ...section,
      items: section.items.filter(item => item.text.trim())
    }));
    
    onSave({
      ...formData,
      sections: cleanedSections
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        padding: '24px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
            {checklist ? 'Modifier la checklist' : 'Nouvelle checklist'}
          </h3>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Informations générales */}
          <div style={sx.spacing.mb(4)}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={sx.components.label.base}>Nom de la checklist *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Prévol extérieur"
                  style={sx.components.input.base}
                  required
                />
              </div>
              <div>
                <label style={sx.components.label.base}>Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  style={sx.components.input.base}
                >
                  <option value="preflight">Prévol</option>
                  <option value="startup">Mise en route</option>
                  <option value="taxi">Roulage</option>
                  <option value="takeoff">Décollage</option>
                  <option value="cruise">Croisière</option>
                  <option value="approach">Approche</option>
                  <option value="landing">Atterrissage</option>
                  <option value="shutdown">Arrêt moteur</option>
                  <option value="emergency">Urgence</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>
            <div>
              <label style={sx.components.label.base}>Description (optionnel)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description de la checklist..."
                style={sx.combine(sx.components.input.base, { minHeight: '60px' })}
              />
            </div>
          </div>

          {/* Sections */}
          <div style={sx.spacing.mb(4)}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h4 style={sx.text.base}>Sections et éléments</h4>
              <button
                type="button"
                onClick={handleAddSection}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                <Plus size={16} />
                Ajouter une section
              </button>
            </div>

            {formData.sections.map((section, sectionIndex) => (
              <div key={section.id} style={sx.combine(sx.components.card.base, sx.spacing.mb(3))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                    <input
                      type="text"
                      value={section.name}
                      onChange={(e) => handleSectionChange(sectionIndex, 'name', e.target.value)}
                      placeholder="Nom de la section"
                      style={sx.combine(sx.components.input.base, { marginBottom: 0 })}
                    />
                    <label style={sx.flex.start}>
                      <input
                        type="checkbox"
                        checked={section.critical}
                        onChange={(e) => handleSectionChange(sectionIndex, 'critical', e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={sx.text.sm}>Section critique</span>
                    </label>
                  </div>
                  {formData.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(sectionIndex)}
                      style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Items de la section */}
                <div style={{ display: 'grid', gap: '8px' }}>
                  {section.items.map((item, itemIndex) => (
                    <div key={item.id} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => handleItemChange(sectionIndex, itemIndex, 'text', e.target.value)}
                        placeholder="Élément à vérifier"
                        style={sx.combine(sx.components.input.base, { flex: 2, marginBottom: 0 })}
                      />
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => handleItemChange(sectionIndex, itemIndex, 'note', e.target.value)}
                        placeholder="Note (optionnel)"
                        style={sx.combine(sx.components.input.base, { flex: 1, marginBottom: 0 })}
                      />
                      <label style={sx.combine(sx.flex.center, { minWidth: '100px' })}>
                        <input
                          type="checkbox"
                          checked={item.warning}
                          onChange={(e) => handleItemChange(sectionIndex, itemIndex, 'warning', e.target.checked)}
                          style={{ marginRight: '4px' }}
                        />
                        <span style={sx.text.xs}>⚠️ Alerte</span>
                      </label>
                      {section.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(sectionIndex, itemIndex)}
                          style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px' })}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAddItem(sectionIndex)}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, sx.spacing.mt(2))}
                >
                  <Plus size={14} />
                  Ajouter un élément
                </button>
              </div>
            ))}
          </div>

          {/* Boutons d'action */}
          <div style={sx.combine(sx.flex.end, sx.spacing.gap(2))}>
            <button
              type="button"
              onClick={onCancel}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              Annuler
            </button>
            <button
              type="submit"
              style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            >
              <Save size={16} />
              {checklist ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ChecklistModule.displayName = 'ChecklistModule';
ActiveChecklistView.displayName = 'ActiveChecklistView';
ChecklistForm.displayName = 'ChecklistForm';

export default ChecklistModule;