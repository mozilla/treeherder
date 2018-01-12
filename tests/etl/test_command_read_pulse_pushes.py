import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from mock import Mock


@pytest.mark.parametrize('set_setting_var, missing_setting_var', [
    # one required setting set and one missing, combinations
    ('PULSE_PUSH_SOURCES', 'PULSE_DATA_INGESTION_CONFIG'),
    ('PULSE_DATA_INGESTION_CONFIG', 'PULSE_PUSH_SOURCES'),
])
def test_command_raises_if_required_setting_is_missing(
    set_setting_var, missing_setting_var
):
    settings = {missing_setting_var: None, set_setting_var: Mock()}

    with override_settings(**settings):
        with pytest.raises(CommandError) as exc:
            call_command('read_pulse_pushes')

        exc.match('{} must be set'.format(missing_setting_var))
