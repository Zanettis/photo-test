import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva("rounded-2xl bg-zinc-900", {
  variants: {
    variant: {
      default: "border border-zinc-800",
      ghost: "",
    },
    padding: {
      none: "",
      sm: "p-3",
      default: "p-4",
      lg: "p-5",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
  },
})

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, padding, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
}

export { Card, cardVariants }
