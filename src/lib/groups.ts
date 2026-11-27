// Facebookové skupiny „Hledám zubaře" po krajích (zdroj: linktr.ee/hledamzubare).
export interface Group { name: string; url: string; kraj: string; members?: string }
export const GROUPS: Group[] = [
  { name: 'Hledám zubaře Ostrava a okolí', url: 'https://www.facebook.com/groups/hledamzubare', kraj: 'Moravskoslezský kraj', members: 'přes 34 000' },
  { name: 'Hledám Zubaře Praha', url: 'https://www.facebook.com/groups/2409787336006478', kraj: 'Hlavní město Praha' },
  { name: 'Hledám zubaře ve Středočeském kraji', url: 'https://www.facebook.com/groups/1178499447649939', kraj: 'Středočeský kraj' },
  { name: 'Hledám zubaře v Jihočeském kraji', url: 'https://www.facebook.com/groups/1153429756575076', kraj: 'Jihočeský kraj' },
  { name: 'Hledám zubaře v Jihomoravském kraji', url: 'https://www.facebook.com/groups/1042938844698926', kraj: 'Jihomoravský kraj' },
  { name: 'Hledám zubaře v Plzeňském kraji', url: 'https://www.facebook.com/groups/715279431427040', kraj: 'Plzeňský kraj' },
  { name: 'Hledám zubaře v Ústeckém kraji', url: 'https://www.facebook.com/groups/1929179894514353', kraj: 'Ústecký kraj' },
  { name: 'Hledám zubaře v Královéhradeckém kraji', url: 'https://www.facebook.com/groups/1422460315455444', kraj: 'Královéhradecký kraj' },
  { name: 'Hledám zubaře v Pardubickém kraji', url: 'https://www.facebook.com/groups/1633479730669115', kraj: 'Pardubický kraj' },
  { name: 'Hledám zubaře v Libereckém kraji', url: 'https://www.facebook.com/groups/1924588168376310', kraj: 'Liberecký kraj' },
  { name: 'Hledám zubaře v kraji Vysočina', url: 'https://www.facebook.com/groups/1864287444469758', kraj: 'Kraj Vysočina' },
  { name: 'Hledám zubaře v Olomouckém kraji', url: 'https://www.facebook.com/groups/689571717325189', kraj: 'Olomoucký kraj' },
  { name: 'Hledám zubaře v Karlovarském kraji', url: 'https://www.facebook.com/groups/1117349163573778', kraj: 'Karlovarský kraj' },
  { name: 'Hledám zubaře ve Zlínském kraji', url: 'https://www.facebook.com/groups/832553079787499', kraj: 'Zlínský kraj' },
];
export const GROUP_BY_KRAJ: Record<string, Group> = Object.fromEntries(GROUPS.map((g) => [g.kraj, g]));
