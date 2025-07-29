export const S = {
  // Flexbox
  flex: (d = 'row') => ({ display: 'flex', flexDirection: d }),
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center' }),
  
  // Spacing
  p: (v) => ({ padding: typeof v === 'number' ? `${v}px` : v }),
  m: (v) => ({ margin: typeof v === 'number' ? `${v}px` : v }),
  gap: (g) => ({ gap: `${g}px` }),
  
  // ... reste du code fourni dans l'artifact
};