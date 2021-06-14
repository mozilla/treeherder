import React from 'react';
import PropTypes from 'prop-types';
import UncontrolledTooltip from 'reactstrap/lib/UncontrolledTooltip';
import Button from 'reactstrap/lib/Button';
import Badge from 'reactstrap/lib/Badge';

export default class AlertTableTagsOptions extends React.Component {
  items = { alertTag: 'alert-tag', alertOption: 'alert-option' };

  constructor(props) {
    super(props);
    const { tags, options } = this.props.items;
    this.state = {
      displayAllTags: false,
      displayAllOptions: false,
      options,
      tags,
    };
  }

  showTags = (tags) => {
    return tags.map((item) => (
      <Badge color="light" key={`${item}`} data-testid="alert-tag">
        {item}
      </Badge>
    ));
  };

  showOptions = (options) => {
    return options.map((item) => (
      <Badge color="light" key={`${item}`} data-testid="alert-option">
        {item}
      </Badge>
    ));
  };

  render() {
    const { alertId } = this.props;
    const { displayAllTags, displayAllOptions, options, tags } = this.state;

    const visibleTags = 2;
    const visibleOptions = 2;

    return (
      <React.Fragment>
        {tags.length && tags[0] !== '' ? (
          <div>
            {this.showTags(tags.slice(0, visibleTags))}
            {!displayAllTags && tags.length > visibleTags && (
              <Button
                color="link"
                size="sm"
                id={`alert-${alertId}-tags`}
                onClick={() =>
                  this.setState((prevState) => ({
                    displayAllTags: !prevState.displayAllTags,
                  }))
                }
              >
                <span>...</span>
                <UncontrolledTooltip
                  placement="top"
                  target={`alert-${alertId}-tags`}
                >
                  Show more tags
                </UncontrolledTooltip>
              </Button>
            )}
            {displayAllTags && this.showTags(tags.slice(visibleTags))}
          </div>
        ) : (
          <Badge color="light">No tags</Badge>
        )}
        {options.length && options[0] !== '' ? (
          <div>
            {this.showOptions(options.slice(0, visibleOptions))}
            {!displayAllOptions && options.length > visibleOptions && (
              <Button
                color="link"
                size="sm"
                id={`alert-${alertId}-options`}
                onClick={() =>
                  this.setState((prevState) => ({
                    displayAllOptions: !prevState.displayAllOptions,
                  }))
                }
              >
                <span>...</span>
                <UncontrolledTooltip
                  placement="top"
                  target={`alert-${alertId}-options`}
                >
                  Show more options
                </UncontrolledTooltip>
              </Button>
            )}
            {displayAllOptions &&
              this.showOptions(options.slice(visibleOptions))}
          </div>
        ) : (
          <Badge color="light">No options</Badge>
        )}
      </React.Fragment>
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
