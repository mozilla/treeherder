import React from 'react';
import { Button, Input, InputGroup } from 'reactstrap';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default class ComparePageTitle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inEditMode: false,
      pageTitle: props.pageTitleQueryParam || props.title,
      newpageTitle: props.pageTitleQueryParam || props.title,
    };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.userActionListener, false);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.userActionListener, false);
  }

  goToEditMode = () => {
    this.setState({
      inEditMode: true,
    });
  };

  userActionListener = async event => {
    const { updateParams } = this.props;
    const { pageTitle } = this.state;
    const { newpageTitle } = this.state || event.target.value;

    if (
      event.key === 'Enter' ||
      !event.target.classList.contains('page-title-input') // clicked outside Input
    ) {
      this.setState({ inEditMode: false });
      if (newpageTitle !== pageTitle) {
        this.setState({ pageTitle: newpageTitle });
        updateParams({ pageTitle: newpageTitle });
      }
    } else if (event.key === 'Escape') {
      this.setState({ inEditMode: false, newpageTitle: pageTitle });
    }
  };

  editpageTitle = newpageTitle => {
    this.setState({ newpageTitle });
  };

  render() {
    const { inEditMode, pageTitle, newpageTitle } = this.state;

    return !inEditMode ? (
      <Button
        className="text-center pb-1 col-sm-12"
        size="lg"
        color="white"
        onClick={this.goToEditMode}
        title="Click to change the page title"
      >
        <h1>
          {pageTitle}
          <FontAwesomeIcon icon={faEdit} className="hghghg fa-xs align-top" />
        </h1>
      </Button>
    ) : (
      <InputGroup>
        <Input
          className="pb-1 col-sm-12 page-title-input"
          ref={this.inputRef}
          color="white"
          style={{
            textAlign: 'center',
            fontSize: 'xx-large',
          }}
          value={newpageTitle}
          onChange={event => this.editpageTitle(event.target.value)}
          onKeyDown={event => this.userActionListener(event)}
          autoFocus
        />
      </InputGroup>
    );
  }
}
