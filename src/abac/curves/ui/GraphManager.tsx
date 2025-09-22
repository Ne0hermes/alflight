import React, { useState, useCallback } from 'react';
import { GraphConfig } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

interface GraphManagerProps {
  graphs: GraphConfig[];
  selectedGraphId: string | null;
  onAddGraph: (graph: GraphConfig) => void;
  onRemoveGraph: (graphId: string) => void;
  onSelectGraph: (graphId: string) => void;
  onUpdateGraph: (graphId: string, updates: Partial<GraphConfig>) => void;
  onLinkGraphs?: (fromId: string, toId: string) => void;
  onUnlinkGraphs?: (fromId: string, toId: string) => void;
}


const styles = {
  container: {
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    border: '1px solid #2196F3'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1976d2'
  },
  addButton: {
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  graphList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  graphItem: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  graphItemSelected: {
    border: '1px solid #4CAF50',
    backgroundColor: '#f0f8f0'
  },
  graphInfo: {
    flex: 1
  },
  graphName: {
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center'
  },
  graphMeta: {
    fontSize: '12px',
    color: '#666',
    paddingTop: '4px',
    borderTop: '1px solid #e0e0e0'
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  form: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    marginBottom: '12px'
  },
  formField: {
    marginBottom: '12px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px'
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'white'
  },
  formActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '24px',
    color: '#999',
    fontSize: '13px'
  }
};

