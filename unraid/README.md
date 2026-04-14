# Unraid: Questarr More aus dem Git-Projekt

## Ein Klick: Update im Docker-UI (Standard)

Das Template **`questarr-more.xml`** nutzt das fertige Image **`ghcr.io/futureman0/questarr-more:latest`**. Bei jedem Push auf den Branch **`main`** baut GitHub Actions das Image neu und überschreibt den Tag **`latest`**.

**Auf Unraid:** **Docker** → Container **Questarr-More** → **Aktualisieren** / **Update** (oder im Kontextmenü **Update**). Unraid zieht dann das neue Image und startet den Container neu — **ohne** Terminal und **ohne** lokales `docker build`.

- **Öffentliches Repo / öffentliches GHCR-Paket:** meist reicht das so.
- **Privates GitHub-Paket:** einmalig auf dem Unraid-Terminal `docker login ghcr.io` (Personal Access Token mit `read:packages` als Passwort).

Wenn du stattdessen **lokal aus Git** bauen willst, siehe unten **„Lokales Image (`questarr-more:local`)“** und **Variante A — Docker Compose**.

---

## Lokales Image (`questarr-more:local`)

Nur nötig, wenn du **kein** GHCR-Image verwendest und das Image selbst baust. Unraid meldet sonst z. B. `No such image: questarr-more:local`.

**Einmalig auf dem Unraid-Terminal oder per SSH:**

Der Ordner `/mnt/user/docker` existiert auf Unraid nicht von selbst — anlegen oder einen anderen Pfad nutzen (z. B. `/mnt/user/appdata`).

```bash
mkdir -p /mnt/user/docker
cd /mnt/user/docker
git clone https://github.com/FutureMan0/Questarr-More.git questarr-more
cd questarr-more
docker build -t questarr-more:local .
```

**Alternativ** (ohne `docker`-Ordner): `cd ~` — nach dem Fehlversuch mit `cd /mnt/user/docker` landet das Repo oft in `~/questarr-more`; dort einfach `docker build -t questarr-more:local .` ausführen.

Nach `git pull` zur Aktualisierung: erneut `docker build -t questarr-more:local .` (damit u. a. `package-lock.json` und der Build stimmen).

Prüfen:

```bash
docker images | grep questarr-more
# questarr-more   local   …
```

Im Docker-UI dann im Template **`Repository`** auf `questarr-more:local` stellen (oder eigenes Compose nutzen).

Ohne manuellen Build: **`docker compose -f docker-compose.unraid.yml up -d --build`** (baut und startet in einem Schritt).

---

## „Ich sehe das Template in der Liste nicht“

**Normal.** Unraid holt **keine** Templates automatisch von GitHub. Die Dropdown-Liste **User templates** zeigt nur XML-Dateien, die **auf deinem Unraid-Server** liegen (plus ggf. Einträge von Plugins).

So bekommst du **Questarr-More** in die Liste:

### Option 1 — Eine Zeile auf dem Unraid-Terminal (oder SSH)

Ersetze die URL, falls dein Branch/Repo anders heißt:

```bash
mkdir -p /boot/config/plugins/dockerMan/templates-user
curl -fsSL -o /boot/config/plugins/dockerMan/templates-user/questarr-more.xml \
  "https://raw.githubusercontent.com/FutureMan0/Questarr-More/main/unraid/questarr-more.xml"
```

Dann: **Docker** → Seite neu laden (F5) → **Add Container** → unter **User templates** erscheint **Questarr-More** (Name aus dem XML).

### Option 2 — Per SMB (Flash-Share)

1. Am PC: Netzlaufwerk zum Unraid-Share **flash** verbinden.
2. Ordner öffnen: `config\plugins\dockerMan\templates-user\` (falls nicht da: anlegen).
3. Die Datei **`questarr-more.xml`** aus dem Repo dort hineinlegen (oder von GitHub Raw speichern).
4. Unraid **Docker** neu öffnen → **Add Container** → Template **Questarr-More** wählen.

### Option 3 — Ohne Template

Einfach **Variante A (Docker Compose)** unten nutzen — braucht keinen Eintrag in der Template-Liste.

---

Zwei Wege, den Container aus **diesem Repository** zu betreiben.

## Voraussetzungen

- Unraid mit **Docker** aktiviert.
- **Git** auf dem Server (z. B. über _Nerd Tools_ / Terminal) oder Repo per SMB auf die Share kopieren und Pfade anpassen.
- Empfohlener Klon-Pfad: z. B. `/mnt/user/docker/questarr-more` (nur Quellcode; App-Daten liegen getrennt unter `appdata`).

---

## Variante A — Docker Compose (empfohlen, ein Befehl)

1. Repo klonen:

   ```bash
   cd /mnt/user/docker
   git clone https://github.com/DEIN_USER/Questarr-More.git questarr-more
   cd questarr-more
   ```

   (`DEIN_USER/Questarr-More` durch dein echtes Repository ersetzen.)

2. Container bauen und starten:

   ```bash
   docker compose -f docker-compose.unraid.yml up -d --build
   ```

3. Web-UI: `http://<UNRAID-IP>:5000`

**Optional — Pfade/Ports per Umgebung:**

```bash
export QUESTARR_MORE_DATA=/mnt/user/appdata/questarr-more
export QUESTARR_MORE_HTTP_PORT=5000
export QUESTARR_MORE_SSL_PORT=9898
export PUID=1000
export PGID=1000
docker compose -f docker-compose.unraid.yml up -d --build
```

