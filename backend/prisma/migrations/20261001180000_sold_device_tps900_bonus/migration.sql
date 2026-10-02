-- TPS900 je poznata licenca: bonus 1200 dinara za jedan mesec.

UPDATE "SoldDevice"
SET "bonusAmount" = 1200
WHERE lower(btrim("licenceName")) = 'tps900';
