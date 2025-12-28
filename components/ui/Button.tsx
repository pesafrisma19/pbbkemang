import * as React from "react"
import { cn } from "@/lib/utils"
// Note: We need to install @radix-ui/react-slot if we want polymorphism, or just simple React button. 
// For simplicity and speed without extra deps for now, standard button. 
// Actually standard shadcn uses slot. I'll stick to simple prop for now to avoid installing more unless needed.

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    {
                        'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
                        'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
                        'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'danger',
                        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
                        'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
                        'h-9 px-4 text-sm': size === 'sm',
                        'h-11 px-6 text-base': size === 'md',
                        'h-14 px-8 text-lg': size === 'lg',
                        'h-10 w-10': size === 'icon',
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
