import React, { useState } from 'react';
import { Button } from 'reactstrap';

import JobModel from '../../models/job';

const RetriggerJobButton = (props) => {
  const [notification, setNotification] = useState('');

  const notify = (message) => {
    console.log(message);
    setNotification(message);
  };

  const retrigger = () => {
    const { pushId, repoName } = props;
    JobModel.retrigger([{ push_id: pushId }], repoName, notify);
  };

  return (
    <React.Fragment>
      <Button size="sm" onClick={() => retrigger()}>
        Retrigger
      </Button>
      <p className="small text-white pt-2">Retrigger status: {notification}</p>
    </React.Fragment>
  );
};

RetriggerJobButton.propType = {};

export default RetriggerJobButton;
