// Force l'application du thème BLANC au chargement
export const applyTheme = () => {
  // Applique les styles de base immédiatement
  const style = document.createElement('style');
  style.id = 'alflight-theme-base';
  style.innerHTML = `
    body {
      background-color: #FFFFFF !important;
      color: #000000 !important;
      font-family: 'Space Grotesk', 'Inter', sans-serif !important;
    }
    
    #root {
      background-color: #FFFFFF !important;
      min-height: 100vh;
    }
  `;
  
  // Insère en premier pour que les autres styles puissent override si nécessaire
  const firstStyle = document.head.querySelector('style');
  if (firstStyle) {
    document.head.insertBefore(style, firstStyle);
  } else {
    document.head.appendChild(style);
  }
  
  console.log('🎨 Thème ALFlight fond blanc appliqué');
};

// Applique le thème dès que possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyTheme);
} else {
  applyTheme();
}