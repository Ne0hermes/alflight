// src/features/aircraft/components/TableDisplay.jsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Edit3, Save, X, Plus, Minus, Copy, RotateCcw, AlertTriangle,
  Info, ChevronRight, ChevronDown, FileText, Table as TableIcon
} from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const TableDisplay = ({ 
  table, 
  viewMode, 
  showMetadata, 
  isEditMode, 
  onEditModeChange, 
  onTableUpdate 
}) => {
  // Mémoriser la table initiale pour éviter les re-créations
  const initialTable = useMemo(() => table, [table?.table_name]);
  
  const [editedTable, setEditedTable] = useState(initialTable);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());

  // Fonction pour formater les conditions si c'est un objet
  const formatConditions = (conditions) => {
    if (typeof conditions === 'string') return conditions;
    if (!conditions || typeof conditions !== 'object') return '';
    
    const parts = [];
    if (conditions.weight_kg) parts.push(`Masse: ${conditions.weight_kg}kg`);
    if (conditions.flaps) parts.push(`Volets: ${conditions.flaps}`);
    if (conditions.power) parts.push(`Puissance: ${conditions.power}`);
    if (conditions.runway?.surface) parts.push(`Piste: ${conditions.runway.surface}`);
    if (conditions.runway?.condition) parts.push(`État: ${conditions.runway.condition}`);
    if (conditions.runway?.slope_pct) parts.push(`Pente: ${conditions.runway.slope_pct}%`);
    if (conditions.runway?.wind) parts.push(`Vent: ${conditions.runway.wind}`);
    if (conditions.notes && conditions.notes.length > 0) {
      parts.push(`Notes: ${conditions.notes.join(', ')}`);
    }
    
    return parts.join(' | ') || 'Conditions standards';
  };

  // Synchroniser editedTable avec la prop table quand elle change
  useEffect(() => {
    // Utiliser l'ID ou le nom de la table pour détecter les changements réels
    if (initialTable && (!editedTable || initialTable.table_name !== editedTable.table_name)) {
      console.log('🔄 TableDisplay - Synchronisation avec nouvelle table:', initialTable.table_name);
      setEditedTable(initialTable);
      setExpandedMetadata(false); // Réinitialiser l'état des métadonnées
      setSelectedCells(new Set()); // Réinitialiser la sélection des cellules
    }
  }, [initialTable]); // Dépendance sur la table mémorisée

  // Effet pour logger les changements du mode édition
  useEffect(() => {
    console.log('🔄 TableDisplay - Mode édition changé:', isEditMode);
  }, [isEditMode]);

  // Gérer les modifications de la table
  const handleTableChange = useCallback((field, value) => {
    setEditedTable(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleDataChange = useCallback((rowIndex, columnKey, value) => {
    setEditedTable(prev => ({
      ...prev,
      data: prev.data.map((row, index) => 
        index === rowIndex 
          ? { ...row, [columnKey]: value }
          : row
      )
    }));
  }, []);

  const handleUnitsChange = useCallback((columnKey, unit) => {
    setEditedTable(prev => ({
      ...prev,
      units: {
        ...prev.units,
        [columnKey]: unit
      }
    }));
  }, []);

  const addRow = useCallback(() => {
    if (!editedTable.data || editedTable.data.length === 0) return;
    
    const columns = Object.keys(editedTable.data[0]).filter(key => {
      // Filtrer les clés string valides
      if (typeof key !== 'string' || key.startsWith('_')) return false;
      
      // Vérifier que la valeur n'est pas un objet de configuration
      const firstValue = editedTable.data[0][key];
      if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
        if ('min' in firstValue || 'max' in firstValue || 'calibrated' in firstValue) {
          return false;
        }
      }
      
      return true;
    });
    
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {});
    
    setEditedTable(prev => ({
      ...prev,
      data: [...prev.data, newRow]
    }));
  }, [editedTable.data]);

  const removeRow = useCallback((rowIndex) => {
    setEditedTable(prev => ({
      ...prev,
      data: prev.data.filter((_, index) => index !== rowIndex)
    }));
  }, []);

  const addColumn = useCallback(() => {
    const newColumnKey = `nouvelle_colonne_${Date.now()}`;
    
    setEditedTable(prev => ({
      ...prev,
      data: prev.data.map(row => ({ ...row, [newColumnKey]: '' })),
      units: {
        ...prev.units,
        [newColumnKey]: ''
      }
    }));
  }, []);

  const removeColumn = useCallback((columnKey) => {
    setEditedTable(prev => ({
      ...prev,
      data: prev.data.map(row => {
        const { [columnKey]: removed, ...rest } = row;
        return rest;
      }),
      units: Object.fromEntries(
        Object.entries(prev.units || {}).filter(([key]) => key !== columnKey)
      )
    }));
  }, []);

  const renameColumn = useCallback((oldKey, newKey) => {
    if (oldKey === newKey) return;
    
    setEditedTable(prev => ({
      ...prev,
      data: prev.data.map(row => {
        const { [oldKey]: value, ...rest } = row;
        return { ...rest, [newKey]: value };
      }),
      units: Object.fromEntries(
        Object.entries(prev.units || {}).map(([key, unit]) => 
          key === oldKey ? [newKey, unit] : [key, unit]
        )
      )
    }));
  }, []);

  const saveChanges = useCallback(() => {
    console.log('💾 Sauvegarde des modifications de la table');
    onTableUpdate(editedTable);
    onEditModeChange(false);
  }, [editedTable, onTableUpdate, onEditModeChange]);

  const cancelChanges = useCallback(() => {
    console.log('❌ Annulation des modifications');
    setEditedTable(initialTable);
    onEditModeChange(false);
  }, [initialTable, onEditModeChange]);

  const copyTableToClipboard = useCallback(() => {
    if (!editedTable.data || editedTable.data.length === 0) return;

    const headers = Object.keys(editedTable.data[0]);
    const csvContent = [
      headers.join('\t'),
      ...editedTable.data.map(row => 
        headers.map(header => row[header] || '').join('\t')
      )
    ].join('\n');

    navigator.clipboard.writeText(csvContent).then(() => {
      // TODO: Afficher une notification de succès
    });
  }, [editedTable.data]);

  // Validation des données
  const validateData = useCallback(() => {
    const errors = [];
    if (!editedTable || !editedTable.data || editedTable.data.length === 0) {
      return errors; // Retourner un tableau vide au lieu d'ajouter une erreur
    }

    editedTable.data.forEach((row, rowIndex) => {
      Object.entries(row).forEach(([key, value]) => {
        if (typeof value === 'string' && value.match(/^\d+\.?\d*$/)) {
          // Valeur qui pourrait être numérique mais est en string
          errors.push(`Ligne ${rowIndex + 1}, colonne "${key}": valeur potentiellement numérique stockée comme texte`);
        }
      });
    });

    return errors;
  }, [editedTable.data]);

  // Protection contre les données manquantes
  if (!table && !editedTable) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>Aucune donnée de tableau à afficher</p>
      </div>
    );
  }

  const validationErrors = editedTable ? validateData() : [];
  const columns = editedTable?.data && editedTable.data.length > 0 
    ? Object.keys(editedTable.data[0]).filter(key => {
        // Filtrer les clés string valides
        if (typeof key !== 'string' || key.startsWith('_')) return false;
        
        // Vérifier que la valeur n'est pas un objet de configuration (axes, etc.)
        const firstValue = editedTable.data[0][key];
        if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
          // Si c'est un objet avec les propriétés min, max, etc., on l'exclut
          if ('min' in firstValue || 'max' in firstValue || 'calibrated' in firstValue) {
            return false;
          }
        }
        
        return true;
      })
    : [];

  if (viewMode === 'json') {
    return (
      <div style={sx.components.card.base}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h6 style={sx.combine(sx.text.sm, sx.text.bold)}>
            <FileText size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Structure JSON
          </h6>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyTableToClipboard();
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '4px 8px' })}
          >
            <Copy size={14} />
          </button>
        </div>
        <pre style={{
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '6px',
          fontSize: '12px',
          overflow: 'auto',
          maxHeight: '400px',
          border: '1px solid #e2e8f0'
        }}>
          {JSON.stringify(editedTable, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={sx.components.card.base}>
      {/* En-tête du tableau */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <div>
          <h6 style={sx.combine(sx.text.sm, sx.text.bold)}>
            <TableIcon size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {isEditMode ? (
              <input
                type="text"
                value={editedTable.table_name || ''}
                onChange={(e) => handleTableChange('table_name', e.target.value)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
                placeholder="Nom du tableau"
              />
            ) : (
              editedTable.table_name || 'Tableau sans nom'
            )}
          </h6>
          
          {/* Conditions */}
          {(editedTable.conditions || isEditMode) && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              Conditions: {isEditMode ? (
                <input
                  type="text"
                  value={typeof editedTable.conditions === 'object' ? 
                    JSON.stringify(editedTable.conditions) : 
                    (editedTable.conditions || '')}
                  onChange={(e) => handleTableChange('conditions', e.target.value)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    minWidth: '200px'
                  }}
                  placeholder="Conditions d'application"
                />
              ) : (
                typeof editedTable.conditions === 'object' ? 
                  formatConditions(editedTable.conditions) : 
                  editedTable.conditions
              )}
            </p>
          )}
        </div>

        {/* Cacher les boutons pour les tableaux combinés */}
        {!editedTable.isCombined && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            {!isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyTableToClipboard();
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 8px' })}
                  title="Copier vers le presse-papiers"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onEditModeChange) {
                      onEditModeChange(true);
                    }
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 8px' })}
                >
                  <Edit3 size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelChanges();
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 8px' })}
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveChanges();
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary, { padding: '6px 8px' })}
                >
                  <Save size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Métadonnées - cachées pour les tableaux combinés */}
      {showMetadata && editedTable && !editedTable.isCombined && (editedTable.analysisMetadata || editedTable.sourceImage) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpandedMetadata(!expandedMetadata);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
              color: 'inherit'
            }}
          >
            {expandedMetadata ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span style={sx.text.xs}>Métadonnées d'extraction</span>
          </button>
          
          {expandedMetadata && (
            <div style={sx.spacing.mt(2)}>
              {editedTable.sourceImage && (
                <p style={sx.text.xs}>
                  <strong>Source:</strong> {editedTable.sourceImage.name}
                </p>
              )}
              {editedTable.analysisMetadata && (
                <div style={sx.text.xs}>
                  <p><strong>Analysé le:</strong> {new Date(editedTable.analysisMetadata.analyzedAt).toLocaleString('fr-FR')}</p>
                  {editedTable.analysisMetadata.confidence && (
                    <p><strong>Confiance:</strong> {Math.round(editedTable.analysisMetadata.confidence * 100)}%</p>
                  )}
                  {editedTable.analysisMetadata.detectionMethod && (
                    <p><strong>Méthode:</strong> {editedTable.analysisMetadata.detectionMethod}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Erreurs de validation */}
      {validationErrors.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(3))}>
          <AlertTriangle size={14} />
          <div>
            <p style={sx.combine(sx.text.xs, sx.text.bold)}>Avertissements de validation:</p>
            <ul style={sx.combine(sx.text.xs, { marginLeft: '12px', marginTop: '4px' })}>
              {validationErrors.slice(0, 3).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {validationErrors.length > 3 && (
                <li>... et {validationErrors.length - 3} autres</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Boutons d'édition de structure */}
      {isEditMode && (
        <div style={sx.combine(sx.flex.start, sx.spacing.gap(2), sx.spacing.mb(3))}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addRow();
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '4px 8px' })}
          >
            <Plus size={14} style={{ marginRight: '4px' }} />
            Ligne
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addColumn();
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '4px 8px' })}
          >
            <Plus size={14} style={{ marginRight: '4px' }} />
            Colonne
          </button>
        </div>
      )}

      {/* Tableau de données */}
      {editedTable.data && editedTable.data.length > 0 ? (
        <div style={{ overflow: 'auto', maxHeight: '500px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
              <tr>
                {isEditMode && <th style={{ padding: '8px', border: '1px solid #e2e8f0', width: '30px' }}>#</th>}
                {columns.map((column) => (
                  <th key={column} style={{ 
                    padding: '8px', 
                    border: '1px solid #e2e8f0',
                    textAlign: 'left',
                    minWidth: '100px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {/* Nom de colonne */}
                      {isEditMode ? (
                        <input
                          type="text"
                          value={column}
                          onChange={(e) => renameColumn(column, e.target.value)}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: '3px',
                            padding: '2px 4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 'bold' }}>
                          {typeof column === 'object' ? JSON.stringify(column) : String(column)}
                        </span>
                      )}
                      
                      {/* Unité */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editedTable.units?.[column] || ''}
                            onChange={(e) => handleUnitsChange(column, e.target.value)}
                            style={{
                              border: '1px solid #d1d5db',
                              borderRadius: '3px',
                              padding: '1px 3px',
                              fontSize: '10px',
                              width: '50px'
                            }}
                            placeholder="unité"
                          />
                        ) : (
                          editedTable.units?.[column] && (
                            <span style={{ 
                              fontSize: '10px', 
                              color: '#6b7280',
                              backgroundColor: '#f3f4f6',
                              padding: '1px 4px',
                              borderRadius: '3px'
                            }}>
                              {editedTable.units[column]}
                            </span>
                          )
                        )}
                        
                        {/* Bouton supprimer colonne */}
                        {isEditMode && columns.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeColumn(column);
                            }}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              width: '16px',
                              height: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '10px'
                            }}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editedTable.data.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ 
                  backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9fafb' 
                }}>
                  {/* Bouton supprimer ligne */}
                  {isEditMode && (
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (editedTable.data.length > 1) {
                            removeRow(rowIndex);
                          }
                        }}
                        disabled={editedTable.data.length <= 1}
                        style={{
                          background: editedTable.data.length <= 1 ? '#d1d5db' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: editedTable.data.length <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: '10px'
                        }}
                      >
                        <Minus size={10} />
                      </button>
                    </td>
                  )}
                  
                  {/* Cellules de données */}
                  {columns.map((column) => (
                    <td key={`${rowIndex}-${column}`} style={{ 
                      padding: '8px', 
                      border: '1px solid #e2e8f0' 
                    }}>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={row[column] || ''}
                          onChange={(e) => handleDataChange(rowIndex, column, e.target.value)}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: '3px',
                            padding: '2px 4px',
                            fontSize: '11px',
                            width: '100%'
                          }}
                        />
                      ) : (
                        <span style={{ 
                          fontFamily: typeof row[column] === 'number' ? 'monospace' : 'inherit' 
                        }}>
                          {typeof row[column] === 'object' && row[column] !== null ? 
                            JSON.stringify(row[column]) : 
                            (row[column] ?? '')}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>Aucune donnée disponible dans ce tableau</p>
        </div>
      )}

      {/* Statistiques du tableau */}
      {editedTable.data && editedTable.data.length > 0 && (
        <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(3))}>
          {editedTable.data.length} ligne(s) × {columns.length} colonne(s)
          {editedTable.validation?.isValid === false && (
            <span style={{ color: '#ef4444', marginLeft: '8px' }}>
              ⚠️ Erreurs de validation détectées
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Mémoriser le composant pour éviter les re-renders inutiles
export default React.memo(TableDisplay, (prevProps, nextProps) => {
  // Re-render seulement si les props importantes changent
  return (
    prevProps.table?.table_name === nextProps.table?.table_name &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.showMetadata === nextProps.showMetadata &&
    prevProps.isEditMode === nextProps.isEditMode &&
    prevProps.onEditModeChange === nextProps.onEditModeChange &&
    prevProps.onTableUpdate === nextProps.onTableUpdate
  );
});