**Update nach `git pull`:**

```bash
cd /mnt/user/docker/questarr-more
git pull
docker compose -f docker-compose.unraid.yml build --no-cache
docker compose -f docker-compose.unraid.yml up -d
```

**Oder ein Skript (manuell oder per Cron):**

```bash
cd /mnt/user/docker/questarr-more
sh scripts/unraid-update.sh
```

---

## Automatisches Update (Push auf `main` → Unraid)

**Einfachste Variante:** Siehe oben **„Ein Klick: Update im Docker-UI“** — GitHub baut bei Push auf `main` das GHCR-Image (**`.github/workflows/publish-ghcr-main.yml`**); auf Unraid reicht **Update** am Container.

**Optional (SSH auf den Server):** Wenn du nach jedem Push stattdessen **direkt auf dem Unraid** `git pull` und **lokal** bauen willst, nutzt das Repo **`.github/workflows/deploy-unraid.yml`**. Er ruft **`scripts/unraid-update.sh`** auf (Git pull, `docker compose build`, `up -d --force-recreate`).

### Voraussetzungen auf Unraid

- Repo wie unter **Variante A** geklont; Pfad merken (z. B. `/mnt/user/docker/questarr-more`).
- **Compose** statt parallelem **Docker-UI-Container** auf denselben Ports — sonst **Port-Konflikt**. Bestehenden UI-Container einmal stoppen/entfernen, wenn du komplett auf Compose umstellst.
- Optional einmal: Upstream setzen, damit `git pull` zuverlässig ist:

  ```bash
  cd /mnt/user/docker/questarr-more
  git branch --set-upstream-to=origin/main main
  ```

### GitHub Secrets (Repository → Settings → Secrets and variables → Actions)

| Secret | Inhalt |
|--------|--------|
| `UNRAID_HOST` | IP oder Hostname (z. B. `10.0.0.121` oder Tailscale-Name) |
| `UNRAID_USER` | z. B. `root` |
| `UNRAID_SSH_KEY` | **Privater** SSH-Key (komplette Datei inkl. `BEGIN`/`END`) |
| `UNRAID_REPO_PATH` | *(optional)* Absoluter Pfad zum Checkout; Standard im Workflow: `/mnt/user/docker/questarr-more` |

**SSH-Key (Beispiel):** Auf dem PC `ssh-keygen -t ed25519 -f ~/.ssh/unraid_questarr_deploy -N ""`, Public Key nach Unraid (`ssh-copy-id` oder manuell in `~/.ssh/authorized_keys`), **privaten** Key als `UNRAID_SSH_KEY` hinterlegen.

**Sicherheit:** SSH für `root` nicht ungeschützt ins offene Internet stellen; **Tailscale/VPN** oder Firewall-Regeln bevorzugen.

**SSH-Port ≠ 22:** In `.github/workflows/deploy-unraid.yml` beim Schritt `appleboy/ssh-action` die Option `port:` ergänzen (siehe Kommentar im Workflow).

### Test

Unter **Actions** den Workflow **Deploy to Unraid** manuell mit **Run workflow** starten (`workflow_dispatch`). Nach erfolgreichem Lauf sollte der Container auf Unraid neu gebaut und neu erstellt sein.

---

## Variante B — Unraid-Template (Docker-UI)

Die Datei **`unraid/questarr-more.xml`** ist ein **Community-Template-kompatibles** XML für _Apps → Docker → Add Container_.

**Standard:** Das Image **`ghcr.io/futureman0/questarr-more:latest`** wird beim ersten Start gezogen; Updates über **Docker → Questarr-More → Update** (nach neuem Build auf `main`).

### Schritt 1: Template installieren (siehe Abschnitt oben)

Die XML muss unter **`/boot/config/plugins/dockerMan/templates-user/questarr-more.xml`** liegen (curl oder SMB). Erst danach erscheint **Questarr-More** unter **User templates**.

### Schritt 2: Container anlegen

1. Docker → **Add Container**
2. **Template** → **Questarr-More** wählen.
3. **Apply** — Unraid lädt **`latest`** von GHCR (bei privatem Paket vorher `docker login ghcr.io`).

### Schritt 3: Pfade prüfen

- **Daten-Pfad** (Standard): `/mnt/user/appdata/questarr-more`
- **PUID/PGID** an deine Shares anpassen (häufig `1000`/`1000` oder Unraid-Standard `99`/`100` — dann müssen Ordnerrechte passen).

Die **Raw-URL** zum erneuten Herunterladen der Vorlage (z. B. nach Änderungen im Repo):

`https://raw.githubusercontent.com/FutureMan0/Questarr-More/main/unraid/questarr-more.xml`

(Einfach erneut mit `curl` nach `templates-user/` schreiben.)

---

## Hinweise

- **SSL**: Port `9898` ist wie beim upstream Questarr vorgesehen; HTTP bleibt Standard `5000`.
- **Offizielles Questarr (ohne „More“):** Template `unraid/questarr.xml` / Image `ghcr.io/doezer/questarr`. **Questarr More** im Docker-UI nutzt **`ghcr.io/futureman0/questarr-more:latest`** (oder bei Bedarf ein **lokales** Image, siehe oben).
- Bei Problemen: Docker-Log des Containers prüfen; bei lokalem Build: `docker compose -f docker-compose.unraid.yml build` erneut ansehen.
