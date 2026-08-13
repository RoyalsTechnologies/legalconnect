/** Ghana cedis stored as integer pesewas so fees never go through floating point. */
export function ghsToPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100;
}

export function formatGhs(pesewas: number): string {
  return `GH₵ ${pesewasToGhs(pesewas).toFixed(2)}`;
}
