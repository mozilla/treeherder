import uuid

from django.contrib import admin
from treeherder.webapp.admin import admin_site

from .models import Credentials


def get_owner_email(credentials):
    return credentials.owner.email
get_owner_email.short_description = 'owner'


@admin.register(Credentials, site=admin_site)
class CredentialsAdmin(admin.ModelAdmin):

    def reset_secret(self, request, queryset):
        for credentials in queryset:
            credentials.secret = uuid.uuid4()
            credentials.save()
        self.message_user(request, 'Action successfully completed')

    reset_secret.short_description = 'Reset credentials secret'

    list_select_related = ('owner',)
    list_display = ['client_id', get_owner_email, 'authorized', 'created', 'modified']
    search_fields = ['client_id', 'owner__email']
    list_filter = ['authorized']
    raw_id_fields = ['owner']
    actions = [reset_secret]
