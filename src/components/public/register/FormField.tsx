import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FormField({
  id,
  label,
  type,
  placeholder,
  required = false,
  value,
  onChange,
}: FormFieldProps) {
  return (
    <div className="grid gap-3">
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        className="bg-input border-border text-foreground font-sans"
        style={{ fontSize: "14px", fontWeight: "var(--font-weight-normal)" }}
        required={required}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
