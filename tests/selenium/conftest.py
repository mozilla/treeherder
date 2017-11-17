import pytest
from django.core.management import call_command


@pytest.fixture(autouse=True)
def initial_data(transactional_db):
    call_command('load_initial_data')
