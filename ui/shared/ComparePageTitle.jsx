import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { replaceLocation, getAllUrlParams } from '../helpers/location';

export default class ComparePageTitle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inEditMode: false,
      pageTitle: props.pageTitleQueryParam || props.title,
      newPageTitle: props.pageTitleQueryParam || props.title,
      tabTitle: null,
    };
  }

  componentDidUpdate(prevProps) {
    const { pageTitleQueryParam = null, title } = this.props;
    if (
      prevProps.pageTitleQueryParam !== pageTitleQueryParam ||
      prevProps.title !== title
    ) {
      this.setPageTitle();
    }
  }

  setPageTitle = () => {
    const { pageTitleQueryParam = null, title } = this.props;

    this.setState({
      pageTitle: pageTitleQueryParam || title,
      newPageTitle: pageTitleQueryParam || title,
    });
  };

  goToEditMode = () => {
    this.setState({
      inEditMode: true,
    });
  };

  resetToDefault = async (event) => {
    const { title, defaultPageTitle } = this.props;
    const { newPageTitle } = this.state || event.target.value;
    this.setState({
      inEditMode: false,
      pageTitle: title,
      newPageTitle: title,
      tabTitle: defaultPageTitle,
    });
    this.changeQueryParam(newPageTitle);
  };

  editpageTitle = (newPageTitle) => {
    this.setState({ newPageTitle });
  };

  changeTitle = async (newTitle) => {
    const { pageTitle } = this.state;

    this.setState({ inEditMode: false });
    if (newTitle !== pageTitle) {
      this.setState({ pageTitle: newTitle, tabTitle: newTitle });
      this.changeQueryParam(newTitle);
    }
  };

  changeQueryParam = (newTitle) => {
    const params = getAllUrlParams();
    params.set('pageTitle', newTitle);
    replaceLocation(params);
  };

  userActionListener = async (event) => {
    const { pageTitle } = this.state;
    const { newPageTitle } = this.state || event.target.value;

    if (!newPageTitle && event.key !== 'Escape') {
      this.resetToDefault(event);
    } else if (event.key === 'Enter') {
      this.changeTitle(newPageTitle);
    } else if (event.key === 'Escape') {
      this.setState({ inEditMode: false, newPageTitle: pageTitle });
    }
  };

  injectEnter = () => {
    const keyboardEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    this.userActionListener(keyboardEvent);
  };

  injectEscape = () => {
    const keyboardEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    this.userActionListener(keyboardEvent);
  };

  render() {
    const { inEditMode, pageTitle, newPageTitle, tabTitle } = this.state;

    return (
      <React.Fragment>
        <meta charSet="utf-8" />
        <title>{tabTitle || this.props.defaultPageTitle}</title>

        {!inEditMode ? (
          <Button
            className="text-center"
            size="lg"
            variant="white"
            onClick={this.goToEditMode}
            title="Click to change the page title"
          >
            <h1 className="page-title-text">
              {pageTitle}
              <FontAwesomeIcon
                icon={faEdit}
                className="fa-xs align-top edit-icon"
              />
            </h1>
          </Button>
        ) : (
          <InputGroup>
            <Form.Control
              className="pb-1 col-sm-12 page-title-input"
              ref={this.inputRef}
              variant="white"
              style={{
                textAlign: 'center',
                fontSize: 'xx-large',
              }}
              value={newPageTitle}
              onChange={(event) => this.editpageTitle(event.target.value)}
              onKeyDown={(event) => this.userActionListener(event)}
              autoFocus
            />
            <Button
              className="ms-3 my-2"
              vertical="center"
              size="lg"
              variant="secondary"
              onClick={this.injectEnter}
            >
              Save
            </Button>
            <Button size="lg" variant="link" onClick={this.injectEscape}>
              Cancel
            </Button>
          </InputGroup>
        )}
      </React.Fragment>
    );
  }
}

ComparePageTitle.propTypes = {
  title: PropTypes.string.isRequired,
  pageTitleQueryParam: PropTypes.string,
};
