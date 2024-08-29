# teamsykmelding-cli

En liten verktøykasse for #team-sykmelding

## Kom i gang

### Oppsett

-   Du må ha [Node.js](https://nodejs.org/en/) installert, husk å bruk verktøy som nvm eller asdf for å håndtere versjoner.
-   Du må ha [bun.sh](https://bun.sh) installert, dette kan installeres med curl (`curl -fsSL https://bun.sh/install | bash`)

### Konfigurasjon

Du må ha en `.npmrc` fil på root i home-mappen din med følgende innhold:

```
@navikt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

### Tilgang

Du må ha en PAT (Personal Access Token) for å kunne laste ned pakker fra Github Package Registry. Denne kan
du lage [her](https://github.com/settings/tokens). Du må gi den `read:packages` scope, bruk PAT typen "classic"

Legg til denne i din `~/.bashrc` eller `~/.zshrc` fil:

```bash
export NPM_AUTH_TOKEN=<din token>
```

### Installer CLI

```bash
npm i -g @navikt/teamsykmelding-cli
```

Nå er du klar til å bruke `tsm`!

### Automatisk generert dokumentasjon

<!-- COMPUTER SAYS DON'T TOUCH THIS START -->

* `doctor` - undefined
* `auth` - undefined
* `commits` - undefined
* `prs` - undefined
* `repos` - undefined
* `builds` - undefined
* `git` - undefined
* `work` - undefined
* `mock` - undefined
* `team` - undefined
* `sync-file` - undefined
* `sync-cmd` - undefined
* `primary-branch` - undefined
* `mob` - undefined
* `config` - undefined
* `upgrade` - undefined
* `changelog` - undefined
* `analytics` - undefined
* `open` - undefined
* `web` - undefined
* `gh` - undefined
* `kafka` - undefined
* `azure` - undefined

<!-- COMPUTER SAYS DON'T TOUCH THIS END -->

Du kan også bruke `tsmx` for å interaktivt bytte mellom team, dersom du har satt opp flere team med `tsm config --team=<team>`.

### Eksempler på bruk:

#### Sjekk at du har satt opp alle verktøy riktig

```bash
tsm doctor
```

#### Alle åpne pull requester i våre repos, inkludert drafts

```bash
tsm prs --drafts
```

#### Se alle statuser på bygg i alle repos

```bash
tsm builds
```

#### Hent alle nyeste commits i alle repos

```bash
tsm commits
```

#### Hent de 10 reposene som er lengst siden oppdatert

```bash
tsm commits --order=asc --limit=10
```

#### Finn alle repos som bruker yarn

```bash
tsm repos --query='cat .yarnrc.yml'
```

### Utvikling

Dette kommandolinje-verktøyet er skrevet i TypeScript og bruker bun.sh. For å kjøre det må du først bygge det:

```bash
bun install
```

Deretter kan du kjøre det med:

```bash
bun run src/index.ts
```
