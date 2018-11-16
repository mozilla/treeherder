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
        <a
          className="midgray"
          href="http://whatsdeployed.io/?owner=mozilla&amp;repo=treeherder&amp;name[]=Stage&amp;url[]=https://treeherder.allizom.org/revision.txt&amp;name[]=Prod&amp;url[]=https://treeherder.mozilla.org/revision.txt"
        >
          Whats Deployed?
        </a>
      </div>
    </div>
  );
};

export default UserGuideFooter;
