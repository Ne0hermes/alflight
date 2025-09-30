// Visual Debug Helper pour ALFlight
// Ajoute des bordures colorées et infos visuelles pour debug

export const enableVisualDebug = () => {
  const style = document.createElement('style');
  style.id = 'visual-debug';
  style.innerHTML = `
    /* Bordures colorées pour chaque niveau */
    * { outline: 1px solid rgba(255, 0, 0, 0.1) !important; }
    *:hover { outline: 2px solid rgba(255, 0, 0, 0.5) !important; }
    
    /* Affiche les classes et dimensions */
    [data-debug]::before {
      content: attr(data-debug);
      position: absolute;
      top: 0;
      left: 0;
      background: #ff0000;
      color: white;
      font-size: 10px;
      padding: 2px 4px;
      z-index: 10000;
      pointer-events: none;
    }
    
    /* Grille de référence */
    .debug-grid {
      background-image: 
        repeating-linear-gradient(0deg, rgba(139, 21, 56, 0.1) 0px, transparent 1px, transparent 20px, rgba(139, 21, 56, 0.1) 21px),
        repeating-linear-gradient(90deg, rgba(139, 21, 56, 0.1) 0px, transparent 1px, transparent 20px, rgba(139, 21, 56, 0.1) 21px);
    }
    
    /* Zones problématiques */
    .overflow-hidden { background: rgba(255, 0, 0, 0.1) !important; }
    .overflow-auto { background: rgba(0, 255, 0, 0.1) !important; }
    .position-fixed { background: rgba(0, 0, 255, 0.1) !important; }
    .position-absolute { background: rgba(255, 255, 0, 0.1) !important; }
  `;
  document.head.appendChild(style);
  
  // Ajoute infos au survol
  document.addEventListener('mouseover', (e) => {
    const elem = e.target;
    const rect = elem.getBoundingClientRect();
    elem.title = `${elem.tagName} | ${Math.round(rect.width)}x${Math.round(rect.height)} | ${elem.className}`;
  });
  
  console.log('🔍 Debug Visuel Activé - Appuyez sur Ctrl+D pour désactiver');
};

export const disableVisualDebug = () => {
  const style = document.getElementById('visual-debug');
  if (style) style.remove();
  console.log('Debug Visuel Désactivé');
};

// Raccourci clavier Ctrl+D
let debugEnabled = false;
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'd') {
    e.preventDefault();
    debugEnabled = !debugEnabled;
    debugEnabled ? enableVisualDebug() : disableVisualDebug();
  }
});

// Outil de capture d'écran avec annotations
export const captureDebugScreenshot = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Capture le viewport actuel
  html2canvas(document.body).then(canvas => {
    // Ajoute annotations
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    
    // Marque les éléments problématiques
    document.querySelectorAll('[data-debug-issue]').forEach(elem => {
      const rect = elem.getBoundingClientRect();
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.fillStyle = '#FF0000';
      ctx.fillText(elem.dataset.debugIssue, rect.left, rect.top - 5);
    });
    
    // Télécharge l'image
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-${Date.now()}.png`;
      a.click();
    });
  });
};