import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
}

const getVariantClasses = (variant: string) => {
  switch (variant) {
    case 'destructive':
      return 'bg-red-500 text-white hover:bg-red-600';
    case 'outline':
      return 'border border-gray-300 bg-transparent hover:bg-gray-50';
    case 'secondary':
      return 'bg-gray-100 text-gray-900 hover:bg-gray-200';
    case 'ghost':
      return 'hover:bg-gray-100';
    case 'link':
      return 'text-blue-600 underline-offset-4 hover:underline';
    default:
      return 'bg-blue-600 text-white hover:bg-blue-700';
  }
};

const getSizeClasses = (size: string) => {
  switch (size) {
    case 'sm':
      return 'h-8 px-3 text-sm';
    case 'lg':
      return 'h-11 px-8';
    case 'icon':
      return 'h-10 w-10';
    default:
      return 'h-10 px-4 py-2';
  }
};

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'default', 
  size = 'default', 
  className = '', 
  children, 
  ...props 
}) => {
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);
  
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};