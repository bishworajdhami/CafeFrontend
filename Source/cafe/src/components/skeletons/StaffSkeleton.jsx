import React from 'react';
import './SkeletonBase.css';

/**
 * StaffSkeleton
 * Mimics: StaffPermissions page
 * Layout: Grid of staff-card ghosts (avatar + name + email + role badge + 2 action buttons)
 */
export default function StaffSkeleton({ count = 6 }) {
  return (
    <div className="skel-page-wrapper">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.25rem',
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
            }}>
              {/* Avatar */}
              <span className="skel skel-circle" style={{ width: '64px', height: '64px' }} />
              {/* Name */}
              <span className="skel skel-md" style={{ width: '120px' }} />
              {/* Email */}
              <span className="skel skel-sm" style={{ width: '160px' }} />
              {/* Role badge */}
              <span className="skel skel-sm" style={{ width: '80px', borderRadius: '20px' }} />
            </div>
            {/* Card actions */}
            <div style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
            }}>
              <span className="skel" style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
              <span className="skel" style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
