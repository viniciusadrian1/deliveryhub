-- ===============================================================
-- Entregador do pedido — webhook deliveryStatus (entrega da
-- plataforma) e entrega propria (Self Delivery) do 99Food.
-- ===============================================================

ALTER TABLE "order"
  ADD COLUMN "courier_name"  TEXT,
  ADD COLUMN "courier_phone" TEXT;
