# Produkcija: dodavanje kolona + baseline migracija

Kad baza nije vodjena kroz Prisma migracije, Prisma vraća P3005. Rešenje: ručno dodati kolone, pa označiti sve migracije kao primenjene (baseline).

---

## Korak 1 – Dodaj kolone u tabelu Ticket (na serveru)

```bash
docker exec -i programai_postgres psql -U programai -d programai -c 'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactMethod" TEXT;'
docker exec -i programai_postgres psql -U programai -d programai -c 'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactsContactedCount" INTEGER;'
```

---

## Korak 2 – Označi sve migracije kao primenjene (baseline)

Pokreni redom (jednu po jednu ili ceo blok):

```bash
docker exec programai_backend npx prisma migrate resolve --applied "20260304005539_init"
docker exec programai_backend npx prisma migrate resolve --applied "20260304012218_add_company_fields"
docker exec programai_backend npx prisma migrate resolve --applied "20260304012839_contact_phone_raw_primary"
docker exec programai_backend npx prisma migrate resolve --applied "20260304013614_ticket_quick_call_fields"
docker exec programai_backend npx prisma migrate resolve --applied "20260304014435_add_call_fields_to_ticket"
docker exec programai_backend npx prisma migrate resolve --applied "20260304015201_ticket_extras"
docker exec programai_backend npx prisma migrate resolve --applied "20260304022038_forms_module"
docker exec programai_backend npx prisma migrate resolve --applied "20260304032454_ticket_created_by"
docker exec programai_backend npx prisma migrate resolve --applied "20260304041831_licences_devices_alerts"
docker exec programai_backend npx prisma migrate resolve --applied "20260304071042_b2b_platform_onboarding_security"
docker exec programai_backend npx prisma migrate resolve --applied "20260304020000_settings_full"
docker exec programai_backend npx prisma migrate resolve --applied "20260304080000_add_display_keys"
docker exec programai_backend npx prisma migrate resolve --applied "20260304080001_add_email_provider_password"
docker exec programai_backend npx prisma migrate resolve --applied "20260305000000_ticket_manual_fields"
docker exec programai_backend npx prisma migrate resolve --applied "20260305013000_user_licence_alert_flag"
docker exec programai_backend npx prisma migrate resolve --applied "20260310000000_alerts_report_schedule"
docker exec programai_backend npx prisma migrate resolve --applied "20260311000000_add_report_email_configs"
docker exec programai_backend npx prisma migrate resolve --applied "20260315000000_ticket_contact_method_and_count"
```

---

## Korak 3 – Provera

```bash
docker exec programai_backend npx prisma migrate deploy
```

Očekivano: "No pending migrations." ili slično. Aplikacija bi sada trebalo da radi.
