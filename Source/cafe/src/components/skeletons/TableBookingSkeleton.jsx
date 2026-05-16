import React from 'react';
import './SkeletonBase.css';

/**
 * TableBookingSkeleton
 * Mimics: TableBooking page
 * Props:
 *   viewMode — 'visual' | 'list'  (matches the page's own viewMode state)
 */
export default function TableBookingSkeleton({ viewMode = 'visual' }) {
  if (viewMode === 'list') {
    return (
      <div className="skel-page-wrapper">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {/* Header: customer name + status badge */}
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div className="skel-row" style={{ gap: '0.75rem' }}>
                <span className="skel skel-circle" style={{ width: '36px', height: '36px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span className="skel skel-md" style={{ width: '130px' }} />
                  <span className="skel skel-sm" style={{ width: '90px' }} />
                </div>
              </div>
              <span className="skel skel-sm" style={{ width: '80px', borderRadius: '20px' }} />
            </div>
            {/* Detail rows */}
            <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Array.from({ length: 3 }).map((_, di) => (
                <div key={di} className="skel-row" style={{ gap: '0.75rem' }}>
                  <span className="skel skel-sm" style={{ width: '90px', flexShrink: 0 }} />
                  <span className="skel skel-sm" style={{ width: '140px' }} />
                </div>
              ))}
            </div>
            {/* Footer actions */}
            <div style={{
              padding: '0.65rem 1rem',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
            }}>
              <span className="skel" style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
              <span className="skel" style={{ width: '90px', height: '32px', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // viewMode === 'visual' — floor map grid
  return (
    <div className="skel-page-wrapper">
      {/* Floor name */}
      <span className="skel skel-lg" style={{ width: '180px' }} />

      {/* Table squares grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '1rem',
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span className="skel" style={{ width: '90px', height: '90px', borderRadius: '12px' }} />
            <span className="skel skel-sm" style={{ width: '50px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
