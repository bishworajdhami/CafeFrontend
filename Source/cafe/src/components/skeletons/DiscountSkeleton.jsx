import React from 'react';
import './SkeletonBase.css';

/**
 * DiscountSkeleton
 * Mimics: DiscountSetup page
 * Layout: Grid of discount cards (name + badges + item tag pills + 3-button footer)
 */
export default function DiscountSkeleton({ count = 4 }) {
  return (
    <div className="skel-page-wrapper">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1.25rem',
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {/* Card header: name + status badges */}
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span className="skel skel-lg" style={{ width: '60%' }} />
              {/* Badge row */}
              <div className="skel-row" style={{ gap: '0.4rem' }}>
                <span className="skel skel-sm" style={{ width: '70px', borderRadius: '20px' }} />
                <span className="skel skel-sm" style={{ width: '55px', borderRadius: '20px' }} />
                <span className="skel skel-sm" style={{ width: '80px', borderRadius: '20px' }} />
              </div>
            </div>

            {/* Item tags */}
            <div style={{
              padding: '0 1rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}>
              {Array.from({ length: 3 }).map((_, ti) => (
                <span key={ti} className="skel skel-sm" style={{
                  width: `${60 + ti * 20}px`,
                  borderRadius: '20px',
                }} />
              ))}
            </div>

            {/* Card footer: 3 action buttons */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
            }}>
              {Array.from({ length: 3 }).map((_, bi) => (
                <span key={bi} className="skel" style={{ width: '72px', height: '32px', borderRadius: '6px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
