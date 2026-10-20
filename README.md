# zubnikliniky.cz

Katalog zubních ordinací, klinik a dentálních hygien v Moravskoslezském kraji.
Astro (statické stránky) + Supabase (databáze, přihlášení do administrace) + Vercel (hosting a API) + Resend (e-maily).

## Jak to funguje
- Všechny veřejné stránky (města, části Ostravy, obory, detail ordinace) se **generují při buildu** z databáze → rychlé a dobře indexovatelné.
- Formuláře (recenze, poptávka termínu, nahlášení, žádost ordinace) jdou na `/api/*` (serverless funkce na Vercelu).
- Po potvrzení recenze e-mailem nebo po kliknutí na **Zveřejnit změny** v administraci se spustí nový build (Deploy Hook), web se aktualizuje za 1–2 minuty.
- Administrace: `/admin`, přihlášení odkazem z e-mailu. **První přihlášený účet se stane správcem** – přihlas se hned po nasazení.

## Spuštění krok za krokem

### 1. Supabase
1. Na supabase.com založ projekt (region EU – Frankfurt).
2. SQL Editor → vlož obsah `supabase/schema.sql` → Run.
3. Přihlášení do administrace je odkazem z e-mailu (Supabase → Authentication → Providers → Email musí být zapnuté, výchozí stav).
4. Authentication → URL Configuration → Site URL `https://www.zubnikliniky.cz`, do Redirect URLs přidej `https://www.zubnikliniky.cz/admin` a `https://*.vercel.app/admin`.

### 2. Import dat
Nejjednodušší: SQL Editor → New query → vlož obsah `supabase/seed.sql` → Run (nahraje všech 671 ordinací).

Pro budoucí aktualizace z nového CSV:
```bash
npm install
# CSV z Lovable (Cloud → Database → tabulka ordinací → Export CSV) ulož jako data/export.csv
node scripts/import.mjs data/export.csv                 # vytvoří data/clinics.json
node scripts/seed-sql.mjs                               # vytvoří supabase/seed.sql
# nebo rovnou do databáze:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import.mjs data/export.csv --push
```
Skript sám rozpozná sloupce, opraví zobrazované názvy (bez „s.r.o.“, normální velikost písmen u jmen), odvodí všechny obory
(ne jen jeden), části Ostravy podle PSČ a zachová adresy stránek (slug) z Lovable. Při opakovaném importu přepíše jen údaje z registru –
ručně doplněné věci (nové pacienty, pojišťovny, popisy, fotky) zůstanou.

### 3. Resend (e-maily)
resend.com → Domains → přidat `zubnikliniky.cz` → DNS záznamy (SPF/DKIM) zadat u svethostingu → API Keys → vytvořit klíč.

### 4. Vercel
1. vercel.com → Add New Project → import GitHub repozitáře (framework se rozpozná sám: Astro).
2. Settings → Environment Variables → vyplnit vše z `.env.example`.
3. Settings → Git → Deploy Hooks → vytvořit hook (větev `main`) → URL vložit jako `VERCEL_DEPLOY_HOOK_URL` → Redeploy.
4. Settings → Domains → přidat `www.zubnikliniky.cz` a `zubnikliniky.cz` (přesměrování na www). U svethostingu nastavit
   `CNAME www → cname.vercel-dns.com` a `A @ → 76.76.21.21` (přesné hodnoty ukáže Vercel).
5. Otevři `/admin`, zadej svůj e-mail, klikni na odkaz v e-mailu → jsi správce.

## Lokální vývoj
```bash
npm run dev      # bez .env běží na zkušebních datech z data/clinics.json
npm run build
```

## Co kde upravit
- Cena prémiového profilu, kontaktní e-mail, provozovatel: `src/lib/site.ts`
- Obory, pojišťovny, části Ostravy podle PSČ, skloňování měst: `src/lib/taxonomy.mjs`
- Barvy a typografie: `src/styles/global.css`
- Právní texty: `src/pages/podminky.astro`, `src/pages/soukromi.astro` (nech zkontrolovat)
