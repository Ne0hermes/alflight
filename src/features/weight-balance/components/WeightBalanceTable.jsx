// src/features/weight-balance/components/WeightBalanceTable.jsx
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const WeightBalanceTable = memo(({ aircraft, loads, calculations }) => {
  // ⚠️ PROTECTION: Vérifier que weightBalance existe
  if (!aircraft || !aircraft.weightBalance) {
    console.error('❌ [WeightBalanceTable] aircraft.weightBalance is undefined');
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <p>⚠️ Données de masse et centrage non disponibles pour cet avion</p>
      </div>
    );
  }

  const wb = aircraft.weightBalance;

  console.log('WeightBalanceTable - Current loads:', loads);
  console.log('WeightBalanceTable - Current calculations:', calculations);

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
    
    // Gérer les compartiments bagages dynamiques
    if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
      aircraft.baggageCompartments.forEach((compartment, index) => {
        const loadKey = `baggage_${compartment.id || index}`;
        const weight = loads[loadKey] || 0;
        if (weight > 0) {
          const arm = parseFloat(compartment.arm) || 3.50;
          items.push({
            label: compartment.name || `Compartiment ${index + 1}`,
            mass: weight,
            arm: arm,
            moment: (weight * arm).toFixed(1)
          });
        }
      });
    } else {
      // Fallback vers les compartiments par défaut
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
    }
    
    return items;
  }, [aircraft, loads, wb]);
  
  // ─── SOURCE UNIQUE DE VÉRITÉ : `calculations` (props depuis useWeightBalance store) ───
  // Le bloc `manualTotals` recalculait localement les totaux en parallèle de
  // ce que le store fournissait déjà. Supprimé pour éviter les divergences
  // (ex: si un nouveau `loadKey` est ajouté au store, l'ancien manualTotals
  // l'ignorait silencieusement). Les valeurs affichées proviennent maintenant
  // exclusivement de `calculations.{totalWeight,totalMoment,cg}`.
  const totals = useMemo(() => ({
    totalWeight: typeof calculations?.totalWeight === 'number' ? calculations.totalWeight.toFixed(1) : '—',
    totalMoment: typeof calculations?.totalMoment === 'number' ? calculations.totalMoment.toFixed(1) : '—',
    cg:          typeof calculations?.cg === 'number'          ? calculations.cg.toFixed(3)          : '—'
  }), [calculations]);
  
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
            <td style={styles.cell}>Carburant FOB</td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {loads.fuel || 0}
            </td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {wb.fuelArm.toFixed(2)}
            </td>
            <td style={sx.combine(styles.cell, styles.rightAlign, styles.fuelText)}>
              {((loads.fuel || 0) * wb.fuelArm).toFixed(1)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={styles.totalRow}>
            <td style={styles.totalCell}>TOTAL</td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign)}>
              {totals.totalWeight}
            </td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign)}>
              {totals.cg}
            </td>
            <td style={sx.combine(styles.totalCell, styles.rightAlign, styles.totalMoment)}>
              {totals.totalMoment}
            </td>
          </tr>
        </tfoot>
      </table>

      <FormulaInfo cg={totals.cg} totalMoment={totals.totalMoment} totalWeight={totals.totalWeight} />
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
const FormulaInfo = memo(({ cg, totalMoment, totalWeight }) => {
  return (
    <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
      <div>
        <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
          💡 Formule du Centre de Gravité:
        </p>
        <p style={sx.text.sm}>
          CG = Moment total ÷ Masse totale = {totalMoment} ÷ {totalWeight} = {cg} m
        </p>
      </div>
    </div>
  );
});

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