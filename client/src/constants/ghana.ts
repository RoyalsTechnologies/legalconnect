/** Official regions — used in matching as an exact string (FR-011). A select
 *  keeps citizens and lawyers from typing variants that silently fail to match. */
export const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
] as const;

export type GhanaRegion = (typeof GHANA_REGIONS)[number];
