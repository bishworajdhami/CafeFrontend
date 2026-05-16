import React from 'react';
import './SkeletonBase.css';

/**
 * MenuSkeleton
 * Mimics: MenuManagement (grid of menu cards) & OrderTaking (menu panel)
 * Layout: 2 category headings × 4 ghost cards each
 */
export default function MenuSkeleton({ groups = 2, cardsPerGroup = 4 }) {
  return (
    <div className="skel-page-wrapper">
      {Array.from({ length: groups }).map((_, gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Category heading */}
          <span className="skel skel-md" style={{ width: '160px' }} />

          {/* Cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {Array.from({ length: cardsPerGroup }).map((_, ci) => (
              <div key={ci} style={{
                background: 'var(--color-surface, #fff)',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}>
                {/* Image area */}
                <span className="skel" style={{ height: '140px', borderRadius: 0 }} />
                {/* Card body */}
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span className="skel skel-md skel-w-3-4" />
                  <span className="skel skel-sm skel-w-half" />
                </div>
                {/* Card footer */}
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderTop: '1px solid var(--color-border, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span className="skel skel-lg" style={{ width: '70px' }} />
                  <span className="skel skel-xl skel-circle" style={{ width: '36px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
