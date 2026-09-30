export const C = {
  bg: '#FFFFFF',
  surface: '#F6F5F2',
  surface2: '#EDECE8',
  surface3: '#E4E3DE',
  ink: '#1B1C1F',
  ink2: '#45474D',
  muted: '#74777F',
  line: '#E2E1DC',
  outline: '#C4C6CC',
  brand: '#E8590C',
  brand2: '#FF8A3D',
  brandSoft: '#FFEADB',
  onBrand: '#6B2600',
  pos: '#C62828',
  posSoft: '#FDE8E7',
  neg: '#138A45',
  negSoft: '#E3F4EA',
  warn: '#B26A00',
  warnSoft: '#FFF1D6',
  black: '#111111',
} as const;

export const R = { card: 16, input: 12, chip: 8, pill: 26 } as const;

export const DRUG_PICKS = [
  { name: 'Cannabis', hex: '#D9541F', preset: 'std' },
  { name: 'Cocaine', hex: '#2B86CC', preset: 'coc' },
  { name: 'Heroin', hex: '#6B2F7D', preset: 'opi' },
  { name: 'Amphet.', hex: '#C2561C', preset: 'opi' },
  { name: 'Methaqualone', hex: '#EDCB1C', preset: 'std' },
  { name: 'Ketamine', hex: '#C0602B', preset: 'opi' },
] as const;
