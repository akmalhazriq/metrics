import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = Boolean(indeterminate);
    }, [indeterminate]);

    return (
      <span
        className={cn(
          "border-input bg-background inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
          "has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary",
          "has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:outline-none",
          className,
        )}
      >
        <input ref={innerRef} type="checkbox" className="peer sr-only" {...props} />
        <Check className="hidden h-3 w-3 peer-checked:block" strokeWidth={3} />
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
