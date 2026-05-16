import React from 'react';
import './SkeletonBase.css';

const DashboardShellSkeleton = () => {
  return (
    <div className="skel-dashboard-shell">
      {/* Skeleton Header */}
      <header className="skel-header" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '1.5rem 2rem',
        height: '110px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', padding: '0 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="skel skel-md" style={{ width: '48px', height: '48px', borderRadius: '8px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div className="skel skel-lg skel-w-3-4" style={{ width: '200px', height: '2rem' }}></div>
              <div className="skel skel-xs skel-w-half" style={{ width: '120px' }}></div>
            </div>
          </div>
          <div className="skel" style={{ width: '140px', height: '40px', borderRadius: '9999px', opacity: 0.3 }}></div>
        </div>
      </header>

      {/* Skeleton Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid #e5e7eb', height: '56px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '1rem', padding: '0 2rem' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="skel skel-md" style={{ width: '20px', height: '20px', borderRadius: '4px' }}></div>
              <div className="skel skel-sm" style={{ width: '80px' }}></div>
            </div>
          ))}
        </div>
      </nav>

      {/* Main Content Skeleton Area */}
      <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
         <div className="skel skel-lg skel-w-half" style={{ marginBottom: '2rem' }}></div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
               <div key={i} className="skel" style={{ height: '200px', borderRadius: '12px' }}></div>
            ))}
         </div>
      </main>
    </div>
  );
};

export default DashboardShellSkeleton;
