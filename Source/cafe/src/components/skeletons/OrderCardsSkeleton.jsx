import React from 'react';
import './SkeletonBase.css';

/**
 * OrderCardsSkeleton
 * Mimics: KitchenDisplay & OrderQueue
 * Layout: [optional stat pills row] + grid of order card ghosts
 * Props:
 *   count     — number of ghost order cards (default 6)
 *   showStats — show 4 stat pill ghosts above the grid (for OrderQueue)
 */
export default function OrderCardsSkeleton({ count = 6, showStats = false }) {
  return (
    <div className="skel-page-wrapper">
      {/* Optional stat pills (OrderQueue uses these) */}
      {showStats && (
        <div className="skel-row" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="skel" style={{ height: '110px', flex: '1', minWidth: '200px', borderRadius: '20px' }} />
          ))}
        </div>
      )}

      {/* Order Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1rem',
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}>
            {/* Card header row: ID + type badge */}
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span className="skel skel-md" style={{ width: '80px' }} />
              <div className="skel-row" style={{ gap: '0.4rem' }}>
                <span className="skel skel-sm" style={{ width: '60px', borderRadius: '20px' }} />
                <span className="skel skel-sm" style={{ width: '55px', borderRadius: '20px' }} />
              </div>
            </div>

            {/* Meta row: table + time */}
            <div style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              gap: '0.5rem',
            }}>
              <span className="skel skel-sm" style={{ width: '90px', borderRadius: '20px' }} />
              <span className="skel skel-sm" style={{ width: '70px', borderRadius: '20px' }} />
            </div>

            {/* Items list — 3 rows */}
            <div style={{ padding: '0 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Array.from({ length: 3 }).map((_, li) => (
                <div key={li} className="skel-row" style={{ gap: '0.5rem' }}>
                  <span className="skel skel-sm" style={{ width: '24px', flexShrink: 0, borderRadius: '20px' }} />
                  <span className="skel skel-sm" style={{ width: `${50 + li * 15}%` }} />
                </div>
              ))}
            </div>

            {/* Footer: total + status btn */}
            <div style={{
              padding: '0.65rem 1rem',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span className="skel skel-md" style={{ width: '80px' }} />
              <span className="skel" style={{ width: '100px', height: '34px', borderRadius: '8px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
