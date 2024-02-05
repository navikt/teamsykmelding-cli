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

* `check` - check that all tooling looks OK
* `auth` - login to gcloud
* `commits` - get the last commits for every repo in the team
* `prs` - get all open pull requests
* `repos` - get all repos
* `git` - keep our repos in sync, ex: tsm git sync
* `work` - see what has happened the last week (or more)
* `mock` - do stuff with the mock
* `team` - get all team members
* `sync-file` - sync a file across specified repos
* `primary-branch` - get misc repo metadata
* `mob` - make a mob commit
* `config` - set config for tsm
* `upgrade` - update the cli
* `update` - see if there is a new version for this cli
* `changelog` - get the latest changes in tsm cli
* `analytics` - get your own usage stats for tsm cli
* `open` - open command that opens a project in IntelliJ IDEA
* `web` - open web page
* `gh` - open github repo in browser
* `kafka` - kafka cli for kafka stuff
* `azure` - azure cli for azure stuff

<!-- COMPUTER SAYS DON'T TOUCH THIS END -->

### Eksempler på bruk:

#### Sjekk at du har satt opp alle verktøy riktig

```bash
tsm check
```

#### Alle åpne pull requester i våre repos, inkludert drafts

```bash
tsm prs --drafts
```

#### Hent alle nyeste commits i alle repos

```bash
tsm commits
```

#### Hent de 10 eldste commitsene i våre repos:

```bash
tsm commits --order=asc --limit=10
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
