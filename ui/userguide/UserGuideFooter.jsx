import React from 'react';

const UserGuideFooter = function UserGuideFooter() {
  return (
    <div className="card-footer ug-footer">
      <div>
        <div>
          Some icons by
          <a href="http://www.freepik.com" title="Freepik">
            {' '}
            Freepik
          </a>{' '}
          from
          <a href="http://www.flaticon.com" title="Flaticon">
            {' '}
            www.flaticon.com
          </a>{' '}
          licensed under
          <a
            href="http://creativecommons.org/licenses/by/3.0/"
            title="Creative Commons BY 3.0"
          >
            {' '}
            CC BY 3.0
          </a>
        </div>
      </div>

      <div>
        <a className="midgray" href="https://whatsdeployed.io/s-dqv">
          Whats Deployed?
        </a>
      </div>
    </div>
  );
};

export default UserGuideFooter;
