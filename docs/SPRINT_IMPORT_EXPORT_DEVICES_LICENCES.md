# Sprint: Import / Export – Devices & Licences

## Cilj
Omogućiti uvoz i izvoz uređaja (devices) i licenci u CSV i Excel formatu, sa popup-om za import koji nudi preuzimanje primer fajla sa svim meta poljima.

---

## 1. Export (Devices)

- **Backend:** endpoint `GET /devices/export?format=csv|excel` (ili query `format=csv` / `format=xlsx`).
  - Koristi postojeći filter (companyId, status, search) iz list endpointa.
  - Vraća fajl (Content-Disposition attachment, ime npr. `devices_YYYY-MM-DD.csv` / `.xlsx`).
- **Polja u izvozu (redosled kolona):**
  - `companyId` (ili naziv kompanije ako join-uješ Company)
  - `name`
  - `model`
  - `serialNo`
  - `status` (ACTIVE | INACTIVE | RETIRED)
  - `notes`
  - `createdAt`, `updatedAt` (opciono)
- **Frontend:** dugme "Export" na listi uređaja (dropdown ili dva dugmeta: Export CSV / Export Excel) koje poziva API i skida fajl.

---

## 2. Export (Licences)

- **Backend:** endpoint `GET /licences/export?format=csv|excel` (+ filteri: companyId, status, validFrom, validTo, expiringInDays).
  - Vraća fajl sa svim potrebnim poljima.
- **Polja u izvozu:**
  - `companyId` (ili naziv kompanije)
  - `deviceId` (ili serialNo uređaja – preglednije)
  - `productName`
  - `licenceKey`
  - `validFrom` (ISO datum)
  - `validTo` (ISO datum)
  - `status` (ACTIVE | EXPIRED | SUSPENDED | CANCELLED)
  - `notes`
  - `createdAt`, `updatedAt` (opciono)
- **Frontend:** dugme "Export" na listi licenci (CSV / Excel).

---

## 3. Import – popup i primer (Devices)

- **Frontend:** Na listi uređaja dugme "Import" koji otvara **popup (modal)**.
  - Naslov: npr. "Uvoz uređaja".
  - Tekst: "Preuzmite primer CSV fajla za uvoz podataka. U fajlu su navedena sva polja koja sistem koristi."
  - Dugme/link: **"Preuzmi primer CSV za uređaje"** → skida statički ili API-generisani primer CSV.
  - Opciono: i "Preuzmi primer Excel" ako podržavaš xlsx.
  - Polje za odabir fajla (file input): CSV i/ili XLSX.
  - Dugme "Uvezi" (šalje fajl na backend).
  - Prikaz grešaka (koja linija, koja kolona, poruka) nakon odgovora od API-ja.
- **Primer CSV (meta polja – zaglavlje):**
  ```text
  companyId,name,model,serialNo,status,notes
  ```
  Jedna primer red sa vrednostima (npr. prazno ili placeholder):
  ```text
  companyId,name,model,serialNo,status,notes
  ,Primer uređaj,Model X,SN001,ACTIVE,Primer napomena
  ```
  **Napomena:** `companyId` mora biti postojeći ID kompanije u tenantu. Opciono možeš dodati kolonu `companyName` za lookup po imenu (backend onda mapira na companyId).
- **Backend:** endpoint `POST /devices/import` (multipart: fajl). Parsiranje CSV/Excel, validacija po redu, kreiranje uređaja (isti pravila kao create – npr. jedinstvenost serialNo po tenantu). Odgovor: `{ created: number, errors: { row: number, message: string }[] }`.

---

## 4. Import – popup i primer (Licences)

- Ista logika kao za Devices:
  - Popup "Uvoz licenci" sa tekstom o preuzimanju primera.
  - "Preuzmi primer CSV za licence".
  - File input + "Uvezi".
- **Primer CSV (zaglavlje i meta polja):**
  ```text
  companyId,deviceId,productName,licenceKey,validFrom,validTo,status,notes
  ```
  Primer red:
  ```text
  companyId,deviceId,productName,licenceKey,validFrom,validTo,status,notes
  <company-id>,,Program XY,,2025-01-01,2026-01-01,ACTIVE,
  ```
  `companyId` obavezan; `deviceId` opciono (može biti CUID uređaja ili, ako implementiraš, serialNo za lookup). Datumi u ISO formatu (YYYY-MM-DD ili full ISO).
- **Backend:** `POST /licences/import` (multipart). Validacija (companyId postoji, validTo datum, status iz enum-a), kreiranje licenci, event CREATED po potrebi. Odgovor: `{ created: number, errors: { row: number, message: string }[] }`.

---

## 5. Tehnički detalji

| Stavka | Predlog |
|--------|--------|
| **Backend – parsiranje** | CSV: `csv-parse` ili ugrađeno čitanje; Excel: `xlsx` ili `exceljs`. |
| **Backend – generisanje primera** | Opciono: `GET /devices/import/template` i `GET /licences/import/template` koji vraćaju CSV (ili čak xlsx) sa zaglavljem i jednim primer redom – tada "Preuzmi primer" samo poziva taj endpoint. |
| **Mapiranje company/device** | Za jednostavnost prve faze: CSV koristi `companyId` i `deviceId` (CUID). Kasnije: kolone `companyName` / `deviceSerialNo` i lookup u bazi. |
| **Role** | Isti kao za create: SUPER_ADMIN, SUPPORT (import/export za devices i licences). |
| **Limit** | Ograničenje broja redova pri importu (npr. max 500 ili 1000) da ne preoptereti server. |

---

## 6. Redosled taskova (sprint backlog)

1. **Export Devices** – backend endpoint + frontend dugme (CSV dovoljno za start).
2. **Export Licences** – isto (CSV).
3. **Import Devices – backend** – POST /devices/import, parsiranje CSV (pa kasnije Excel), validacija, bulk create, povratna lista grešaka.
4. **Import Devices – frontend** – popup, "Preuzmi primer CSV", file input, poziv API-ja, prikaz grešaka.
5. **Import Licences – backend** – POST /licences/import, isto kao devices.
6. **Import Licences – frontend** – popup kao za devices.
7. **(Opciono)** Excel podrška za export (xlsx) – devices + licences.
8. **(Opciono)** Excel podrška za import – oba entiteta.
9. **(Opciono)** Template endpoint-i za primer fajla (GET .../import/template) da zaglavlje uvek odgovara backendu.

---

## 7. Primer CSV zaglavlja (za dokumentaciju i template)

**Devices – sva meta polja:**
```csv
companyId,name,model,serialNo,status,notes
```
- `status`: ACTIVE | INACTIVE | RETIRED

**Licences – sva meta polja:**
```csv
companyId,deviceId,productName,licenceKey,validFrom,validTo,status,notes
```
- `validFrom` / `validTo`: ISO datum (YYYY-MM-DD).
- `status`: ACTIVE | EXPIRED | SUSPENDED | CANCELLED

Ako želiš, sledeći korak može biti: implementacija prvog taska (Export Devices – backend + frontend) ili generisanje stvarnog primer CSV fajla u repou (npr. u `backend/assets/` ili preko template endpointa).
