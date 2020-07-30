import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse, Row } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';

class MainHeading extends Component {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
    };
  }

  toggleDetails = () => {
    const { updateParamsAndState, name } = this.props;

    updateParamsAndState({
      testGroup: name === 'Possible Regressions' ? 'pr' : 'ki',
    });
    this.setState((prevState) => ({
      detailsShowing: !prevState.detailsShowing,
    }));
  };

  render() {
    const { detailsShowing } = this.state;
    const { name, className, stateIcon, iconColor, groupLength } = this.props;
    const expandIcon = detailsShowing ? faCaretDown : faCaretRight;
    const expandTitle = detailsShowing
      ? 'Click to collapse'
      : 'Click to expand';

    return (
      <Row
        className={`justify-content-between ${className}`}
        data-testid="classification-group"
      >
        <span className="font-size-24">
          <Button
            onClick={this.toggleDetails}
            outline
            className="font-size-24 border-0"
            role="button"
            aria-expanded={detailsShowing}
          >
            <FontAwesomeIcon
              icon={expandIcon}
              className="mr-1 min-width-1"
              title={expandTitle}
              aria-label={expandTitle}
              alt=""
            />
            <FontAwesomeIcon
              icon={stateIcon}
              className={`mx-2 text-${iconColor}`}
            />
            {name} {groupLength ? <span>({groupLength})</span> : ''}
          </Button>
        </span>
        <Collapse isOpen={detailsShowing} className="w-100">
          {this.props.children}
        </Collapse>
      </Row>
    );
  }
}

MainHeading.propTypes = {
  name: PropTypes.string.isRequired,
  stateIcon: PropTypes.shape({}).isRequired,
  groupLength: PropTypes.number,
  expanded: PropTypes.bool,
  className: PropTypes.string,
  iconColor: PropTypes.string,
};

MainHeading.defaultProps = {
  expanded: true,
  className: '',
  iconColor: 'darker-info',
  groupLength: 0,
};

export default MainHeading;
