// src/abac/curves/ui/GraphIdentityPanel.tsx
//
// R6 — Identité d'un graphique d'abaque : rôle dans le set (primaire /
// intermédiaire), opération canonique (operationId) et nature de sortie.
// Extrait de la sous-étape 1 du wizard car cette sous-étape est masquée quand
// l'atelier « image unique » est actif — l'identité doit rester accessible :
// sans operationId sur le primaire, le set n'est PAS consommé par la
// préparation de vol (verrou de handleExportJSON).
// R9 — version COMPACTE (demande pilote) : sans icônes, descriptions en
// infobulles, lignes denses. Monté par le builder dans une zone repliable
// AU-DESSUS de l'atelier (et par la sous-étape 1 du flux legacy).

import React from 'react';
import { GraphConfig } from '../core/types';
import { getOperation } from '../core/operationCatalog';
import { getAxisVariable, getAxisVariablesGroupedFor, isWindAxisVariable } from '../core/axisVariables';
// R23 — le classifieur 3-listes (Phase/Métrique/Volets) est extrait en
// composant partagé, réutilisé aussi par l'extraction MANEX par tableau.
import { OperationClassifier } from './OperationClassifier';

interface GraphIdentityPanelProps {
  graph: GraphConfig;
  onUpdateGraph: (partial: Partial<GraphConfig>) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12, borderRadius: 3,
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap'
};

