from collections import defaultdict

from django.db import models


class DataIngestionManager(models.Manager):

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
            return self.bulk_create(objs)

        related_fields = [f for f in self.model._meta.fields
                          if isinstance(f, models.ForeignKey)
                          or isinstance(f, models.OneToOneField)]
        related_fields_mapping = dict((f.name, f.name+'_id') for f in related_fields)

        # substitute all the key related field names with the _id postfixed version
        key_fields = [related_fields_mapping.get(f, f) for f in key_fields]

        fields = []
        for f in self.model._meta.fields:
            # substitute all the related field names with the _id postfxed version
            fields.append(related_fields_mapping.get(f.name, f.name))

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

        for obj in objs:
            values = [getattr(obj, f, None) for f in fields]
            key_values = [getattr(obj, f) for f in key_fields]
            parameters.append(values + key_values)

        from django.db import connection

        with connection.cursor() as cursor:
            cursor.executemany(sql, parameters)

        # create a map between the key_fields and the pk stored
        # so that we can return the objects with the pk attached
        lookup_fields = ['pk'] + list(key_fields)
        lookup_queryset = self.model.objects.values_list(*lookup_fields)
        lookup_dict = dict(((tuple(l[1:]),l[0]) for l in lookup_queryset))

        # set the pk on each obj based on key_fields
        for obj in objs:
            obj.pk = lookup_dict[tuple(map(lambda x: getattr(obj, x), key_fields))]

        return objs
