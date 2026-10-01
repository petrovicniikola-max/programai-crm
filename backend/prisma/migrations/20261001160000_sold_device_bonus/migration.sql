-- Bonus za tehničku grupu: jedan mesec licence po unetom uređaju.

ALTER TABLE "SoldDevice" ADD COLUMN "bonusAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "SoldDevice"
SET "bonusAmount" = CASE lower(btrim("licenceName"))
  WHEN 'pc' THEN 1200
  WHEN 'cloud middleware' THEN 2400
  WHEN 'android phone/tablet' THEN 1200
  WHEN 'android' THEN 1200
  WHEN 'fiscal box' THEN 2400
  ELSE 0
END;
