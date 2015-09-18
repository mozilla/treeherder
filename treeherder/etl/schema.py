import os
import yaml
from memoize import mproperty


class IngestionDataSchema(object):
    """
    Makes schemas for data ingestion available as properties

    The use or ``memoize`` here means the results of either ``mproperty``
    is remembered (cached) so it doesn't have to go to disk each time.  This
    is a faster/simpler way of remembering the value than using memcached.
    """

    @mproperty
    def text_log_summary_artifact_json_schema(self):
        return self.get_json_schema(
            "text-log-summary-artifact.yml")

    def get_json_schema(self, filename):
        """
        Get a JSON Schema by filename.

        """
        file_path = os.path.join("schemas", filename)
        with open(file_path) as f:
            schema = yaml.load(f)
        return schema
