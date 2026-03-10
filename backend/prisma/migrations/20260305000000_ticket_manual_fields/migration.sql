-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "reportedBy" TEXT,
ADD COLUMN     "putIAngazovanje" JSONB,
ADD COLUMN     "tokPrijave" TEXT,
ADD COLUMN     "zakljucak" TEXT,
ADD COLUMN     "potpisOvlascenogLica" TEXT,
ADD COLUMN     "ticketDate" TIMESTAMP(3);
