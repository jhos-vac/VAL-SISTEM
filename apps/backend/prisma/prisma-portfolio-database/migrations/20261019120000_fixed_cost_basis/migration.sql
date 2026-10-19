-- AlterTable
ALTER TABLE "asset_positions" ADD COLUMN     "cost_fixed_at" TIMESTAMP(3),
ADD COLUMN     "cost_source" TEXT NOT NULL DEFAULT 'manual';

-- Las posiciones de exchange se calcularon con la lógica anterior (precio
-- de mercado en cada sync): el próximo sync las vuelve a valorar con el
-- precio de cada transacción y las deja fijas.
UPDATE "asset_positions" SET "cost_source" = 'legacy'
WHERE "wallet_id" IN (SELECT "id" FROM "wallets" WHERE "wallet_type" = 'exchange');
