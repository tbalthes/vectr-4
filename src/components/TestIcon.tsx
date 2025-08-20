import { CategoryIcon } from "./private/transactions/enhanced_table/CategoryIcon";

export function TestIcon() {
  const testIconNames = [
    "car-alt",
    "eye",
    "store",
    "hand-sparkles",
    "burger",
    "plane",
    "credit-card",
    "file-invoice-dollar",
    "utensils",
    "dollar-sign",
    "file-invoice",
    "receipt",
    "banknote-arrow-up",
    "invalid-icon-name" // This should fallback to Package icon
  ];

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Icon Test</h2>
      <div className="grid grid-cols-3 gap-4">
        {testIconNames.map((iconName, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border rounded">
            <CategoryIcon iconName={iconName} />
            <span>{iconName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}