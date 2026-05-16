import React, { useEffect, useState } from 'react';
import { getImageUrl } from '../../utils/api';
import './LoginTransition.css';

export default function LoginTransition({ cafeName, cafeLogo, onComplete }) {
  // phases: 'focus' (heartbeat) -> 'slash' (cut in half) -> 'shatter' (fall into 3D space)
  const [phase, setPhase] = useState('focus');

  useEffect(() => {
    // 1. Build tension with a heartbeat pulse
    const t1 = setTimeout(() => setPhase('slash'), 1200);

    // 2. The flash hits, and the two halves slide apart
    const t2 = setTimeout(() => setPhase('shatter'), 1900);

    // 3. The halves shatter backward, unmount and reveal dashboard
    const t3 = setTimeout(() => onComplete(), 2700);

    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onComplete]);

  // We wrap the logo and title so we can mirror it perfectly in both halves
  const InnerContent = () => (
    <div className="lt-content-mirror">
      <div className="lt-logo-box">
        {cafeLogo ? (
          <img
            src={getImageUrl(cafeLogo)}
            alt="Cafe Logo"
            className="lt-img"
          />
        ) : (
          <div className="lt-placeholder">☕</div>
        )}
        <h1 className="lt-title">{cafeName || 'Cafe'}</h1>
      </div>
    </div>
  );

  return (
    <div className={`lt-container lt-phase-${phase}`}>

      {/* Top Half of the Screen */}
      <div className="lt-half lt-half-top">
        <InnerContent />
      </div>

      {/* Bottom Half of the Screen */}
      <div className="lt-half lt-half-bottom">
        <InnerContent />
      </div>

      {/* The glowing sword beam */}
      <div className="lt-slash-beam" />

    </div>
  );
} import React, { useEffect, useState } from 'react';
import { getImageUrl } from '../../utils/api';
import './LoginTransition.css';

export default function LoginTransition({ cafeName, cafeLogo, onComplete }) {
  // phases: 'focus' (heartbeat) -> 'slash' (cut in half) -> 'shatter' (fall into 3D space)
  const [phase, setPhase] = useState('focus');

  useEffect(() => {
    // 1. Build tension with a heartbeat pulse
    const t1 = setTimeout(() => setPhase('slash'), 1200);

    // 2. The flash hits, and the two halves slide apart
    const t2 = setTimeout(() => setPhase('shatter'), 1900);

    // 3. The halves shatter backward, unmount and reveal dashboard
    const t3 = setTimeout(() => onComplete(), 2700);

    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onComplete]);

  // We wrap the logo and title so we can mirror it perfectly in both halves
  const InnerContent = () => (
    <div className="lt-content-mirror">
      <div className="lt-logo-box">
        {cafeLogo ? (
          <img
            src={getImageUrl(cafeLogo)}
            alt="Cafe Logo"
            className="lt-img"
          />
        ) : (
          <div className="lt-placeholder">☕</div>
        )}
        <h1 className="lt-title">{cafeName || 'Cafe'}</h1>
      </div>
    </div>
  );

  return (
    <div className={`lt-container lt-phase-${phase}`}>

      {/* Top Half of the Screen */}
      <div className="lt-half lt-half-top">
        <InnerContent />
      </div>

      {/* Bottom Half of the Screen */}
      <div className="lt-half lt-half-bottom">
        <InnerContent />
      </div>

      {/* The glowing sword beam */}
      <div className="lt-slash-beam" />

    </div>
  );
}