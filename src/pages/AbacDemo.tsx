import React, { useState } from 'react';
import { AbacBuilder } from '../abac/curves';
import { AbacCurvesJSON } from '../abac/curves/core/types';
import styles from '../abac/curves/ui/styles.module.css';

export const AbacDemo: React.FC = () => {
  const [savedModel, setSavedModel] = useState<AbacCurvesJSON | null>(null);

  const handleSave = (json: AbacCurvesJSON) => {
    setSavedModel(json);
      };

  return (
    <div className={styles.abacDemoPage}>
      <header className={styles.demoHeader}>
        <h1>Abac Curves Builder Demo</h1>
        <p>Interactive tool for building abac curves through 4 steps</p>
      </header>

      <div className={styles.demoContainer}>
        <AbacBuilder onSave={handleSave} initialData={savedModel || undefined} />
      </div>

      {savedModel && (
        <div className={styles.savedIndicator}>
          Model saved! ({savedModel.curves.length} curves)
        </div>
      )}
    </div>

};

export default AbacDemo;