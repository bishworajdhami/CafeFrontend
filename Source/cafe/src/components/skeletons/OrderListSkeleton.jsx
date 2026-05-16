import React from 'react';
import './SkeletonBase.css';

/**
 * OrderListSkeleton
 * Mimics: PaymentProcessing (pending orders left panel) & RefundManagement (orders left panel)
 * Layout: Vertical stacked list of narrow compact order card ghosts (single column)
 */
export default function OrderListSkeleton({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {/* Header row: #ID + type badge */}
          <div style={{
            padding: '0.7rem 0.85rem',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span className="skel skel-md" style={{ width: '90px' }} />
            <div className="skel-row" style={{ gap: '0.35rem' }}>
              <span className="skel skel-sm" style={{ width: '62px', borderRadius: '20px' }} />
            </div>
          </div>

          {/* Body: 2 item previews + total */}
          <div style={{
            padding: '0.6rem 0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
              <span className="skel skel-sm" style={{ width: '80%' }} />
              <span className="skel skel-sm" style={{ width: '60%' }} />
            </div>
            <span className="skel skel-md" style={{ width: '80px', flexShrink: 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
