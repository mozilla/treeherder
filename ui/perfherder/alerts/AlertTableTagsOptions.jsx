import React from 'react';
import PropTypes from 'prop-types';
import UncontrolledTooltip from 'reactstrap/lib/UncontrolledTooltip';
import Button from 'reactstrap/lib/Button';
import Badge from 'reactstrap/lib/Badge';

export default class AlertTableTagsOptions extends React.Component {
  itemsType = { tags: 'tags', options: 'options' };

  visibleItems = {
    tags: 2,
    options: 2,
  };

  constructor(props) {
    super(props);
    const { tags, options } = this.props.items;
    this.state = {
      displayAllItems: {
        tags: false,
        options: false,
      },
      options,
      tags,
    };
  }

  showItems = (items, type) => {
    const badgeId = {
      tags: 'alert-tag',
      options: 'alert-option',
    };

    return items.map((item) => (
      <Badge
        className="mr-1"
        color="light"
        key={`${item}`}
        data-testid={badgeId[type]}
      >
        {item}
      </Badge>
    ));
  };

  displayItems = (items, type) => {
    const { alertId } = this.props;
    const { displayAllItems } = this.state;

    return items.length && items[0] !== '' ? (
      <div>
        {this.showItems(items.slice(0, this.visibleItems[type]), type)}
        {!displayAllItems[type] && items.length > this.visibleItems[type] && (
          <Button
            color="link"
            size="sm"
            id={`alert-${alertId}-${type}`}
            onClick={() =>
              this.setState((prevState) => ({
                displayAllItems: {
                  ...prevState.displayAllItems,
                  [type]: !prevState.displayAllItems[type],
                },
              }))
            }
          >
            <span data-testid={`show-more-${type}`}>...</span>
            <UncontrolledTooltip
              placement="top"
              target={`alert-${alertId}-${type}`}
            >
              Show more {type}
            </UncontrolledTooltip>
          </Button>
        )}
        {displayAllItems[type] &&
          this.showItems(items.slice(this.visibleItems[type]), type)}
      </div>
    ) : (
      <Badge className="mb-1" color="light">
        No {type}
      </Badge>
    );
  };

  render() {
    const { options, tags } = this.state;

    return (
      <div className="d-flex flex-column align-items-start">
        {this.displayItems(tags, this.itemsType.tags)}
        {this.displayItems(options, this.itemsType.options)}
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
