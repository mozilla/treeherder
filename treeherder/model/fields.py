import django
from django.db import models


# Django doesn't support big auto fields out of the box, see
# https://code.djangoproject.com/ticket/14286.
# This is a stripped down version of the BoundedBigAutoField from Sentry.
# TODO: Remove once using Django 1.10, since it has native support.
class BigAutoField(models.AutoField):
    description = "Big Integer"

    def db_type(self, connection):
        engine = connection.settings_dict['ENGINE']
        if 'mysql' in engine:
            return "bigint AUTO_INCREMENT"
        elif 'postgres' in engine:
            return "bigserial"
        raise NotImplemented

    def get_related_db_type(self, connection):
        return models.BigIntegerField().db_type(connection)

    def get_internal_type(self):
        return "BigIntegerField"


# This is required to support BigAutoField
class FlexibleForeignKey(models.ForeignKey):
    def db_type(self, connection):
        if django.VERSION >= (1, 9):
            rel_field = self.target_field
        else:
            rel_field = self.related_field
        if hasattr(rel_field, 'get_related_db_type'):
            return rel_field.get_related_db_type(connection)
        return super(FlexibleForeignKey, self).db_type(connection)