export const GraphManager: React.FC<GraphManagerProps> = ({
  graphs,
  selectedGraphId,
  onAddGraph,
  onRemoveGraph,
  onSelectGraph,
  onUpdateGraph,
  onLinkGraphs,
  onUnlinkGraphs
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGraphName, setNewGraphName] = useState('');
  const [newGraphIsWindRelated, setNewGraphIsWindRelated] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkFromId, setLinkFromId] = useState<string>('');
  const [linkToId, setLinkToId] = useState<string>('');

  const handleAddGraph = useCallback(() => {
    const name = newGraphName.trim() || `Graphique ${graphs.length + 1}`;
    const newGraph: GraphConfig = {
      id: uuidv4(),
      name,
      isWindRelated: newGraphIsWindRelated,
      axes: {
        xAxis: { min: 0, max: 100, unit: '', title: 'Axe X' },
        yAxis: { min: 0, max: 100, unit: '', title: 'Axe Y' }
      },
      curves: []
    };

    onAddGraph(newGraph);
    setNewGraphName('');
    setNewGraphIsWindRelated(false);
    setShowAddForm(false);
  }, [newGraphName, newGraphIsWindRelated, graphs.length, onAddGraph]);


  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Graphiques du système</h3>
        <button
          style={styles.addButton}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Annuler' : '+ Nouveau graphique'}
        </button>
      </div>

      {showAddForm && (
        <div style={styles.form}>
          <div style={styles.formField}>
            <label style={styles.label}>Nom du graphique</label>
            <input
              type="text"
              value={newGraphName}
              onChange={(e) => setNewGraphName(e.target.value)}
              placeholder="Ex: Décollage, Atterrissage..."
              style={styles.input}
            />
          </div>
          <div style={styles.formField}>
            <label style={{ ...styles.label, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newGraphIsWindRelated}
                onChange={(e) => setNewGraphIsWindRelated(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Ce graphique concerne le vent (permet de spécifier vent de face/arrière pour chaque courbe)
            </label>
          </div>
          <div style={styles.formActions}>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ ...styles.addButton, backgroundColor: '#999' }}
            >
              Annuler
            </button>
            <button
              onClick={handleAddGraph}
              style={styles.addButton}
            >
              Créer le graphique
            </button>
          </div>
        </div>
      )}

      <div style={styles.graphList}>
        {graphs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
            Aucun graphique configuré.
            <br />
            Commencez par créer votre premier graphique.
          </div>
        ) : (
          graphs.map(graph => (
            <div
              key={graph.id}
              style={{
                ...styles.graphItem,
                ...(selectedGraphId === graph.id ? styles.graphItemSelected : {}),
                flexDirection: 'column',
                alignItems: 'stretch'
              }}
              onClick={() => onSelectGraph(graph.id)}
            >
              {/* Ligne 1: Titre */}
              <div style={styles.graphName}>
                {graph.name}
                {graph.isWindRelated && (
                  <span style={{
                    marginLeft: '8px',
                    padding: '2px 6px',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 'normal'
                  }}>
                    💨 Vent
                  </span>
                )}
              </div>

              {/* Ligne 2: Méta-informations */}
              <div style={styles.graphMeta}>
                {graph.axes ? (
                  <span style={{ color: '#4CAF50', marginRight: '8px' }}>✓ Axes configurés</span>
                ) : (
                  <span style={{ color: '#ff9800', marginRight: '8px' }}>⚠ Axes non configurés</span>
                )}
                • {graph.curves.length} courbe{graph.curves.length !== 1 ? 's' : ''}
                {graph.linkedTo && graph.linkedTo.length > 0 && (
                  <span> • Lié à {graph.linkedTo.length} graphique{graph.linkedTo.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Ligne 3: Boutons */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                <button
                  style={{
                    ...styles.deleteButton,
                    backgroundColor: '#2196F3',
                    padding: '4px',
                    fontSize: '16px',
                    flex: 1
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIsWindRelated = !graph.isWindRelated;
                    onUpdateGraph(graph.id, { isWindRelated: newIsWindRelated });
                  }}
                  title={graph.isWindRelated ? "Désactiver le mode vent" : "Activer le mode vent"}
                >
                  {graph.isWindRelated ? '🚫' : '💨'}
                </button>
                <button
                  style={{
                    ...styles.deleteButton,
                    flex: 2
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Supprimer le graphique "${graph.name}" ?`)) {
                      onRemoveGraph(graph.id);
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {graphs.length > 1 && (
        <>
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f4f8', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  🔗 <strong>Liaisons entre graphiques</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  Liez les graphiques pour créer des chaînes de calcul
                </div>
              </div>
              <button
                style={{ ...styles.addButton, backgroundColor: '#2196F3', fontSize: '12px', padding: '4px 10px' }}
                onClick={() => setShowLinkForm(!showLinkForm)}
              >
                {showLinkForm ? 'Annuler' : 'Créer une liaison'}
              </button>
            </div>

            {showLinkForm && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                    Graphique source (sortie Y)
                  </label>
                  <select
                    value={linkFromId}
                    onChange={(e) => setLinkFromId(e.target.value)}
                    style={{ ...styles.select, fontSize: '12px', padding: '4px 8px' }}
                  >
                    <option value="">-- Sélectionnez --</option>
                    {graphs.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.axes?.yAxis?.title || 'Y'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                    Graphique cible (entrée X)
                  </label>
                  <select
                    value={linkToId}
                    onChange={(e) => setLinkToId(e.target.value)}
                    style={{ ...styles.select, fontSize: '12px', padding: '4px 8px' }}
                  >
                    <option value="">-- Sélectionnez --</option>
                    {graphs
                      .filter(g => g.id !== linkFromId)
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.axes?.xAxis?.title || 'X'})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowLinkForm(false);
                      setLinkFromId('');
                      setLinkToId('');
                    }}
                    style={{ ...styles.addButton, backgroundColor: '#999', fontSize: '11px', padding: '3px 8px' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      if (linkFromId && linkToId && onLinkGraphs) {
                        onLinkGraphs(linkFromId, linkToId);
                        setShowLinkForm(false);
                        setLinkFromId('');
                        setLinkToId('');
                      }
                    }}
                    disabled={!linkFromId || !linkToId}
                    style={{
                      ...styles.addButton,
                      backgroundColor: linkFromId && linkToId ? '#2196F3' : '#ccc',
                      fontSize: '11px',
                      padding: '3px 8px',
                      cursor: linkFromId && linkToId ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Créer la liaison
                  </button>
                </div>
              </div>
            )}

            {/* Affichage des liaisons existantes */}
            {graphs.some(g => g.linkedTo && g.linkedTo.length > 0) && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>
                  Liaisons actives :
                </div>
                {graphs.filter(g => g.linkedTo && g.linkedTo.length > 0).map(fromGraph => (
                  <div key={fromGraph.id} style={{
                    fontSize: '11px',
                    padding: '6px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '3px',
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      {fromGraph.name} → {fromGraph.linkedTo?.map(toId => {
                        const toGraph = graphs.find(g => g.id === toId);
                        return toGraph?.name;
                      }).join(', ')}
                    </span>
                    {onUnlinkGraphs && (
                      <button
                        onClick={() => {
                          fromGraph.linkedTo?.forEach(toId => {
                            onUnlinkGraphs(fromGraph.id, toId);
                          });
                        }}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};