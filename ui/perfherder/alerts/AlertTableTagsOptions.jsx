import React from 'react';
import PropTypes from 'prop-types';
import UncontrolledTooltip from 'reactstrap/lib/UncontrolledTooltip';
import Button from 'reactstrap/lib/Button';
import Badge from 'reactstrap/lib/Badge';

export default class AlertTableTagsOptions extends React.Component {
  visibleItems = 2;

  constructor(props) {
    super(props);

    this.state = {
      displayAllItems: false,
    };
  }

  showItems = (items) => {
    const badgeId = {
      tags: 'alert-tag',
      options: 'alert-option',
      tagsAndOptions: 'alert-tag-and-option',
    };

    return items.map((item) => (
      <Badge
        // eslint-disable-next-line no-nested-ternary
        title={item.tagAndOption ? 'tag&option' : item.tag ? 'tag' : 'option'}
        className="mr-1"
        color="light"
        key={`${item.name}`}
        data-testid={
          badgeId[
            // eslint-disable-next-line no-nested-ternary
            item.tagAndOption ? 'tagsAndOptions' : item.tag ? 'tags' : 'options'
          ]
        }
      >
        {item.name}
      </Badge>
    ));
  };

  displayItems = (items) => {
    const { alertId } = this.props;
    const { displayAllItems } = this.state;

    return items.length ? (
      <div>
        {this.showItems(items.slice(0, this.visibleItems))}
        {!displayAllItems && items.length > this.visibleItems && (
          <Button
            color="link"
            size="sm"
            id={`alert-${alertId}-tags-options`}
            onClick={() =>
              this.setState((prevState) => ({
                displayAllItems: !prevState.displayAllItems,
              }))
            }
          >
            <span data-testid="show-more-tags-options">...</span>
            <UncontrolledTooltip
              placement="top"
              target={`alert-${alertId}-tags-options`}
            >
              Show more
            </UncontrolledTooltip>
          </Button>
        )}
        {displayAllItems && this.showItems(items.slice(this.visibleItems))}
      </div>
    ) : (
      <Badge className="mb-1" color="light">
        No tags or options
      </Badge>
    );
  };

  render() {
    const { items } = this.props;

    return (
      <div className="d-flex flex-column align-items-start">
        {this.displayItems(items)}
      </div>
    );
  }
}

AlertTableTagsOptions.propTypes = {
  items: PropTypes.shape({
    tags: PropTypes.array.isRequired,
    options: PropTypes.array.isRequired,
  }).isRequired,
  alertId: PropTypes.number.isRequired,
};
