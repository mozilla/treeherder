# Run Treeherder using the production DB

## add to your `.zshrc`

Modify your `DATABASE_URL` to your own account.

```code
alias gauth="gcloud auth login --update-adc"

function use-prod {
    gcloud config configurations activate th-prod

    export SKIP_INGESTION=True
    export CLOUD_SQL=moz-fx-treeherder-prod-c739:us-west1:treeherder-prod-prod-v1-postgres-replica-0
    export TH_PW=<your password>
    export DATABASE_URL="psql://cdawson:$TH_PW@host.docker.internal:5999/treeherder"
}

function th-db {
    cloud-sql-proxy -p 5999 $CLOUD_SQL
}
```

## Terminal 1: run the DB proxy

```code
use-prod
gauth
th-db
```

## Terminal 2: Start Treeherder and use that proxy

1. Start Docker

```code
use-prod
docker-compose up -d
```

### ENV vars

```code
FRONTEND_PORT=5001
POSTGRES_PORT=5499
REDIS_PORT=6388
```
