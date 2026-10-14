-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN     "copied_from_id" UUID,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "public_alias" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "investment_goals" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'target_value',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "target_percent" DOUBLE PRECISION,
ALTER COLUMN "asset_id" DROP NOT NULL,
ALTER COLUMN "target_price" DROP NOT NULL,
ALTER COLUMN "target_quantity" DROP NOT NULL,
ALTER COLUMN "target_value" DROP NOT NULL,
ALTER COLUMN "deadline" DROP NOT NULL;

-- CreateTable
CREATE TABLE "target_allocations" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "target_percent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "target_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dca_plans" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dca_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "target_allocations_portfolio_id_asset_id_key" ON "target_allocations"("portfolio_id", "asset_id");

-- CreateIndex
CREATE INDEX "dca_plans_portfolio_id_idx" ON "dca_plans"("portfolio_id");

-- CreateIndex
CREATE INDEX "portfolios_is_public_idx" ON "portfolios"("is_public");

-- AddForeignKey
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dca_plans" ADD CONSTRAINT "dca_plans_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

