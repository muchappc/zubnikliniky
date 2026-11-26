// Z právního názvu z registru udělá čitelný zobrazovaný název.
const TITLES = /^(MUDr\.|MDDr\.|Bc\.|Mgr\.|Ing\.|DiS\.|Ph\.D\.|PhDr\.|doc\.|prof\.|MBA|MSc\.|BSc\.|DDS|Dr\.)$/i;
const LEGAL = /[, ]+(s\.\s?r\.\s?o\.|spol\.\s?s\s?r\.\s?o\.|a\.\s?s\.|v\.\s?o\.\s?s\.|z\.\s?ú\.|o\.\s?p\.\s?s\.)\s*$/i;

function titleWord(w) {
  if (TITLES.test(w)) {
    const canon = ['MUDr.', 'MDDr.', 'Bc.', 'Mgr.', 'Ing.', 'DiS.', 'Ph.D.', 'PhDr.', 'doc.', 'prof.', 'MBA', 'MSc.', 'BSc.', 'DDS', 'Dr.'];
    return canon.find((c) => c.toLowerCase() === w.toLowerCase()) ?? w;
  }
  if (w.length < 2 || w !== w.toLocaleUpperCase('cs') || !/\p{L}/u.test(w)) return w;
  return w.split('-').map((p) => p.charAt(0).toLocaleUpperCase('cs') + p.slice(1).toLocaleLowerCase('cs')).join('-');
}

// Z právního názvu udělá čitelný zobrazovaný název.
export function displayName(legal) {
  let s = String(legal || '').replace(/\s+/g, ' ').trim();
  // "..., příspěvková organizace, LPS dos., ..." → uříznout za organizací
  s = s.replace(/,\s*(příspěvková organizace|státní příspěvková organizace).*$/i, '');
  // "Firma s.r.o., praktický lékař stomatolog" → "Firma s.r.o."
  s = s.replace(/,\s*(praktický lékař|zubní lékař|stomatolog|ordinace).*$/i, '');
  s = s.replace(/^(MUDr\.|MDDr\.)(?=[^\s,])/, '$1 ');
  // "Nemocnice X a.s., ambulance" → "Nemocnice X"
  s = s.replace(/[, ]+(s\.\s?r\.\s?o\.|a\.\s?s\.|spol\.\s?s\s?r\.\s?o\.)\s*,.*$/i, '');
  const hadLegal = LEGAL.test(s);
  s = s.replace(LEGAL, '').replace(/,\s*$/, '').trim();
  const words = s.split(' ');
  const hasTitle = words.some((w) => TITLES.test(w));
  const personLike = hasTitle || (!hadLegal && words.length >= 2 && words.length <= 3 && words.every((w) => /^[\p{Lu}][\p{L}-]+$/u.test(w)));
  if (personLike) return words.map(titleWord).join(' ');
  // Celý název velkými písmeny ("DOKTOR ZOUBEK") → "Doktor Zoubek"; smíšené značky (AGEL, koprDENT) necháme.
  const letters = words.filter((w) => /\p{L}{3,}/u.test(w));
  if (letters.length && letters.every((w) => w === w.toLocaleUpperCase('cs'))) {
    return words.map((w) => (/\p{L}{3,}/u.test(w) ? w.split('-').map((p) => p.charAt(0) + p.slice(1).toLocaleLowerCase('cs')).join('-') : w)).join(' ');
  }
  return s;
}

