import React from "react";
import { DropdownMenu, DropdownItem } from "reactstrap";
import Icon from "react-fontawesome";

export default class DropdownMenuItems extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedItem: this.props.default
    };
    this.changeSelection = this.changeSelection.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.default) {
      this.setState({ selectedItem: nextProps.default });
    }
  }

  changeSelection(event) {
    const { selectedItem } = this.state;
    const selectedText = event.target.innerText;

    if (selectedText !== selectedItem) {
      this.setState({ selectedItem: selectedText }, () => this.props.updateData(selectedText));
    }
  }

  render() {
    const { selectedItem } = this.state;
    const { options } = this.props;

    return (
      <DropdownMenu>
        {options.map((item, index) =>
          (<DropdownItem key={index} onClick={this.changeSelection}>
            <Icon name="check" className={`pr-1 ${selectedItem === item ? "" : "hide"}`} />
            {item}
          </DropdownItem>))}
      </DropdownMenu>
    );
  }
}

