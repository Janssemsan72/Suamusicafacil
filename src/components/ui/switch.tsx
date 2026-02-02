import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center border-0 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    checked={checked}
    style={{
      height: '26px',
      width: '44px',
      minWidth: '44px',
      minHeight: '26px',
      borderRadius: '13px',
      backgroundColor: checked ? '#34c759' : '#e5e5ea',
      fontSize: '0',
      lineHeight: '0',
      padding: '2px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box',
      flexShrink: '0',
      cursor: 'pointer',
      pointerEvents: 'auto',
      zIndex: 10,
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full ring-0",
      )}
      style={{
        height: '22px',
        width: '22px',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none',
        transform: checked ? 'translateX(16px)' : 'translateX(0px)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
