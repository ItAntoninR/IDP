import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Alert } from "./Alert.vue";
export { default as AlertDescription } from "./AlertDescription.vue";
export { default as AlertTitle } from "./AlertTitle.vue";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "text-destructive bg-red-50 border-red-200 [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
        success: "text-emerald-800 bg-emerald-50 border-emerald-200 *:data-[slot=alert-description]:text-emerald-800/90",
        info: "text-sky-800 bg-sky-50 border-sky-200 *:data-[slot=alert-description]:text-sky-800/90",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
