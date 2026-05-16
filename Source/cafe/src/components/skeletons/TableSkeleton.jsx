import React from 'react';
import './SkeletonBase.css';

/**
 * TableSkeleton
 * Mimics: OrderHistory (Chef) & StockDetailDrawer internal loading sections
 * A generic reusable table ghost with configurable columns and rows
 * Props:
 *   cols     — number of columns (default 6)
 *   rows     — number of body rows (default 6)
 *   compact  — smaller padding for use inside drawers (default false)
 */
export default function TableSkeleton({ cols = 6, rows = 6, compact = false }) {
  const pad = compact ? '0.5rem 0.75rem' : '0.85rem 1rem';
  return (
    <div style={{
      background: 'var(--color-surface, #fff)',
      border: compact ? 'none' : '1px solid var(--color-border, #e2e8f0)',
      borderRadius: compact ? 0 : '10px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '0.75rem',
        padding: pad,
        borderBottom: '2px solid var(--color-border, #e2e8f0)',
        background: 'var(--color-surface-alt, #f8fafc)',
      }}>
        {Array.from({ length: cols }).map((_, ci) => (
          <span key={ci} className="skel skel-sm" style={{ width: '65%' }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '0.75rem',
          padding: pad,
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
        }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <span key={ci} className="skel skel-sm" style={{
              width: ci === 0 ? '75%' : `${45 + (ci * 13) % 40}%`,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
