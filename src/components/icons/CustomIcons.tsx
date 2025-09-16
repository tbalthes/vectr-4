import React from 'react';

export const Rabbit = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5 12c0-2 1-4 3-5 1.5-1 3-1 4 0 1 1 2 3 2 5 0 3-2 5-5 5s-4-2-4-5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 7c.5-1 1.5-2 3-2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Burger = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="15" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const Icons = {
  Rabbit,
  Burger,
};

export default Icons;
