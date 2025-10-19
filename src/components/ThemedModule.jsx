import React from 'react';
import { theme } from '../styles/theme';

export const ThemedModule = ({ children, title }) => {
  return (
    <div style={styles.container}>
      {title && (
        <header style={styles.header}>
          <h1 style={styles.title}>{title}</h1>
        </header>
      )}
      <div style={styles.content}>
        {children}
      </div>
    </div>

const styles = {
  container: {
    minHeight: '100%',
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
  },
  header: {
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: `linear-gradient(135deg, ${theme.colors.primary}11, ${theme.colors.accent}05)`,
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.colors.primary,
  },
  content: {
    padding: '20px',
  }
};