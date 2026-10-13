-- Antes de crear los índices únicos se eliminan los duplicados que pudo
-- dejar la carrera de leer-y-después-insertar (ver
-- docs/REVISION_ACID_MODULOS.md, M5).

-- Dispositivos: se conserva el visto más recientemente por (usuario, token).
DELETE FROM "devices" d
USING "devices" newer
WHERE d."user_ID" = newer."user_ID"
  AND d."push_token" = newer."push_token"
  AND (d."last_seen_at", d."id") < (newer."last_seen_at", newer."id");

-- Ajustes: no tienen fecha; se conserva una fila por usuario (la de mayor id).
DELETE FROM "user_settings" s
USING "user_settings" other
WHERE s."user_ID" = other."user_ID"
  AND s."id" < other."id";

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_ID_push_token_key" ON "devices"("user_ID", "push_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_ID_key" ON "user_settings"("user_ID");
