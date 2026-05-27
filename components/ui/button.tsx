'use client'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary:   'bg-[#1f1683] text-white hover:bg-[#1a1270] focus-visible:ring-[#1f1683]',
        accent:    'bg-[#17e4a1] text-[#041b70] hover:bg-[#04b788] focus-visible:ring-[#17e4a1]',
        outline:   'border border-[#e2e8f0] bg-white text-[#1e293b] hover:bg-[#f8fafc] focus-visible:ring-[#1f1683]',
        ghost:     'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] focus-visible:ring-[#1f1683]',
        danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        secondary: 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] focus-visible:ring-[#1f1683]',
      },
      size: {
        sm:   'h-8  px-3 text-sm',
        md:   'h-9  px-4 text-sm',
        lg:   'h-10 px-5 text-base',
        icon: 'h-9  w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
