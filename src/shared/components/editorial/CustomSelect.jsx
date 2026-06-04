// ============================================================================
//  CustomSelect — Dropdown custom React 100% charte ALFlight
//  ----------------------------------------------------------------------------
//  Remplace les <select>/<option> HTML natifs (dont les <option> sont rendues
//  par l'OS et impossibles à styler : angles vifs Windows, highlight bleu
//  système, police du système, débordement du cadre).
//
//  Composition :
//   - Trigger button stylé ALFlight (apparence d'un select fermé)
//   - Liste position absolute calée à la largeur du trigger (jamais plus large)
//   - Click-outside + Escape pour fermer
//   - Option sélectionnée : fond accent-soft + texte orange + check icon
//   - Hover : ivoire subtle (jamais de bleu système)
//   - Polices ALFlight (Century Gothic)
//
//  Usage :
//    <CustomSelect
//      value={selectedUnit}
//      options={[
//        { value: 'nm', label: 'Milles nautiques (NM)' },
//        { value: 'km', label: 'Kilomètres (km)' },
//      ]}
//      onChange={(val) => setUnit(val)}
//      ariaLabel="Unité de distance"
//    />
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const CustomSelect = ({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Sélectionner…',
  disabled = false,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((p) => !p)}
        style={{
          ...styles.trigger,
          // Bordure TRANSPARENTE au repos (cohérent avec MuiOutlinedInput
          // ALFlight — l'utilisateur a explicitement demandé "rendre cet
          // élément transparent"). Au open : bordure orange.
          borderColor: open ? 'var(--accent-primary)' : 'transparent',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={styles.triggerLabel}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {open && (
        <ul role="listbox" style={styles.menu}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                style={{
                  ...styles.option,
                  backgroundColor: isSelected ? 'var(--accent-soft)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 242, 236, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={styles.optionLabel}>{opt.label}</span>
                {isSelected && (
                  <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--fs-body)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  triggerLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 100,
    margin: 0,
    padding: '4px',
    listStyle: 'none',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-regular)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    maxHeight: '320px',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--fs-body)',
    borderRadius: 'var(--radius-sm)',
    transition: 'background-color 0.1s ease',
    outline: 'none',
  },
  optionLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export default CustomSelect;
