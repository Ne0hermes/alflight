// FICHIER TEMPORAIRE DE REPRODUCTION — à supprimer après diagnostic.
// Monte le VRAI Step2Speeds avec le VRAI thème MUI et les VRAIS styles globaux
// (src/index.css), dans un vrai navigateur, avec un updateData qui se comporte
// comme celui du wizard (setState React).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import muiTheme from '../src/styles/muiTheme';
import '../src/index.css';
// Sonde : activée seulement si l'URL contient ?fix=1 — cf. plus bas.
import fixProbeUrl from './fix-probe.css?url';
import Step2Speeds from '../src/features/aircraft/components/wizard-steps/Step2Speeds.jsx';

const parsePath = (path) => path.split('.');

function Harness() {
  const [data, setData] = useState({
    speeds: { vso: 45, vsTO: 48, vs1: 50, vne: 160, vno: 125, vfeLdg: 85 },
  });
  const updateData = (path, value) => {
    setData((prev) => {
      const segs = parsePath(path);
      const out = { ...prev };
      let cur = out;
      for (let i = 0; i < segs.length - 1; i++) {
        cur[segs[i]] = cur[segs[i]] ? { ...cur[segs[i]] } : {};
        cur = cur[segs[i]];
      }
      cur[segs[segs.length - 1]] = value;
      return out;
    });
  };
  window.__reproData = data;
  return <Step2Speeds data={data} updateData={updateData} errors={{}} />;
}

if (new URLSearchParams(location.search).get('fix') === '1') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fixProbeUrl;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={muiTheme}>
    <CssBaseline />
    <Harness />
  </ThemeProvider>
);
