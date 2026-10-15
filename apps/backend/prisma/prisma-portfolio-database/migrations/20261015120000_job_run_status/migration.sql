-- AlterTable
ALTER TABLE "job_leases" ADD COLUMN     "last_duration_ms" INTEGER,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "last_finished_at" TIMESTAMP(3),
ADD COLUMN     "last_ok" BOOLEAN,
ADD COLUMN     "last_started_at" TIMESTAMP(3);
