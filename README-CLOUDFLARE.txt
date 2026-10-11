LH Budget v7.0 – Cloudflare Pages + D1

Denne version fjerner Supabase-klienten og bruger Cloudflare Pages Functions + D1.

Filer:
- index.html, app.js, styles.css: brugerfladen
- functions/api/[[path]].js: backend/login/database-API
- db-client.js: kompatibilitetslag for eksisterende app-kode
- schema.sql: databaseoprettelse

Cloudflare-konfiguration, når koden er lagt ind i et Pages-projekt:
1. Opret en D1-database med navnet lh-budget-db.
2. Kør schema.sql i D1 Console.
3. I Pages-projektets Settings > Bindings tilføjes D1 database binding:
   Variable name: DB
   Database: lh-budget-db
4. Opret disse runtime environment variables/secrets for Production:
   LH_LOGIN_EMAIL = den e-mail, du vil logge ind med
   LH_LOGIN_PASSWORD = en ny adgangskode til LH Budget
   LH_USER_ID = 791fbb62-09fd-4309-9217-3f633d4764be
5. Genudrul projektet.

VIGTIGT:
- Denne ZIP indeholder app/backend og databaseskema, men IKKE dine private budgetrækker.
- Budgetdata skal importeres til D1 før den nye app kan vise dine eksisterende tal.
- Brug ikke den gamle Supabase-publishable key som adgangskode. Den er ikke nødvendig i Cloudflare-versionen.
