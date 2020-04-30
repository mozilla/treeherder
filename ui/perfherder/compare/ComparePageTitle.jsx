import React from 'react';
import { Helmet } from 'react-helmet';
import PropTypes from 'prop-types';
import { Button, Input, InputGroup } from 'reactstrap';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { replaceLocation, getAllUrlParams } from '../../helpers/location';

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
    replaceLocation(params, '/compare');
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
        <Helmet>
          <meta charSet="utf-8" />
          <title>{tabTitle || this.props.defaultPageTitle}</title>
        </Helmet>

        {!inEditMode ? (
          <Button
            className="text-center"
            size="lg"
            color="white"
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
            <Input
              className="pb-1 col-sm-12 page-title-input"
              ref={this.inputRef}
              color="white"
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
              className="ml-3 my-2"
              vertical="center"
              size="lg"
              color="secondary"
              onClick={this.injectEnter}
            >
              Save
            </Button>
            <Button size="lg" color="link" onClick={this.injectEscape}>
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

ComparePageTitle.defaultProps = {
  pageTitleQueryParam: null,
};
