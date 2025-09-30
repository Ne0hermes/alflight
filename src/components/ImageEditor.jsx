import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateCw as RotateIcon,
  Move as MoveIcon,
  Maximize2 as FitIcon,
  X as CloseIcon,
  Edit2 as EditIcon,
  Check as CheckIcon
} from 'lucide-react';

const ImageEditor = ({
  src,
  alt = "Image",
  onSave,
  width = 300,
  height = 200,
  className = "",
  placeholder = null,
  showControls = true,
  initialZoom = 1,
  initialPosition = { x: 0, y: 0 },
  shape = "rectangle" // "rectangle", "square", "circle"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [zoom, setZoom] = useState(initialZoom);
  const [position, setPosition] = useState(initialPosition);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Réinitialiser quand l'image change
  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        setImageLoaded(true);
      };
      img.onerror = () => {
        console.error('Erreur de chargement de l\'image:', src);
        setImageLoaded(false);
      };
      img.src = src;
    } else {
      setImageLoaded(false);
    }
  }, [src]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, 0.3));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFit = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleMouseDown = (e) => {
    if (!isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isEditing) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (!isEditing) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)));
  };

  // Utiliser useEffect pour attacher l'événement wheel avec { passive: false }
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isEditing) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)));
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      container.removeEventListener('wheel', wheelHandler);
    };
  }, [isEditing]);

  const handleSave = () => {
    if (onSave) {
      onSave({
        zoom,
        position,
        rotation,
        src
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setZoom(initialZoom);
    setPosition(initialPosition);
    setRotation(0);
    setIsEditing(false);
  };

  const startEditing = () => {
    setIsEditing(true);
  };

  // Déterminer la forme du masque
  const getMaskStyle = () => {
    switch (shape) {
      case 'circle':
        return {
          borderRadius: '50%',
          aspectRatio: '1'
        };
      case 'square':
        return {
          borderRadius: '8px',
          aspectRatio: '1'
        };
      default:
        return {
          borderRadius: '8px'
        };
    }
  };

  // Style pour le conteneur principal
  const containerStyle = {
    position: 'relative',
    width: width,
    height: height,
    display: 'inline-block',
    ...getMaskStyle()
  };

  // Style pour l'aperçu de l'image
  const previewContainerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    border: '2px solid #e5e7eb',
    cursor: showControls ? 'pointer' : 'default',
    ...getMaskStyle()
  };

  const previewImageStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
    width: shape === 'circle' ? `${100 * zoom}%` : '100%',
    height: shape === 'circle' ? `${100 * zoom}%` : '100%',
    objectFit: zoom === 1 ? 'cover' : 'contain',
    transition: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    maxWidth: zoom > 1 ? 'none' : '100%',
    maxHeight: zoom > 1 ? 'none' : '100%'
  };

  // Style pour le mode édition
  const editorOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const editorContainerStyle = {
    position: 'relative',
    width: '600px',
    height: '400px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
  };

  const editorViewportStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  // Cadre de visualisation
  const frameStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: shape === 'circle' || shape === 'square' ? '250px' : '300px',
    height: shape === 'circle' || shape === 'square' ? '250px' : '200px',
    border: '3px dashed #3b82f6',
    pointerEvents: 'none',
    zIndex: 10,
    ...getMaskStyle(),
    backgroundColor: 'transparent',
    boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.4)'
  };

  const editorImageStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
    maxWidth: 'none',
    height: 'auto',
    transition: isDragging ? 'none' : 'transform 0.1s ease',
    pointerEvents: 'none',
    userSelect: 'none'
  };

  const controlsStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  };

  const buttonStyle = {
    padding: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '36px',
    transition: 'all 0.2s',
    fontSize: '14px'
  };

  const infoStyle = {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#374151',
    fontWeight: '500'
  };

  // Si pas d'image, afficher le placeholder
  if (!src) {
    return (
      <div style={containerStyle} className={className}>
        {placeholder || (
          <div style={previewContainerStyle}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              Aucune image
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mode édition
  if (isEditing) {
    return (
      <div style={editorOverlayStyle}>
        <div style={infoStyle}>
          Zoom: {Math.round(zoom * 100)}% | Rotation: {rotation}°
        </div>

        <div style={editorContainerStyle}>
          <div
            ref={containerRef}
            style={editorViewportStyle}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Image à éditer */}
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              style={editorImageStyle}
              draggable={false}
              onLoad={() => setImageLoaded(true)}
            />

            {/* Cadre de visualisation */}
            <div style={frameStyle}>
              <div style={{
                position: 'absolute',
                top: '-25px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '12px',
                color: '#3b82f6',
                backgroundColor: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap'
              }}>
                Zone visible après validation
              </div>
            </div>
          </div>

          {/* Contrôles */}
          <div style={controlsStyle}>
            <button
              onClick={handleZoomOut}
              style={buttonStyle}
              title="Zoom arrière"
            >
              <ZoomOutIcon size={18} />
            </button>

            <button
              onClick={handleZoomIn}
              style={buttonStyle}
              title="Zoom avant"
            >
              <ZoomInIcon size={18} />
            </button>

            <button
              onClick={handleRotate}
              style={buttonStyle}
              title="Rotation 90°"
            >
              <RotateIcon size={18} />
            </button>

            <button
              onClick={handleFit}
              style={buttonStyle}
              title="Réinitialiser"
            >
              <FitIcon size={18} />
            </button>

            <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />

            <button
              onClick={handleCancel}
              style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
              title="Annuler"
            >
              <CloseIcon size={18} />
            </button>

            <button
              onClick={handleSave}
              style={{ ...buttonStyle, backgroundColor: '#10b981', padding: '8px 16px' }}
              title="Valider"
            >
              <CheckIcon size={18} style={{ marginRight: '4px' }} />
              Valider
            </button>
          </div>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          <MoveIcon size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Glissez pour déplacer • Molette pour zoomer • Cliquez les boutons pour ajuster
        </div>
      </div>
    );
  }

  // Mode aperçu
  return (
    <div style={containerStyle} className={className}>
      <div
        style={previewContainerStyle}
        onClick={showControls ? startEditing : undefined}
        title={showControls ? "Cliquer pour éditer" : ""}
      >
        {imageLoaded && (
          <img
            src={src}
            alt={alt}
            style={previewImageStyle}
          />
        )}

        {/* Bouton d'édition en overlay */}
        {showControls && imageLoaded && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '6px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s',
            zIndex: 5
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'}
          >
            <EditIcon size={14} />
            Éditer
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageEditor;