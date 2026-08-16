// packages/calc-engine/src/perf/abac/trace.ts
//
// TRAÇAGE DU MOTEUR D'ABAQUES — remplace les sorties console (Phase 2, vague 3).
//
// Le moteur de cascade en comptait 141 : elles servaient à suivre pas à pas la
// résolution d'un abaque (quelle courbe, quelle interpolation, quel repli).
// C'est une information PRÉCIEUSE au diagnostic — mais un moteur destiné à
// tourner dans une fonction serveur ne doit rien écrire dans une console qui
// n'existe pas, et un pilote n'a que faire de 141 lignes de journal.
//
// Le traçage devient donc INJECTABLE : silencieux par défaut, branché à la
// demande (atelier de mise au point, tests, journal serveur d'audit).
//
//   import { setAbacTracer } from '@alflight/calc-engine/perf/abac/trace';
//   setAbacTracer((level, args) => console[level](...args));   // en dev

export type AbacTraceLevel = 'log' | 'warn' | 'error';
export type AbacTracer = (level: AbacTraceLevel, args: unknown[]) => void;

let tracer: AbacTracer | null = null;

/** Branche (ou débranche avec null) le traceur du moteur d'abaques. */
export function setAbacTracer(next: AbacTracer | null): void {
  tracer = typeof next === 'function' ? next : null;
}

export function trace(...args: unknown[]): void {
  if (tracer) tracer('log', args);
}

export function traceWarn(...args: unknown[]): void {
  if (tracer) tracer('warn', args);
}

/**
 * Erreur de résolution. Reste un événement tracé — la fonction appelante
 * signale l'échec par sa VALEUR de retour (fail-closed), jamais par un effet
 * de bord : c'est ce qui permet au même code de tourner côté serveur.
 */
export function traceError(...args: unknown[]): void {
  if (tracer) tracer('error', args);
}
