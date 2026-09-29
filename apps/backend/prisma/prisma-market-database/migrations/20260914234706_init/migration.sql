-- CreateTable
CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "whitepaper" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_networks" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "explorer_url" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_networks" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "contract_address" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_markets" (
    "id" UUID NOT NULL,
    "exchange_id" UUID NOT NULL,
    "trading_pair_id" UUID NOT NULL,
    "market_type_id" UUID NOT NULL,
    "exchange_symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_pairs" (
    "id" UUID NOT NULL,
    "base_asset_id" UUID NOT NULL,
    "quote_asset_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_tickers" (
    "id" UUID NOT NULL,
    "exchange_market_id" UUID NOT NULL,
    "last_price" DECIMAL(65,30) NOT NULL,
    "bid" DECIMAL(65,30) NOT NULL,
    "ask" DECIMAL(65,30) NOT NULL,
    "high_24h" DECIMAL(65,30) NOT NULL,
    "low_24h" DECIMAL(65,30) NOT NULL,
    "volume_base" DECIMAL(65,30) NOT NULL,
    "volume_quote" DECIMAL(65,30) NOT NULL,
    "price_change" DECIMAL(65,30) NOT NULL,
    "price_change_percent" DECIMAL(65,30) NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_tickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_statistics" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "market_cap" DECIMAL(65,30) NOT NULL,
    "circulating_supply" DECIMAL(65,30) NOT NULL,
    "total_supply" DECIMAL(65,30) NOT NULL,
    "max_supply" DECIMAL(65,30) NOT NULL,
    "market_rank" INTEGER NOT NULL,
    "ath" DECIMAL(65,30) NOT NULL,
    "ath_date" TIMESTAMP(3) NOT NULL,
    "atl" DECIMAL(65,30) NOT NULL,
    "atl_date" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_market_history" (
    "id" UUID NOT NULL,
    "exchange_market_id" UUID NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" DECIMAL(65,30) NOT NULL,
    "recorded_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_market_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tag_relations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "asset_tag_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_news" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_assets" (
    "id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,

    CONSTRAINT "news_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_market_rules" (
    "id" UUID NOT NULL,
    "exchange_market_id" UUID NOT NULL,
    "min_qty" DECIMAL(65,30) NOT NULL,
    "max_qty" DECIMAL(65,30) NOT NULL,
    "step_size" DECIMAL(65,30) NOT NULL,
    "min_price" DECIMAL(65,30) NOT NULL,
    "tick_size" DECIMAL(65,30) NOT NULL,
    "min_notional" DECIMAL(65,30) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_market_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_name_key" ON "asset_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_key" ON "assets"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "assets_slug_key" ON "assets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_networks_name_key" ON "blockchain_networks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_networks_network_id_asset_id_key" ON "asset_networks"("network_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_name_key" ON "exchanges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_slug_key" ON "exchanges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "market_types_name_key" ON "market_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_markets_exchange_id_trading_pair_id_market_type_id_key" ON "exchange_markets"("exchange_id", "trading_pair_id", "market_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "trading_pairs_base_asset_id_quote_asset_id_key" ON "trading_pairs"("base_asset_id", "quote_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_tickers_exchange_market_id_key" ON "market_tickers"("exchange_market_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_statistics_asset_id_key" ON "market_statistics"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_market_history_exchange_market_id_recorded_date_key" ON "daily_market_history"("exchange_market_id", "recorded_date");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tags_name_key" ON "asset_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tag_relations_asset_id_tag_id_key" ON "asset_tag_relations"("asset_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_assets_news_id_asset_id_key" ON "news_assets"("news_id", "asset_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_networks" ADD CONSTRAINT "asset_networks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_networks" ADD CONSTRAINT "asset_networks_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_markets" ADD CONSTRAINT "exchange_markets_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_markets" ADD CONSTRAINT "exchange_markets_market_type_id_fkey" FOREIGN KEY ("market_type_id") REFERENCES "market_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_markets" ADD CONSTRAINT "exchange_markets_trading_pair_id_fkey" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "trading_pairs_base_asset_id_fkey" FOREIGN KEY ("base_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "trading_pairs_quote_asset_id_fkey" FOREIGN KEY ("quote_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_tickers" ADD CONSTRAINT "market_tickers_exchange_market_id_fkey" FOREIGN KEY ("exchange_market_id") REFERENCES "exchange_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_statistics" ADD CONSTRAINT "market_statistics_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_market_history" ADD CONSTRAINT "daily_market_history_exchange_market_id_fkey" FOREIGN KEY ("exchange_market_id") REFERENCES "exchange_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tag_relations" ADD CONSTRAINT "asset_tag_relations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tag_relations" ADD CONSTRAINT "asset_tag_relations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "asset_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "market_news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_market_rules" ADD CONSTRAINT "exchange_market_rules_exchange_market_id_fkey" FOREIGN KEY ("exchange_market_id") REFERENCES "exchange_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
