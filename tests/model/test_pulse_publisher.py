import pytest
from django.conf import settings

from treeherder.model.pulse_publisher import PulsePublisher
from treeherder.model.tasks import PULSE_SCHEMAS

REQUIRED_PUBLISHER_ATTS = ('title', 'description', 'exchange_prefix')


@pytest.mark.parametrize('required_attr', REQUIRED_PUBLISHER_ATTS)
def test_init_publisher_with_required_attributes_raises(required_attr):

    class MyPublisher(PulsePublisher):
        pass

    # set all required attrs except the one we are currently testing
    all_attrs_except_one_required = [
        a for a in REQUIRED_PUBLISHER_ATTS if a != required_attr
    ]
    for class_attr in all_attrs_except_one_required:
        setattr(MyPublisher, class_attr, 'some-value')

    with pytest.raises(TypeError) as exc:
        MyPublisher(
            namespace=settings.PULSE_EXCHANGE_NAMESPACE,
            uri=settings.PULSE_URI,
            schemas=PULSE_SCHEMAS
        )
    exc.match('{} is required'.format(required_attr))
