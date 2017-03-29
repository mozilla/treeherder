# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_email(base_url, selenium):
    """Open Treeherder page, select and filter by random email,
    verify if filtered emails have the same email address"""
    page = TreeherderPage(selenium, base_url).open()
    page.select_random_email()

    filtered_emails_name = page.result_sets[0].email_name
    random_email_name = page.random_email_name

    assert filtered_emails_name == random_email_name


@pytest.mark.nondestructive
def test_remove_email_address_filter(base_url, selenium):
    """Open Treeherder page, select and filter by random email,
    remove email address filter, verify that job list display all authors"""
    page = TreeherderPage(selenium, base_url).open()
    page.select_random_email()

    page.click_on_active_watched_repo()
    all_emails = [email.get_name for email in page.all_emails]

    assert len(set(all_emails)) > 1
