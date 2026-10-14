import { useState } from 'react';

import { KIT_ALT, KIT_POSES } from './constants';

const Kit = () => {
  const [pose] = useState(
    () => KIT_POSES[Math.floor(Math.random() * KIT_POSES.length)],
  );

  return <img className="sv-kit" src={pose} alt={KIT_ALT} />;
};

export default Kit;
