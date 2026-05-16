import React from 'react';
import './SkeletonBase.css';

/**
 * StockSkeleton
 * Mimics: StockTracking & ChefStockTracking
 * Layout: 4 KPI stat cards + a table with N ghost rows (6 columns)
 */
export default function StockSkeleton({ rows = 8 }) {
  return (
    <div className="skel-page-wrapper">
      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}>
            {/* Icon box */}
            <span className="skel skel-circle" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="skel skel-xl" style={{ width: '60px' }} />
              <span className="skel skel-sm skel-w-3-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Table ghost */}
      <div style={{
        background: 'var(--color-surface, #fff)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 1.2fr',
          gap: '1rem',
          padding: '0.85rem 1rem',
          borderBottom: '2px solid var(--color-border, #e2e8f0)',
          background: 'var(--color-surface-alt, #f8fafc)',
        }}>
          {['2fr', '1fr', '1.5fr', '1.5fr', '1fr', '1.2fr'].map((_, ci) => (
            <span key={ci} className="skel skel-sm" style={{ width: '70%' }} />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 1.2fr',
            gap: '1rem',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span className="skel skel-sm" style={{ width: '80%' }} />
              <span className="skel skel-xs" style={{ width: '50%' }} />
            </div>
            <span className="skel skel-sm" style={{ width: '60%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span className="skel skel-sm" style={{ width: '70%' }} />
              <span className="skel skel-xs" style={{ width: '50%' }} />
            </div>
            <span className="skel skel-sm" style={{ width: '65%' }} />
            <span className="skel skel-md" style={{ width: '80px', borderRadius: '20px' }} />
            <div className="skel-row" style={{ gap: '0.4rem' }}>
              {Array.from({ length: 4 }).map((_, bi) => (
                <span key={bi} className="skel skel-circle" style={{ width: '28px', height: '28px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
