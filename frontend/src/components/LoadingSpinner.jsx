import React from 'react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-5 h-5 border-2', md: 'w-10 h-10 border-[3px]', lg: 'w-12 h-12 border-[3.5px]' };
  return (
    <div className={`${sizes[size]} border-gray-100 border-t-violet-600 rounded-full animate-spin ${className}`} />
  );
};

export const LoadingBlock = ({ message, submessage, size = 'md' }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
    <Spinner size={size} />
    {message && <p className="text-sm font-medium text-gray-700">{message}</p>}
    {submessage && <p className="text-xs text-gray-400 max-w-xs">{submessage}</p>}
  </div>
);

export const SkeletonRows = ({ count = 5, height = 'h-14' }) => (
  <>
    {Array(count).fill(0).map((_, i) => (
      <div key={i} className={`${height} rounded-xl bg-gray-100 animate-pulse`} />
    ))}
  </>
);

export const SkeletonCards = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array(count).fill(0).map((_, i) => (
      <div key={i} className="h-44 rounded-xl bg-gray-100 animate-pulse" />
    ))}
  </div>
);

export default Spinner;