export const GraphIdentityPanel: React.FC<GraphIdentityPanelProps> = ({ graph, onUpdateGraph }) => {
  const isPrimary = (graph.role || 'primary') === 'primary';
  const op = graph.operationId ? getOperation(graph.operationId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      {/* Rôle — ligne unique, descriptions en infobulle */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={labelStyle}>Rôle</span>
        <label
          title="Produit la valeur finale du set. Reçoit l'output du dernier intermédiaire et donne le résultat final."
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            color: isPrimary ? 'var(--status-success)' : 'var(--text-primary)', fontWeight: isPrimary ? 600 : 400
          }}
        >
          <input
            type="radio"
            name={`role-${graph.id}`}
            checked={isPrimary}
            onChange={() => onUpdateGraph({ role: 'primary', cascadeOrder: undefined })}
          />
          Primaire — valeur finale
        </label>
        <label
          title="Étape de correction (température, masse, vent…). Son output alimente le tableau suivant dans la cascade."
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            color: !isPrimary ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: !isPrimary ? 600 : 400
          }}
        >
          <input
            type="radio"
            name={`role-${graph.id}`}
            checked={!isPrimary}
            onChange={() => onUpdateGraph({ role: 'intermediate', operationId: undefined, outputKind: undefined, outputUnit: undefined })}
          />
          Intermédiaire — correction
        </label>
        {/* (Lot 0 : le select « Position dans la cascade » a été retiré — réglage
            jamais lu par le moteur actif, la chaîne réelle suit l'ordre des
            cadres. `cascadeOrder` reste dans le type/les données : l'adaptateur
            s'en sert en repli compat pour les vieux modèles sans liens.) */}
      </div>

      {/* R16b — variable de FAMILLE des courbes : le paramètre qui distingue
          les courbes de CE graphe (altitude pression, masse, vent…). La
          déclarer débloque la saisie de la VALEUR par courbe dans le
          gestionnaire — le moteur lit alors cette valeur structurée au lieu
          d'interpréter les NOMS de courbes (source d'erreurs silencieuses). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={labelStyle}
          title="Le paramètre qui distingue les courbes entre elles (ex. altitude pression pour le panneau températures). Une fois choisie, chaque courbe porte sa valeur — le nom n'est plus qu'un libellé."
        >
          Variable de famille des courbes
        </span>
        <select
          value={graph.familyAxisVariable || ''}
          onChange={(e) => {
            const varId = e.target.value || undefined;
            // Famille vent → active isWindRelated (débloque les tags face /
            // arrière des courbes) ; jamais désactivé automatiquement.
            onUpdateGraph({
              familyAxisVariable: varId,
              ...(isWindAxisVariable(varId) && !graph.isWindRelated ? { isWindRelated: true } : {})
            });
          }}
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        >
          <option value="">— héritée des noms de courbes (fragile) —</option>
          {getAxisVariablesGroupedFor('x').map(g => (
            <optgroup key={g.category} label={g.label}>
              {g.items.map(v => (
                <option key={v.id} value={v.id}>{v.label}{v.defaultUnit ? ` (${v.defaultUnit})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {(() => {
          const fam = getAxisVariable(graph.familyAxisVariable);
          return fam?.defaultUnit
            ? <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>unité : {fam.defaultUnit}</span>
            : null;
        })()}
      </div>

      {/* Lecture descendante (planches d'atterrissage Piper) : le résultat du
          dernier cadre se lit sur l'axe X, en bas. Intermédiaires seulement. */}
      {!isPrimary && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={labelStyle}
            title="Standard : la sortie se lit sur l'axe Y (échelle verticale). Lecture descendante : on entre avec le Y transféré, on suit le guide de la famille (ex. vent), et le résultat se lit sur l'échelle du bas (axe X). Uniquement pour le DERNIER cadre de la chaîne."
          >
            Lecture du résultat
          </span>
          <select
            value={graph.readoutAxis === 'x' ? 'x' : ''}
            onChange={(e) => onUpdateGraph({ readoutAxis: e.target.value === 'x' ? 'x' : undefined })}
            style={selectStyle}
          >
            <option value="">Sur l'axe Y (standard)</option>
            <option value="x">Sur l'axe X, en bas (descendante)</option>
          </select>
        </div>
      )}

      {/* Si PRIMAIRE : opération canonique — R23 : classifieur PARTAGÉ (3 listes
          Phase / Métrique / Volets) réutilisé à l'identique par l'extraction
          MANEX par tableau (classification unifiée). */}
      {isPrimary && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <OperationClassifier
            showLabel
            value={graph.operationId || ''}
            onChange={(opId) => {
              const op = getOperation(opId);
              const onlyOutput = op && op.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
              onUpdateGraph({
                operationId: opId,
                ...(onlyOutput ? { outputKind: onlyOutput.kind, outputUnit: onlyOutput.defaultUnit } : {})
              });
            }}
          />
        </div>
      )}

      {isPrimary && graph.operationId && !op && (
        <div style={{ fontSize: 11, color: 'var(--color-red-critical)', fontWeight: 600 }}>
          operationId inconnu — vérifier le catalogue
        </div>
      )}
      {isPrimary && op && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }} title={op.description || undefined}>
          ID : <code>{op.id}</code> · Phase : {op.phase}
          {op.configuration?.flaps && ` · Flaps : ${op.configuration.flaps}`}
        </div>
      )}

      {/* Si PRIMAIRE : nature de sortie quand plusieurs acceptées (climb_takeoff/climb_cruise) */}
      {isPrimary && op && op.acceptedOutputs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={labelStyle} title="Que mesure exactement CET abaque ?">Sortie mesurée</span>
          <select
            value={graph.outputKind || ''}
            onChange={(e) => {
              const newKind = e.target.value;
              const spec = op.acceptedOutputs.find(o => o.kind === newKind);
              onUpdateGraph({
                outputKind: newKind,
                outputUnit: spec?.defaultUnit ?? graph.outputUnit
              });
            }}
            style={{ ...selectStyle, flex: 1, minWidth: 200 }}
          >
            <option value="">— Choisir la nature de sortie —</option>
            {op.acceptedOutputs.map(o => (
              <option key={o.kind} value={o.kind}>
                {o.labelFr} ({o.defaultUnit}{o.alternateUnits?.length ? `, ${o.alternateUnits.join(', ')}` : ''})
              </option>
            ))}
          </select>
          {graph.outputKind && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              produit <strong>{graph.outputKind}</strong> en <strong>{graph.outputUnit}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
