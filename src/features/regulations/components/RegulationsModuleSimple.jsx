import React from 'react';
import { Book } from 'lucide-react';
import { regulationsData } from '../data/regulationsData';

const RegulationsModuleSimple = () => {
  
  

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        <Book size={24} style={{ marginRight: '8px', display: 'inline' }} />
        Module Réglementations - Test
      </h1>
      
      <div>
        <p>Nombre de modules: {Object.keys(regulationsData).length}</p>
        
        <h2>Modules disponibles:</h2>
        <ul>
          {Object.entries(regulationsData).map(([key, module]) => (
            <li key={key}>
              <strong>{module.title}</strong> - {module.description}
              <ul>
                {module.sections.map(section => (
                  <li key={section.id}>
                    {section.title} ({section.regulations.length} règles)
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>

};

export default RegulationsModuleSimple;