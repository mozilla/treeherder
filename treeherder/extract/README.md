
# Extracting to BigQuery

## Running extraction locally

You must set the 


## Run in Heroku

Heroku has an **Heroku Scheduler Addon** which will create a new machine to execute managment commands

```
newrelic-admin run-program ./manage.py extract_jobs --restart
```