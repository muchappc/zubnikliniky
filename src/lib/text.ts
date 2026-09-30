import type { Clinic } from './data';
import { plural } from './taxonomy.mjs';

// Krátký souhrn s čísly pro úvod stránky města / obvodu / oboru.
export function summary(list: Clinic[], where: string) {
  const n = list.length;
  const zub = list.filter((c) => c.categories.includes('zubar')).length;
  const hyg = list.filter((c) => c.categories.includes('dentalni-hygiena')).length;
  const orto = list.filter((c) => c.categories.includes('ortodoncie')).length;
  const yes = list.filter((c) => c.accepts_new === 'ano').length;
  const lim = list.filter((c) => c.accepts_new === 'omezene').length;
  const known = list.filter((c) => c.accepts_new).length;
  const parts: string[] = [];
  parts.push(`${where[0].toUpperCase() + where.slice(1)} evidujeme ${n} ${plural(n, 'ordinaci', 'ordinace', 'ordinací')}`);
  const sub: string[] = [];
  if (zub) sub.push(`${zub} ${plural(zub, 'zubního lékaře', 'zubní lékaře', 'zubních lékařů')}`);
  if (hyg) sub.push(`${hyg} ${plural(hyg, 'dentální hygienu', 'dentální hygieny', 'dentálních hygien')}`);
  if (orto) sub.push(`${orto} ${plural(orto, 'ortodontistu', 'ortodontisty', 'ortodontistů')}`);
  let s = parts[0] + (sub.length > 1 ? ` – z toho ${sub.join(', ')}.` : '.');
  if (known) {
    s += ` Podle posledních ověřených informací ${yes ? `bere nové pacienty ${yes} ${plural(yes, 'z nich', 'z nich', 'z nich')}` : 'zde zatím žádná ordinace nové pacienty nebere'}${lim ? ` a omezeně je bere ještě ${lim} ${plural(lim, 'další', 'další', 'dalších')}` : ''}.`;
  } else {
    s += ' Informace o přijímání nových pacientů tu zatím doplňujeme – pokud víte, kdo bere, napište nám.';
  }
  return s;
}
