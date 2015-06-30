from django.db import models


class DataIngestionManager(models.Manager):
    "Manager class for various mysql-specific db interactions"

    def bulk_try_create(self, key_fields, *objs):
        """
        This method is similar to bulk_create, but it uses the key_fields
        parameter to conditionally do the inserts.
        :key_fields: a list of field names to use as insert condition
        :objs: a list of objects to insert into the db. If an object has
               already a pk, it's skipped.
        """
        if self.model._meta.parents:
            raise ValueError("Can't bulk create an inherited model")

        if not objs:
            return objs

        if not key_fields:
            self.bulk_create(objs)

        fields = [f.name for f in self.model._meta.local_concrete_fields]
        fields_string = ','.join(fields)
        table = self.model._meta.db_table
        values_placeholders = ','.join(['%s']*len(fields))
        key_fields_string = ','.join(key_fields)
        key_placeholders = ','.join(['%s']*len(key_fields))
        sql_template = """
            INSERT INTO %(table)s
            (%(fields_string)s)
            SELECT
            %(values_placeholders)s
            FROM dual
            WHERE NOT EXISTS
            ( SELECT *  FROM %(table)s
              WHERE (%(key_fields_string)s) = (%(key_placeholders)s));
            """
        sql = sql_template % locals()
        parameters = []

        print sql

        for obj in objs:
            values = [getattr(obj, f, None) for f in fields]
            key_values = [getattr(obj, f) for f in key_fields]
            parameters.append(values + key_values)

        print parameters

        from django.db import connection

        with connection.cursor() as cursor:
            cursor.executemany(sql, parameters)
