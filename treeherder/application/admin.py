import uuid

from django.contrib import admin
from django_browserid.admin import site as browserid_admin

from .models import Application


def get_owner_email(application):
    return application.owner.email
get_owner_email.short_description = 'owner'


@admin.register(Application, site=browserid_admin)
class ApplicationAdmin(admin.ModelAdmin):

    def reset_secret(self, request, queryset):
        for application in queryset:
            application.secret = uuid.uuid4()
            application.save()
        self.message_user(request, 'Action successfully completed')

    reset_secret.short_description = 'Reset application secret'

    list_select_related = ('owner',)
    list_display = ['app_id', get_owner_email, 'authorized', 'created', 'modified']
    search_fields = ['app_id', 'owner__email']
    list_filter = ['authorized']
    raw_id_fields = ['owner']
    actions = [reset_secret]
