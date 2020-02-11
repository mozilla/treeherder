
# Extracting to BigQuery

## Running extraction locally

You must set the 


## Run in Heroku


# Set Environment variables

The Heroku ***Config Vars*** are not delivered to Python environment variables; there is an obfuscation step which changes the characters as shown:

| Heroku Config Var |  Realized   | JSON String          |
| ----------------- | ----------- | -------------------- |
|      `\n`         |             |  `"\n"`              |
|      `\\n`        | `\n`        |  `"\\n"`             |
|      `"\n"`       |             |  `"\n"`              |
|      `"\""`       | `"`         |  `"\""`              |
|      `""\n"`      | `""\n"`     |  `"\"\"\\n\""`       |
|      `"\"\n"`     | `"`         |  `"\"\n"`            |
|      `"\"\\n\""`  | `"\n"`      |  `"\"\\n\""`         | 
|      `\n"\n"`     | `\n"\n"`    |  `"\\n\"\\n\""`      |
|      `\"\\n\"`    | `\"\\n\"`   |  `"\\\"\\\\n\\\""`   |  
|      `\n\"\\n\"`  | `\n\"\\n\"` |  `"\\n\\\"\\\\n\\\""`|

In general, you can escape backslash (`\`) to escape, quotes are ignored. 

If you want this sequence of characters 

    "-----BEGIN PRIVATE KEY-----\n
    
then you must write
    
    \n"-----BEGIN PRIVATE KEY-----\n\" 

Heroku has an **Heroku Scheduler Addon** which will create a new machine to execute managment commands in Overview

```
newrelic-admin run-program ./manage.py extract_jobs --restart
```

