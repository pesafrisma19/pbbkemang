"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Accordion = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("", className)} {...props} />
    )
)
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("border-b", className)} {...props} />
    )
)
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, children, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </button>
    )
)
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
                className
            )}
            {...props}
        >
            <div className={cn("pb-4 pt-0", className)}>{children}</div>
        </div>
    )
)
AccordionContent.displayName = "AccordionContent"

// Simplified Accordion logic for this demo without full Radix
export function SimpleAccordion({
    items
}: {
    items: {
        id: string;
        title: React.ReactNode;
        content: React.ReactNode
    }[]
}) {
    const [openItem, setOpenItem] = React.useState<string | null>(null);

    const toggle = (id: string) => {
        setOpenItem(openItem === id ? null : id);
    }

    return (
        <div className="w-full space-y-2">
            {items.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card text-card-foreground shadow-sm px-4">
                    <button
                        onClick={() => toggle(item.id)}
                        className="flex flex-1 w-full items-center justify-between py-4 font-medium transition-all [&>svg]:rotate-0"
                    >
                        {item.title}
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 shrink-0 transition-transform duration-200",
                                openItem === item.id ? "rotate-180" : ""
                            )}
                        />
                    </button>

                    <div
                        className={cn(
                            "grid transition-all duration-300 ease-in-out",
                            openItem === item.id ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
                        )}
                    >
                        <div className="overflow-hidden">
                            {item.content}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
