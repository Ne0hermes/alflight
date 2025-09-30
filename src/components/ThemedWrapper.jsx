import React from 'react';
import { theme } from '../styles/theme';

export const ThemedWrapper = ({ children, title, className = '' }) => {
  return (
    <div className={`themed-module ${className}`} style={styles.container}>
      {title && (
        <header style={styles.header}>
          <h1 style={styles.title}>{title}</h1>
        </header>
      )}
      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100%',
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
  },
  header: {
    padding: '24px',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}08)`,
    backdropFilter: 'blur(10px)',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.colors.textPrimary,
    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  content: {
    padding: '24px',
    '& > *': {
      maxWidth: '100%',
    }
  }
};

export default ThemedWrapper;