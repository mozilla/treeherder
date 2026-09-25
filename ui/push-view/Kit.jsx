import { useState } from 'react';

import alert from './kit/alert.svg';
import inquisitive from './kit/inquisitive.svg';
import sittingLookingForward from './kit/sitting-looking-forward.svg';
import sittingLookingUp from './kit/sitting-looking-up.svg';

// Kit, the Firefox mascot, from the official artwork in mozilla-central.
// A different pose each visit; to add one, drop its SVG in ./kit and list it.
const POSES = [sittingLookingUp, sittingLookingForward, inquisitive, alert];

const Kit = () => {
  const [pose] = useState(
    () => POSES[Math.floor(Math.random() * POSES.length)],
  );

  return <img className="pv-kit" src={pose} alt="Kit, the Firefox mascot" />;
};

export default Kit;
