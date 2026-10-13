-- CreateTable
CREATE TABLE "job_leases" (
    "name" TEXT NOT NULL,
    "locked_until" TIMESTAMP(3) NOT NULL,
    "locked_by" TEXT NOT NULL,

    CONSTRAINT "job_leases_pkey" PRIMARY KEY ("name")
);

