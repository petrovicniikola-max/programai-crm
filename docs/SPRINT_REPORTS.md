# Sprint: Modul Izveštaji (Reports)

## Cilj
Novi modul **Reports** u levom meniju, sa pod-stranicama za pregled brojki i izvoz podataka (tickets, licences, devices, companies).

---

## 1. Meni i struktura

- U levom meniju dodati stavku **Reports** (između Tables i Settings, ili kako odlučiš).
- Klik na Reports vodi na `/reports` (redirect na `/reports/overview`).
- Unutar Reports: pod-navigacija (tabs ili sidebar) – **Overview**, **Tickets**, **Licences**, **Devices**.

---

## 2. Overview (pregled)

- **Backend:** `GET /reports/overview`  
  Vraća agregirane brojke za tenant:
  - `ticketsByStatus`: `{ OPEN, IN_PROGRESS, DONE }`
  - `ticketsByType`: `{ CALL, SUPPORT, SALES, FIELD, OTHER }` (opciono)
  - `activeDevices`, `activeLicences`
  - `expiringLicences`: `{ 30, 14, 7, 1 }` (broj licenci koje ističu u narednih N dana)
  - `companiesCount`
- **Frontend:** stranica `/reports/overview` – kartice sa ovim brojkama (slično dashboard widgetima, ali sve na jednom mestu). Bez posebnog exporta (samo pregled).

---

## 3. Tickets report

- **Backend:** koristi postojeći `GET /tickets` sa query parametrima (status, type, companyId, assigneeId, period od–do). Opciono: `GET /reports/tickets/csv` koji vraća CSV (ili koristi postojeći export iz settings ako postoji).
- **Frontend:** stranica `/reports/tickets` – filteri (period, status, type, company, assignee), tabela sa rezultatima (poziv na `GET /tickets`), dugme **Export CSV** (preuzimanje CSV-a).

---

## 4. Licences report

- **Backend:** koristi postojeći `GET /licences` (+ filteri). Opciono: `GET /reports/licences/csv` ili koristi `GET /licences/export`.
- **Frontend:** stranica `/reports/licences` – filteri (company, status, expiring 30/14/7/1), tabela, **Export CSV**.

---

## 5. Devices report

- **Backend:** koristi `GET /devices` (+ filteri). Opciono: `GET /reports/devices/csv` ili `GET /devices/export`.
- **Frontend:** stranica `/reports/devices` – filteri (company, status), tabela, **Export CSV**.

---

## 6. Tehnički redosled

1. Backend: kreirati `ReportsModule`, `ReportsService`, `ReportsController`; endpoint `GET /reports/overview`.
2. Frontend: u meniju dodati link **Reports**; kreirati `app/(app)/reports/layout.tsx` (sa pod-nav: Overview, Tickets, Licences, Devices) i `app/(app)/reports/overview/page.tsx` (kartice).
3. Frontend: stranice `/reports/tickets`, `/reports/licences`, `/reports/devices` – filteri + tabela (poziv na postojeće API-je) + dugme Export (poziv na postojeće export endpoint-e).
4. Opciono: posebni CSV endpoint-i pod `/reports/...` ako želiš jednu “reports” prefiks rutu; inače frontend može da koristi `/tickets`, `/licences/export`, `/devices/export` direktno.

---

## 7. Dozvole

- Reports: svi ulogovani (ili ograničiti na SUPER_ADMIN / SUPPORT – po želji). Za početak: isti pristup kao za Dashboard (svi koji vide meni).
