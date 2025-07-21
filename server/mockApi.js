// server/mockApi.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Mock data pour les cartes VAC
const mockCharts = [
  {
    id: 'LFPG-VAC-2024-01',
    airportIcao: 'LFPG',
    airportName: 'Paris Charles de Gaulle',
    type: 'VAC',
    version: '2024-01',
    effectiveDate: new Date('2024-01-25'),
    expiryDate: new Date('2024-02-22'),
    fileSize: 2.5 * 1024 * 1024,
    isDownloaded: false,
    isOutdated: false,
    extractionStatus: 'pending'
  },
  {
    id: 'LFPO-VAC-2024-01',
    airportIcao: 'LFPO',
    airportName: 'Paris Orly',
    type: 'VAC',
    version: '2024-01',
    effectiveDate: new Date('2024-01-25'),
    expiryDate: new Date('2024-02-22'),
    fileSize: 2.2 * 1024 * 1024,
    isDownloaded: false,
    isOutdated: false,
    extractionStatus: 'pending'
  },
  {
    id: 'LFPB-VAC-2024-01',
    airportIcao: 'LFPB',
    airportName: 'Paris Le Bourget',
    type: 'VAC',
    version: '2024-01',
    effectiveDate: new Date('2024-01-25'),
    expiryDate: new Date('2024-02-22'),
    fileSize: 1.8 * 1024 * 1024,
    isDownloaded: false,
    isOutdated: false,
    extractionStatus: 'pending'
  }
];

// Endpoint pour récupérer la liste des cartes
app.get('/api/vac-charts', (req, res) => {
  res.json(mockCharts);
});

// Endpoint pour télécharger une carte (simulé)
app.get('/api/vac-charts/:id.pdf', (req, res) => {
  // En développement, retourner un PDF de test
  const testPdfPath = path.join(__dirname, 'test-vac.pdf');
  
  if (fs.existsSync(testPdfPath)) {
    res.sendFile(testPdfPath);
  } else {
    // Créer un PDF factice
    res.status(404).json({ error: 'PDF non trouvé' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API Mock VAC démarrée sur http://localhost:${PORT}`);
});