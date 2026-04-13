import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { replaceLocation, getAllUrlParams } from '../helpers/location';

const changeQueryParam = (newTitle) => {
  const params = getAllUrlParams();
  params.set('pageTitle', newTitle);
  replaceLocation(params);
};

const ComparePageTitle = ({ title, pageTitleQueryParam, defaultPageTitle }) => {
  const [inEditMode, setInEditMode] = useState(false);
  const [pageTitle, setPageTitle] = useState(pageTitleQueryParam || title);
  const [newPageTitle, setNewPageTitle] = useState(pageTitleQueryParam || title);
  const [tabTitle, setTabTitle] = useState(null);

  useEffect(() => {
    setPageTitle(pageTitleQueryParam || title);
    setNewPageTitle(pageTitleQueryParam || title);
  }, [pageTitleQueryParam, title]);

  const resetToDefault = useCallback(() => {
    setInEditMode(false);
    setPageTitle(title);
    setNewPageTitle(title);
    setTabTitle(defaultPageTitle);
    changeQueryParam(title);
  }, [title, defaultPageTitle]);

  const changeTitle = useCallback(
    (newTitle) => {
      setInEditMode(false);
      if (newTitle !== pageTitle) {
        setPageTitle(newTitle);
        setTabTitle(newTitle);
        changeQueryParam(newTitle);
      }
    },
    [pageTitle],
  );

  const userActionListener = useCallback(
    (event) => {
      if (!newPageTitle && event.key !== 'Escape') {
        resetToDefault();
      } else if (event.key === 'Enter') {
        changeTitle(newPageTitle);
      } else if (event.key === 'Escape') {
        setInEditMode(false);
        setNewPageTitle(pageTitle);
      }
    },
    [newPageTitle, pageTitle, resetToDefault, changeTitle],
  );

  const handleSave = useCallback(() => {
    changeTitle(newPageTitle);
  }, [changeTitle, newPageTitle]);

  const handleCancel = useCallback(() => {
    setInEditMode(false);
    setNewPageTitle(pageTitle);
  }, [pageTitle]);

  return (
    <React.Fragment>
      <meta charSet="utf-8" />
      <title>{tabTitle || defaultPageTitle}</title>

      {!inEditMode ? (
        <Button
          className="text-center"
          size="lg"
          variant="white"
          onClick={() => setInEditMode(true)}
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
            variant="white"
            style={{
              textAlign: 'center',
              fontSize: 'xx-large',
            }}
            value={newPageTitle}
            onChange={(event) => setNewPageTitle(event.target.value)}
            onKeyDown={userActionListener}
            autoFocus
          />
          <Button
            className="ms-3 my-2"
            vertical="center"
            size="lg"
            variant="secondary"
            onClick={handleSave}
          >
            Save
          </Button>
          <Button size="lg" variant="link" onClick={handleCancel}>
            Cancel
          </Button>
        </InputGroup>
      )}
    </React.Fragment>
  );
};

ComparePageTitle.propTypes = {
  title: PropTypes.string.isRequired,
  pageTitleQueryParam: PropTypes.string,
};

export default ComparePageTitle;
