import React from 'react';
import './SkeletonBase.css';

/**
 * SettingsSkeleton
 * Mimics: KitchenSettings page
 * Layout: Grid of 6 setting control cards
 * Each card: icon wrap + title/desc body + toggle or number control
 */
export default function SettingsSkeleton({ count = 6 }) {
  return (
    <div className="skel-page-wrapper">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {/* Icon wrap */}
            <span className="skel skel-circle" style={{ width: '48px', height: '48px', flexShrink: 0 }} />

            {/* Card body: title + description */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="skel skel-md skel-w-3-4" />
              <span className="skel skel-sm skel-w-full" />
              <span className="skel skel-sm" style={{ width: '40%' }} />
            </div>

            {/* Control: toggle or number buttons */}
            {i < 3 ? (
              /* Toggle */
              <span className="skel" style={{ width: '48px', height: '26px', borderRadius: '30px', flexShrink: 0 }} />
            ) : (
              /* Number control: − [n] + */
              <div className="skel-row" style={{ gap: '0.3rem', flexShrink: 0 }}>
                <span className="skel" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                <span className="skel" style={{ width: '40px', height: '28px', borderRadius: '6px' }} />
                <span className="skel" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
