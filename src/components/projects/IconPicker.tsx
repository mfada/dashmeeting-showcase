import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Smile,
  Folder, Briefcase, Rocket, Zap, Heart, Star, Target, Flag,
  Globe, Building, Code, Database, Cpu, Shield, Book, PenTool,
  LayoutDashboard, BarChart2, PieChart, Users, User, MessageCircle,
  Mail, Phone, Camera, Image, Music, Video, Monitor, Smartphone,
  Cloud, Sun, Moon, Settings, Wrench, Key, Lock,
  ShoppingCart, CreditCard, DollarSign, TrendingUp, Award,
  Gift, Calendar, Clock, MapPin, Compass, Navigation, Truck,
  FileText, Clipboard, CheckSquare, Bell, Bookmark, Home,
  Package, Layers, Terminal, GitBranch, Wifi, Battery,
} from "lucide-react";

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder, briefcase: Briefcase, rocket: Rocket, zap: Zap,
  heart: Heart, star: Star, target: Target, flag: Flag,
  globe: Globe, building: Building, code: Code, database: Database,
  cpu: Cpu, shield: Shield, book: Book, "pen-tool": PenTool,
  layout: LayoutDashboard, "bar-chart": BarChart2, "pie-chart": PieChart,
  users: Users, user: User, "message-circle": MessageCircle,
  mail: Mail, phone: Phone, camera: Camera, image: Image,
  music: Music, video: Video, monitor: Monitor, smartphone: Smartphone,
  cloud: Cloud, sun: Sun, moon: Moon, settings: Settings,
  wrench: Wrench, key: Key, lock: Lock,
  "shopping-cart": ShoppingCart, "credit-card": CreditCard,
  "dollar-sign": DollarSign, "trending-up": TrendingUp, award: Award,
  gift: Gift, calendar: Calendar, clock: Clock, "map-pin": MapPin,
  compass: Compass, navigation: Navigation, truck: Truck,
  "file-text": FileText, clipboard: Clipboard, "check-square": CheckSquare,
  bell: Bell, bookmark: Bookmark, home: Home, package: Package,
  layers: Layers, terminal: Terminal, "git-branch": GitBranch,
  wifi: Wifi, battery: Battery,
};

const ALL_ICON_NAMES = Object.keys(ICON_MAP);

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
}

export function ProjectIcon({ name, className = "h-4 w-4" }: { name: string | null | undefined; className?: string }) {
  if (!name || !(name in ICON_MAP)) return null;
  const Icon = ICON_MAP[name];
  return <Icon className={className} />;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const icons = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES;
    const q = search.toLowerCase();
    return ALL_ICON_NAMES.filter(n => n.includes(q));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          {value ? <ProjectIcon name={value} className="h-4 w-4" /> : <Smile className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs">{value ? value : "Pick icon"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {value && (
            <button
              className="h-8 w-8 flex items-center justify-center rounded text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { onChange(null); setOpen(false); }}
              title="Remove icon"
            >
              ✕
            </button>
          )}
          {icons.map(name => {
            const Icon = ICON_MAP[name];
            return (
              <button
                key={name}
                className={`h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors ${value === name ? "bg-primary/10 text-primary" : ""}`}
                onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                title={name}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        {icons.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No icons found</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
