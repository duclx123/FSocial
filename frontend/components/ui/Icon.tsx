import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  User,
  Mail,
  Lock,
  LogOut,
  Home,
  Users,
  Bell,
  Search,
  X,
  ChevronDown,
  Settings,
  Trash2,
  Edit,
  Send,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  LucideProps
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  heart: Heart,
  comment: MessageCircle,
  share: Share2,
  more: MoreHorizontal,
  user: User,
  mail: Mail,
  lock: Lock,
  logout: LogOut,
  home: Home,
  users: Users,
  bell: Bell,
  search: Search,
  close: X,
  chevronDown: ChevronDown,
  settings: Settings,
  trash: Trash2,
  edit: Edit,
  send: Send,
  image: ImageIcon,
  check: CheckCircle,
  alert: AlertCircle,
  loader: Loader2,
  sparkles: Sparkles,
};

export type IconName = keyof typeof icons;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
  className?: string;
}

export function Icon({ name, className, size = 20, ...props }: IconProps) {
  const LucideIcon = icons[name];
  
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <LucideIcon 
      size={size} 
      className={cn("transition-colors duration-200", className)} 
      {...props} 
    />
  );
}
