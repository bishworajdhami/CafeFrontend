import React from 'react';

export default function EmptyState({ icon: Icon, message, className = 'empty-state' }) {
  return (
    <div className={className}>
      {Icon ? <Icon /> : null}
      <p>{message}</p>
    </div>
  );
}
