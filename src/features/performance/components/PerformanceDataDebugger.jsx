import React, { useState } from 'react';
import { Table, ChevronDown, ChevronUp, Database } from 'lucide-react';

const PerformanceDataDebugger = ({ tables }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!tables || tables.length === 0) return null;

    return (
        <div style={{
            marginTop: '20px',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-overlay)',
            overflow: 'hidden'
        }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-overlay)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color="var(--text-secondary)" />
                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Données brutes extraites ({tables.length} tableaux)
                    </span>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isOpen && (
                <div style={{ padding: '16px', overflowX: 'auto' }}>
                    {tables.map((table, idx) => (
                        <div key={idx} style={{ marginBottom: '24px' }}>
                            <h4 style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                marginBottom: '8px',
                                color: 'var(--text-primary)',
                                borderBottom: '1px solid var(--border-subtle)',
                                paddingBottom: '4px'
                            }}>
                                Tableau {idx + 1}: {table.name || table.table_name || 'Sans nom'} ({table.type || table.table_type})
                            </h4>

                            <div style={{
                                backgroundColor: 'var(--text-primary)',
                                color: 'var(--text-primary)',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}>
                                {JSON.stringify(table.data, null, 2)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PerformanceDataDebugger;
