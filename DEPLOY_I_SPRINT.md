# Plan rada po sprintovima i deploy na produkciju

Cilj: ne menjamo stalno živo na serveru, nego radimo u sprintovima lokalno, testiramo, pa tek onda deployujemo (pull + build + restart).

---

## 1. Gde se radi

| Okruženje | Gde | Namena |
|-----------|-----|--------|
| **Lokal (dev)** | Tvoj PC: `c:\Course\programai-crm` i `programai-frontend` | Razvoj, testiranje pre push-a |
| **Produkcija** | Server: `/opt/programai-crm`, `/opt/programai-frontend` | Samo pull + build + restart, bez ručnog menjanja koda |

Pravilo: **na serveru ne editujemo fajlove ručno** – sve dolazi iz Gita (pull).

---

## 2. Jedan sprint (ciklus)

### Faza 1: Planiranje sprinta
- Odlučiš šta ulazi u sprint (npr. "Sprint 7: izveštaj tiketa po mesecu + filter po tagu").
- Zapisuješ u listu (Notion, Excel, ili `SPRINT_TODO.md` u repou).

### Faza 2: Razvoj lokalno
- Radiš isključivo na svom računaru u `programai-crm` i `programai-frontend`.
- Backend: `cd programai-crm/backend` → `npm run start:dev` (watch mode).
- Frontend: `cd programai-frontend` → `npm run dev`.
- Testiraš u browseru na `http://localhost:3000` (API) i `http://localhost:3001` (frontend, ako je port 3001).

### Faza 3: Završetak sprinta – test
- Prođeš sve što si dodao/menjao (login, tiketi, forme, settings, itd.).
- Ako treba, jednom pokreneš migracije lokalno: `cd backend && npx prisma migrate dev`.
- Kad si siguran da sve radi lokalno → prelaz na deploy.

### Faza 4: Commit i push
Na PC-u, u root-u svakog repoa:

**Backend (programai-crm):**
```powershell
cd c:\Course\programai-crm
git status
git add .
git commit -m "Sprint X: kratki opis (npr. izveštaj po mesecu, filter po tagu)"
git push
```

**Frontend (programai-frontend):**
```powershell
cd c:\Course\programai-frontend
git status
git add .
git commit -m "Sprint X: isto kao backend ili šta si menjao u UI"
git push
```

Ako ima **nove Prisma migracije**, one će biti u `programai-crm/backend/prisma/migrations/` – one idu u commit i na server.

### Faza 5: Deploy na produkciju (server)
SSH na server, pa:

```bash
# Backend
cd /opt/programai-crm
git pull
cd backend
npx prisma migrate deploy    # samo ako ima novih migracija
npm run build
pm2 restart backend

# Frontend (ako si menjao frontend)
cd /opt/programai-frontend
git pull
npm run build
pm2 restart frontend
```

### Faza 6: Brza provera na živo
- Otvoriš https://crm.estuar.rs i proveriš login i glavne stvari.
- Ako nešto pukne: logovi su `pm2 logs backend` i `pm2 logs frontend`; ako treba, rollback: `git checkout HEAD~1` (ili konkretni commit) pa ponovo build i restart (retko).

---

## 3. Kratka checklist pre svakog push-a

- [ ] Lokalno sve radi (backend + frontend).
- [ ] Nema ostavljenih `console.log` / privremenog koda koji ne treba.
- [ ] Ako ima nova polja u bazi: migracija je u `prisma/migrations` i uključena u commit.
- [ ] Commit poruka jasno kaže šta je urađeno (npr. "Sprint 7: izveštaj tiketa, filter po tagu").

---

## 4. Predlog strukture sprintova

Možeš voditi listu u fajlu `SPRINT_TODO.md` u repou, npr.:

```markdown
## Sprint 7 (plan)
- [ ] Izveštaj tiketa po mesecu
- [ ] Filter po tagu na listi tiketa

## Sprint 8 (plan)
- [ ] ...
```

Kad završiš stavku, menjaš `[ ]` u `[x]` i na kraju sprinta radiš jedan commit + push + deploy kao gore.

---

## 5. Rezime komandi (copy-paste)

**Lokalno – posle rada:**
```powershell
cd c:\Course\programai-crm
git add .
git commit -m "Sprint N: opis"
git push

cd c:\Course\programai-frontend
git add .
git commit -m "Sprint N: opis"
git push
```

**Na serveru – deploy:**
```bash
cd /opt/programai-crm && git pull && cd backend && npx prisma migrate deploy && npm run build && pm2 restart backend
cd /opt/programai-frontend && git pull && npm run build && pm2 restart frontend
```

Ovim radom ne diraš živo ništa na serveru osim ovih komandi – sve promene idu kroz Git i sprint ciklus.
