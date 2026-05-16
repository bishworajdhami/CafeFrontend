import React from 'react';
import './SkeletonBase.css';

/**
 * InsightsSkeleton
 * Mimics: BusinessInsights page
 * Layout: section divider + 4 KPI cards + section divider + 2 chart area cards
 */
export default function InsightsSkeleton() {
  return (
    <div className="skel-page-wrapper">
      {/* Section heading divider */}
      <span className="skel skel-md" style={{ width: '220px' }} />

      {/* 4 KPI Insight Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span className="skel skel-circle" style={{ width: '52px', height: '52px' }} />
            <span className="skel skel-xl" style={{ width: '80px' }} />
            <span className="skel skel-sm" style={{ width: '100px' }} />
          </div>
        ))}
      </div>

      {/* Second section heading */}
      <span className="skel skel-md" style={{ width: '200px', marginTop: '0.5rem' }} />

      {/* 2 Chart area cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {Array.from({ length: 2 }).map((_, ci) => (
          <div key={ci} style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {/* Chart card title */}
            <span className="skel skel-md" style={{ width: '150px' }} />
            {/* Bar rows mimicking a chart */}
            {Array.from({ length: 5 }).map((_, bi) => (
              <div key={bi} className="skel-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                <span className="skel skel-sm" style={{ width: '80px', flexShrink: 0 }} />
                <span className="skel skel-md" style={{ width: `${40 + Math.floor((bi * 37 + 20) % 55)}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
