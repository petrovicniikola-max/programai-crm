-- Dodavanje kolona za način kontakta i broj kontaktiranih (odlazni pozivi)
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactMethod" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactsContactedCount" INTEGER;
