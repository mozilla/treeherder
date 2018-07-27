Schema Validation
=================

Some data types in Treeherder will have JSON Schema files in the form of YAML.
You can use these files to validate your data prior to submission to be sure
it is in the right format.

You can find all our data schemas in the [schemas] folder.

To validate your file against a ``yml`` file, you can use something like the
following example code:

```python
import yaml
import jsonschema

schema = yaml.load(open("schemas/text-log-summary-artifact.yml"))
jsonschema.validate(data, schema)
```

This will give output telling you if your ``data`` element passes validation,
and, if not, exactly where it is out of compliance.

[schemas]: https://github.com/mozilla/treeherder/tree/master/schemas
