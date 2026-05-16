import React from 'react';
import './SkeletonBase.css';

/**
 * ItemAvailabilitySkeleton
 * Mimics: ItemAvailability (Chef) page
 * Layout: 2 category group blocks, each with 4 horizontal toggle-row ghosts
 */
export default function ItemAvailabilitySkeleton({ groups = 2, itemsPerGroup = 4 }) {
  return (
    <div className="skel-page-wrapper">
      {Array.from({ length: groups }).map((_, gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Category heading */}
          <span className="skel skel-md" style={{ width: '150px' }} />

          {/* Toggle card rows */}
          {Array.from({ length: itemsPerGroup }).map((_, ii) => (
            <div key={ii} style={{
              background: 'var(--color-surface, #fff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              {/* Left: name + price */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span className="skel skel-md" style={{ width: `${100 + ii * 30}px` }} />
                <span className="skel skel-sm" style={{ width: '60px' }} />
              </div>
              {/* Right: toggle pill */}
              <span className="skel" style={{ width: '48px', height: '26px', borderRadius: '30px', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
