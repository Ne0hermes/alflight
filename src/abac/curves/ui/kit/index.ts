/**
 * Kit visuel de l'atelier abaques (Lot 1-B) — point d'entrée unique.
 * Les écrans de l'atelier importent depuis './kit' et RIEN d'autre.
 */
export { SPACING, FONT, RADIUS, CONTROL_HEIGHT, TONE } from './tokens';
export type { ToneName } from './tokens';

export { KitButton } from './KitButton';
export type { KitButtonProps, KitButtonLevel, KitButtonSize } from './KitButton';

export { KitBadge } from './KitBadge';
export type { KitBadgeProps, KitBadgeTone } from './KitBadge';

export { KitPanel } from './KitPanel';
export type { KitPanelProps } from './KitPanel';

export { ModeBanner } from './ModeBanner';
export type { ModeBannerProps } from './ModeBanner';

export { ChecklistRail } from './ChecklistRail';
export type { ChecklistRailProps, ChecklistStep, ChecklistStepState } from './ChecklistRail';
