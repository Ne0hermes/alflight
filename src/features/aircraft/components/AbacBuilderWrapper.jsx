import React from 'react';
import { AbacBuilder } from '../../../abac/curves/ui/AbacBuilder';

// Wrapper JSX pour le composant TypeScript AbacBuilder
const AbacBuilderWrapper = ({ onSave, initialData, modelName, aircraftModel }) => {
  return <AbacBuilder onSave={onSave} initialData={initialData} modelName={modelName} aircraftModel={aircraftModel} />;
};

export default AbacBuilderWrapper;