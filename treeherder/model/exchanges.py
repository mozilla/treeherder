# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from treeherder.model.pulse_publisher import PulsePublisher, Exchange, Key

class TreeherderPublisher(PulsePublisher):
    title = "TreeHerder Exchanges"
    description = """
        Exchanges for services that wants to know what shows up on TreeHerder.
    """
    exchange_prefix = 'v1/'

    new_result_set = Exchange(
        exchange      = 'new-result-set',
        title         = "New Result-Set Messages",
        description   = """
            Whenever a new result-set is created a message featuring the
            `revision_hash` is published on this exchange.
        """,
        routing_keys  = [
            Key(
                name    = 'project',
                summary = "Project (or branch) that this result-set concerns"
            ),
            Key(
                name    = 'revision_hash',
                summary = "result-set identifier for the message"
            )
        ],
        schema = "https://treeherder.mozilla.org/schemas/v1/resultset-message.json#"
    )

