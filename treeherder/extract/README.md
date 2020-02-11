
# Extracting to BigQuery

## Run in Heroku


### Set Environment variables

The Heroku ***Config Vars*** are not delivered to Python environment variables; there is an obfuscation step which changes the characters as shown. *The JSON String is the JSON encoding of the realized string, for clarity.*

**Some escaping examples**

| Heroku Config Var |  Realized   | JSON String*         |
| ----------------- | ----------- | -------------------- |
|      `\n`         |             |  `"\n"`              |
|      `\\n`        | `\n`        |  `"\\n"`             |
|      `"\n"`       |             |  `"\n"`              |
|      `"\""`       | `"`         |  `"\""`              |
|      `"\"\n"`     | `"`         |  `"\"\n"`            |
|      `"\"\\n\""`  | `"\n"`      |  `"\"\\n\""`         | 

**Some not-escaping examples**

| Heroku Config Var |  Realized   | JSON String*         |
| ----------------- | ----------- | -------------------- |
|      `""\n"`      | `""\n"`     |  `"\"\"\\n\""`       |
|      `\n"\n"`     | `\n"\n"`    |  `"\\n\"\\n\""`      |
|      `\"\\n\"`    | `\"\\n\"`   |  `"\\\"\\\\n\\\""`   |  
|      `\n\"\\n\"`  | `\n\"\\n\"` |  `"\\n\\\"\\\\n\\\""`|


In general, basic escaping works with or without quotes. If you provide an invalid sequence; If you try to escape a quote outside quotes, or escape a character that does not require escaping, then no escaping happens.

### Setup Schedule Job

Heroku has an **Heroku Scheduler Addon** which will create a new machine to execute management commands. You can setup an hourly (or daily) job with the following command

```
newrelic-admin run-program ./manage.py extract_jobs
```

