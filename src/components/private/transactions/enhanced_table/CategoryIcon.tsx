import { 
  Utensils, 
  Car, 
  ShoppingBag, 
  Gamepad2, 
  Zap, 
  Heart, 
  DollarSign, 
  Package 
} from 'lucide-react';

interface CategoryIconProps {
  category: 'food-dining' | 'transportation' | 'shopping' | 'entertainment' | 'utilities' | 'healthcare' | 'income' | 'other';
  className?: string;
}

export function CategoryIcon({ category, className = "w-5 h-5" }: CategoryIconProps) {
  const icons = {
    'food-dining': Utensils,
    'transportation': Car,
    'shopping': ShoppingBag,
    'entertainment': Gamepad2,
    'utilities': Zap,
    'healthcare': Heart,
    'income': DollarSign,
    'other': Package
  };

  const Icon = icons[category] || Package;
  return <Icon className={className} />;
}