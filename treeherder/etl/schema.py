import os
import yaml


def get_json_schema(filename):
    """
    Get a JSON Schema by filename.

    """
    file_path = os.path.join("schemas", filename)
    with open(file_path) as f:
        schema = yaml.load(f)
    return schema

job_json_schema = get_json_schema("pulse-job.yml")
