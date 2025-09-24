import React from 'react';
import PropTypes from 'prop-types';
import UncontrolledTooltip from 'reactstrap/lib/UncontrolledTooltip';
import Button from 'reactstrap/lib/Button';
import Badge from 'reactstrap/lib/Badge';

import SimpleTooltip from '../../shared/SimpleTooltip';

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
      tag: 'alert-tag',
      option: 'alert-option',
      'tag & option': 'alert-tag-and-option',
    };

    return items.map((item) => (
      <Badge
        className="mr-1 custom-tooltip"
        color="light"
        key={`${item.name}`}
        data-testid={badgeId[this.getBadgeType(item)]}
      >
        <SimpleTooltip text={item.name} tooltipText={this.getBadgeType(item)} />
      </Badge>
    ));
  };

  getBadgeType = (item) => {
    if (item.tagAndOption) {
      return 'tag & option';
    }

    if (item.tag) {
      return 'tag';
    }

    if (item.option) {
      return 'option';
    }
  };

  displayItems = (items) => {
    const { alertId } = this.props;
    const { displayAllItems } = this.state;

    return items.length ? (
      <div
        data-testid="all-tags-and-options"
        className="tags-and-options-container"
      >
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
  items: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      tag: PropTypes.bool.isRequired,
      option: PropTypes.bool.isRequired,
      tagAndOption: PropTypes.bool.isRequired,
    }),
  ).isRequired,
  alertId: PropTypes.number.isRequired,
};
