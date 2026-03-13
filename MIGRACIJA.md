# Migracije baze – ProgramAI CRM

Sve migracije su u `backend/prisma/migrations/` i spremne za primenu.

## Na novom serveru / praznoj bazi

```bash
cd programai-crm/backend
npx prisma migrate deploy
```

Primeni sve migracije u redosledu.

## Ako baza već postoji (npr. bila je ažurirana sa `db push`)

Ako dobiješ grešku tipa *"The database schema is not empty"*:

1. **Opcija A – označi migracije kao primenjene (baseline)**  
   Jednom na toj bazi:
   ```bash
   cd programai-crm/backend
   npx prisma migrate resolve --applied 20260304005539_init
   npx prisma migrate resolve --applied 20260304012218_add_company_fields
   # ... sve do poslednje:
   npx prisma migrate resolve --applied 20260311000000_add_report_email_configs
   ```
   Zatim za buduće izmene koristi samo `prisma migrate deploy`.

2. **Opcija B – nastavi sa `db push` (bez istorije migracija)**  
   Za brzo usklađivanje šeme bez migracija:
   ```bash
   npx prisma db push
   ```

## Lokalno (razvoj)

- Prva instalacija: `npx prisma migrate deploy` (ili `migrate dev` ako želiš novu bazu).
- Ako koristiš postojeću bazu koju nisi vodio kroz migracije: `npx prisma db push`.

## Generisanje Prisma klijenta

Posle izmene šeme ili povlačenja koda:

```bash
cd programai-crm/backend
npx prisma generate
```
