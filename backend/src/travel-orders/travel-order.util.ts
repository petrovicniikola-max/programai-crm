const ONES_F = ['', 'jedna', 'dve', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet'];
const ONES_M = ['', 'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet'];
const TEENS = [
  'deset',
  'jedanaest',
  'dvanaest',
  'trinaest',
  'četrnaest',
  'petnaest',
  'šesnaest',
  'sedamnaest',
  'osamnaest',
  'devetnaest',
];
const TENS = ['', '', 'dvadeset', 'trideset', 'četrdeset', 'pedeset', 'šezdeset', 'sedamdeset', 'osamdeset', 'devedeset'];
const HUNDREDS = ['', 'sto', 'dvesta', 'trista', 'četiristo', 'petsto', 'šeststo', 'sedamsto', 'osamsto', 'devetsto'];

function under100(n: number, feminine: boolean): string {
  if (n < 10) return (feminine ? ONES_F : ONES_M)[n];
  if (n < 20) return TEENS[n - 10];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  const ones = (feminine ? ONES_F : ONES_M)[one];
  return ones ? `${TENS[ten]} ${ones}` : TENS[ten];
}

function under1000(n: number, feminine: boolean): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[h];
  const tail = rest ? under100(rest, feminine) : '';
  return [head, tail].filter(Boolean).join(' ');
}

function hiljada(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'hiljada';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'hiljade';
  return 'hiljada';
}

/** Ceo iznos u dinarima, npr. 12800 → "Dvanaest hiljada i osamsto". */
export function amountInWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Nula';
  if (n < 0 || n > 999_999) return String(n);

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (thousands) {
    const words = under1000(thousands, true);
    parts.push(`${words} ${hiljada(thousands)}`.replace(/\s+/g, ' ').trim());
  }
  if (rest) parts.push(under1000(rest, false));
  const phrase = parts.join(' i ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function inclusiveDays(startIso: string, endIso: string): number {
  const [ys, ms, ds] = startIso.slice(0, 10).split('-').map(Number);
  const [ye, me, de] = endIso.slice(0, 10).split('-').map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatSrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
