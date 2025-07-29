// src/features/weight-balance/components/WeightBalanceTable.jsx
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const WeightBalanceTable = memo(({ aircraft, loads, calculations }) => {
  const wb = aircraft.weightBalance;
  
  // Données du tableau mémorisées
  const tableData = useMemo(() => {
    const items = [];
    
    // Masse à vide
    items.push({
      label: 'Masse à vide',
      mass: aircraft.emptyWeight,
      arm: wb.emptyWeightArm,
      moment: (aircraft.emptyWeight * wb.emptyWeightArm).toFixed(1)
    });
    
    // Charges
    if (loads.frontLeft > 0) {
      items.push({
        label: 'Pilote',
        mass: loads.frontLeft,
        arm: wb.frontLeftSeatArm,
        moment: (loads.frontLeft * wb.frontLeftSeatArm).toFixed(1)
      });
    }
    
    if (loads.frontRight > 0) {
      items.push({
        label: 'Passager avant',
        mass: loads.frontRight,
        arm: wb.frontRightSeatArm,
        moment: (loads.frontRight * wb.frontRightSeatArm).toFixed(1)
      });
    }
    
    if (loads.rearLeft > 0) {
      items.push({
        label: 'Passager arrière gauche',
        mass: loads.rearLeft,
        arm: wb.rearLeftSeatArm,
        moment: (loads.rearLeft * wb.rearLeftSeatArm).toFixed(1)
      });
    }
    
    if (loads.rearRight > 0) {
      items.push({
        label: 'Passager arrière droit',
        mass: loads.rearRight,
        arm: wb.rearRightSeatArm,
        moment: (loads.rearRight * wb.rearRightSeatArm).toFixed(1)
      });
    }
    
    if (loads.baggage > 0) {
      items.push({
        label: 'Bagages',
        mass: loads.baggage,
        arm: wb.baggageArm,
        moment: (loads.baggage * wb.baggageArm).toFixed(1)
      });
    }
    
    if (loads.auxiliary > 0) {
      items.push({
        label: 'Rangement auxiliaire',
        mass: loads.auxiliary,
        arm: wb.auxiliaryArm,
        moment: (loads.auxiliary * wb.auxiliaryArm).toFixed(1)
      });
    }
    
    return items;
  }, [aircraft, loads, wb]);
  
  return (
    <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
        📐 Récapitulatif des moments
      </h4>
      
      <table style={styles.table}>
        <thead>
          <tr style={styles.headerRow}>
            <th style={styles.headerCell}>Élément</th>
            <th style={sx.combine(styles.headerCell, styles.rightAlign)}>Masse (kg)</th>
            <th style={sx.combine(styles.headerCell, styles.rightAlign)}>Bras (m)</th>
            <th style={sx.combine(styles.headerCell, styles.rightAlign)}>Moment (kg.m)</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <TableRow key={index} {...row} />
          ))}
          
          {/* Ligne carburant */}
          <tr style={styles.fuelRow}>
            <td style={styles.cell}>Carburant CRM</td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {loads.fuel}
            </td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {wb.fuelArm.toFixed(2)}
            </td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {(loads.fuel * wb.fuelArm).toFixed(1)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={styles.totalRow}>
            <td style={styles.totalCell}>TOTAL</td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign)}>
              {calculations?.totalWeight.toFixed(1) || '0.0'}
            </td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign)}>
              {calculations?.cg.toFixed(2) || '0.00'}
            </td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign, styles.totalMoment)}>
              {calculations?.totalMoment.toFixed(1) || '0.0'}
            </td>
          </tr>
        </tfoot>
      </table>
      
      <FormulaInfo cg={calculations?.cg} totalMoment={calculations?.totalMoment} totalWeight={calculations?.totalWeight} />
    </section>
  );
});

// Ligne du tableau mémorisée
const TableRow = memo(({ label, mass, arm, moment }) => (
  <tr style={styles.row}>
    <td style={styles.cell}>{label}</td>
    <td style={sx.combine(styles.cell, styles.rightAlign)}>{mass}</td>
    <td style={sx.combine(styles.cell, styles.rightAlign)}>{arm.toFixed(2)}</td>
    <td style={sx.combine(styles.cell, styles.rightAlign, styles.bold)}>{moment}</td>
  </tr>
));

// Info formule mémorisée
const FormulaInfo = memo(({ cg, totalMoment, totalWeight }) => (
  <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
    <div>
      <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
        💡 Formule du Centre de Gravité:
      </p>
      <p style={sx.text.sm}>
        CG = Moment total ÷ Masse totale = {totalMoment?.toFixed(1) || '0'} ÷ {totalWeight?.toFixed(1) || '1'} = {cg?.toFixed(3) || '0'} m
      </p>
    </div>
  </div>
));

// Styles statiques
const styles = {
  table: {
    width: '100%',
    fontSize: sx.theme.fontSize.sm,
    borderCollapse: 'collapse'
  },
  headerRow: {
    borderBottom: `1px solid ${sx.theme.colors.gray[200]}`
  },
  headerCell: {
    textAlign: 'left',
    padding: sx.theme.spacing[2],
    color: sx.theme.colors.gray[600],
    fontWeight: sx.theme.fontWeight.medium
  },
  row: {
    borderBottom: `1px solid ${sx.theme.colors.gray[100]}`
  },
  cell: {
    padding: `${sx.theme.spacing[1]} ${sx.theme.spacing[2]}`
  },
  rightAlign: {
    textAlign: 'right'
  },
  bold: {
    fontWeight: sx.theme.fontWeight.medium
  },
  fuelRow: {
    borderTop: `1px solid ${sx.theme.colors.gray[200]}`,
    backgroundColor: sx.theme.colors.success[50]
  },
  fuelText: {
    color: sx.theme.colors.success[700],
    fontWeight: sx.theme.fontWeight.semibold
  },
  totalRow: {
    borderTop: `2px solid ${sx.theme.colors.gray[700]}`
  },
  totalCell: {
    padding: sx.theme.spacing[2],
    fontWeight: sx.theme.fontWeight.bold
  },
  totalMoment: {
    color: sx.theme.colors.success[600]
  }
};

// Export display names
WeightBalanceTable.displayName = 'WeightBalanceTable';
TableRow.displayName = 'TableRow';
FormulaInfo.displayName = 'FormulaInfo';