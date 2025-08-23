import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// The 'ChangeEvent' import has been removed as it is no longer needed.

// This interface accepts all standard input props (like name, type, value, onChange, etc.)
// in addition to the 'id' and 'label' we need for our custom component.
interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export function FormField({
  id,
  label,
  ...props // Gathers all other passed-in props (name, type, value, onChange, etc.)
}: FormFieldProps) {
  return (
    <div className="grid w-full items-center gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        className="bg-background text-foreground border-border focus-visible:ring-primary"
        // Spreads all the collected props (name, type, value, onChange) onto the Input
        {...props}
      />
    </div>
  );
}
