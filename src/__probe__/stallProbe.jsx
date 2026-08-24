// SONDE TEMPORAIRE (diagnostic bug matrice décrochage 24/08/2026).
// Monte le VRAI Step2Speeds avec le VRAI thème + les VRAIS styles globaux,
// dans un navigateur réel, pour MESURER la largeur utile de la cellule.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import muiTheme from '../styles/muiTheme';
import '../index.css';
import Step2Speeds from '../features/aircraft/components/wizard-steps/Step2Speeds';

const setByPath = (obj, path, value) => {
  const segs = path.split('.');
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) { cur[segs[i]] = { ...(cur[segs[i]] || {}) }; cur = cur[segs[i]]; }
  cur[segs[segs.length - 1]] = value;
  return out;
};

function Host() {
  const [data, setData] = useState({
    speeds: { vso: 45, vsTO: 48, vs1: 50, vno: 125, vne: 160, vfeLdg: 85,
              stallByBank: { clean: { b40: 57 } } },
  });
  return <Step2Speeds data={data} errors={{}} updateData={(p, v) => setData((d) => setByPath(d, p, v))} />;
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={muiTheme}><Host /></ThemeProvider>
);

// Mesure exposée à la console d'inspection.
window.mesureCellule = (label) => {
  const input = document.querySelector(`input[aria-label="${label}"]`);
  if (!input) return { erreur: 'cellule introuvable' };
  const cs = getComputedStyle(input);
  const root = input.closest('.MuiInputBase-root');
  const rcs = getComputedStyle(root);
  const ad = root.querySelector('.MuiInputAdornment-root');
  return {
    valeurDOM: input.value,
    largeurInput: input.getBoundingClientRect().width,
    paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
    boxSizing: cs.boxSizing, textAlign: cs.textAlign, fontSize: cs.fontSize,
    largeurUtile: input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    largeurRoot: root.getBoundingClientRect().width,
    paddingRootRight: rcs.paddingRight,
    largeurAdornment: ad ? ad.getBoundingClientRect().width : null,
    scrollWidthTexte: input.scrollWidth,
  };
};
