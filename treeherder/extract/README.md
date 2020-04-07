# Extracting to BigQuery

## Run in Heroku

### Set Environment variables

The Heroku ***Config Vars*** are not delivered to Python environment variables; there is an obfuscation step which changes the characters provided.

### Some escaping examples**

| Heroku Config Var |  Realized   | JSON String*         |
| ----------------- | ----------- | -------------------- |
|      `\n`         |             |  `"\n"`              |
|      `\\n`        | `\n`        |  `"\\n"`             |
|      `"\n"`       |             |  `"\n"`              |
|      `"\""`       | `"`         |  `"\""`              |
|      `"\"\n"`     | `"`         |  `"\"\n"`            |
|      `"\"\\n\""`  | `"\n"`      |  `"\"\\n\""`         |

***Note:** The JSON String is the JSON encoding of the realized string, for clarity.*

### Some not-escaping examples**

| Heroku Config Var |  Realized   | JSON String*         |
| ----------------- | ----------- | -------------------- |
|      `""\n"`      | `""\n"`     |  `"\"\"\\n\""`       |
|      `\n"\n"`     | `\n"\n"`    |  `"\\n\"\\n\""`      |
|      `\"\\n\"`    | `\"\\n\"`   |  `"\\\"\\\\n\\\""`   |  
|      `\n\"\\n\"`  | `\n\"\\n\"` |  `"\\n\\\"\\\\n\\\""`|

In general, basic escaping works with or without quotes. But if you provide an **invalid** escape sequence, then escaping is disabled; If you try to escape a quote outside quotes, or escape a character that does not require escaping, then the whole string is treated as literal.

### Setup Schedule Job

Heroku has an **Heroku Scheduler Addon** which will create a new machine to execute management commands. You can setup an hourly (or daily) job with the following command:

```python
newrelic-admin run-program ./manage.py extract_jobs
```

The `newrelic-admin run-program` prefix ensures NewRelic captures and reports the output.
