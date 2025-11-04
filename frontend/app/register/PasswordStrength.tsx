import { getPasswordStrength } from './validation';

interface PasswordStrengthProps {
  password: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;
  
  const { strength, score, color } = getPasswordStrength(password);
  
  const getBarWidth = () => {
    return `${(score / 6) * 100}%`;
  };
  
  const getBarColor = () => {
    if (color === 'red') return 'bg-red-500';
    if (color === 'yellow') return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  const getTextColor = () => {
    if (color === 'red') return 'text-red-600';
    if (color === 'yellow') return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">Password strength:</span>
        <span className={`text-xs font-medium ${getTextColor()}`}>
          {strength.charAt(0).toUpperCase() + strength.slice(1)}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: getBarWidth() }}
        />
      </div>
    </div>
  );
}
