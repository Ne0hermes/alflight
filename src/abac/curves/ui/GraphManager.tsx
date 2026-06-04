import React, { useState } from 'react';
import { GraphConfig } from '../core/types';

interface GraphManagerProps {
  graphs: GraphConfig[];
  selectedGraphId: string | null;
  onAddGraph: (graph: GraphConfig) => void;
  onRemoveGraph: (graphId: string) => void;
  onSelectGraph: (graphId: string) => void;
  onUpdateGraph: (graphId: string, updates: Partial<GraphConfig>) => void;
  onLinkGraphs?: (fromId: string, toId: string) => void;
  onUnlinkGraphs?: (fromId: string, toId: string) => void;
);}


const styles = {
  container: {
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px',
    border: '1px solid var(--accent-primary)'
  },
  graphList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  graphItem: {
    padding: '12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  graphItemSelected: {
    border: '1px solid var(--accent-primary)',
    backgroundColor: 'var(--accent-soft)'
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
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'var(--color-red-critical)',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'var(--bg-overlay)'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '24px',
    color: 'var(--text-tertiary)',
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
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkFromId, setLinkFromId] = useState<string>('');
  const [linkToId, setLinkToId] = useState<string>('');

  return (
    <div style={styles.container}>
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
              {/* Titre */}
              <div style={styles.graphName}>
                {graph.name}
                {graph.isWindRelated && (
                  <span style={{
                    marginLeft: '8px',
                    padding: '2px 6px',
                    backgroundColor: 'var(--bg-overlay)',
                    color: 'var(--accent-primary)',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 'normal'
                  }}>
                    💨 Vent
                  </span>
                )}
              </div>
            </div>

        )}
      </div>

      {graphs.length > 1 && (
        <>
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-overlay)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  🔗 <strong>Liaisons entre graphiques</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Liez les graphiques pour créer des chaînes de calcul
                </div>
              </div>
              <button
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onClick={() => setShowLinkForm(!showLinkForm)}
              >
                {showLinkForm ? 'Annuler' : 'Créer une liaison'}
              </button>
            </div>

            {showLinkForm && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--bg-overlay)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                      if (linkFromId && linkToId && onLinkGraphs) {
                        onLinkGraphs(linkFromId, linkToId);
                        setShowLinkForm(false);
                        setLinkFromId('');
                        setLinkToId('');
                      }
                    }}
                    disabled={!linkFromId || !linkToId}
                    style={{
                      padding: '3px 8px',
                      backgroundColor: linkFromId && linkToId ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: linkFromId && linkToId ? 'pointer' : 'not-allowed',
                      fontSize: '11px'
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
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                  Liaisons actives :
                </div>
                {graphs.filter(g => g.linkedTo && g.linkedTo.length > 0).map(fromGraph => (
                  <div key={fromGraph.id} style={{
                    fontSize: '11px',
                    padding: '6px',
                    backgroundColor: 'var(--bg-overlay)',
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
                          backgroundColor: 'var(--color-red-critical)',
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
};