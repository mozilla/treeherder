import React from 'react';
import PropTypes from 'prop-types';
import {Button, DropdownToggle, UncontrolledDropdown} from 'reactstrap';
import DropdownMenuItems from "../../../shared/DropdownMenuItems";
import {phTimeRanges} from "../../../perfherder/perf-helpers/constants";

export default class SideBySideVideoDropdown extends React.Component {
  constructor(props) {
    super(props);
    const { url, value } = this.props;
    this.state = {
      url,
      value,
    };
  }

  render() {
    const { options, updateData } = this.props;
    return (
      <UncontrolledDropdown
        className="mr-0 text-nowrap"
        title={options[0].value}
        aria-label={options[0].value}
      >
        <DropdownToggle caret outline>
          {options[0].value}
        </DropdownToggle>
        <DropdownMenuItems
          options={options}
          selectedItem={options[0].value}
          updateData={updateData}
        />
      </UncontrolledDropdown>
    );
  }
}

SideBySideVideoDropdown.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateData: PropTypes.func.isRequired,
};
