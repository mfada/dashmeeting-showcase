import { Outlet, Link, useLocation } from "react-router-dom";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useUnassignedMeetingsCount } from "@/hooks/useSupabaseData";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  CalendarDays,
  Download,
  Globe,
  Users,
  Settings,
  LogOut,
  UserCircle,
  Clock,
} from "lucide-react";
import DashMeetingLogo from "@/assets/dashmeeting-logo.svg";

const navItems = [
  { key: "dashboard" as const, url: "/", icon: LayoutDashboard },
  { key: "projects" as const, url: "/projects", icon: FolderKanban },
  { key: "meetings" as const, url: "/meetings", icon: MessageSquare },
  { key: "calendar" as const, url: "/calendar", icon: CalendarDays },
  { key: "imports" as const, url: "/imports", icon: Download },
];

export function DashboardLayout() {
  const location = useLocation();
  const { profile, isAdmin, signOut, user } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { data: unassignedCount } = useUnassignedMeetingsCount();
  const { showWarning, stayLoggedIn } = useSessionTimeout(!!user);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const toggleLang = () => setLang(lang === "en" ? "es" : "en");

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="h-14 flex items-center border-b border-border bg-card px-4 lg:px-6 shrink-0 gap-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-4">
          <img src={DashMeetingLogo} alt="DashMeeting" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5" />
          <span className="text-sm font-bold text-foreground hidden sm:inline">DashMeeting</span>
        </Link>

        {/* Center: Navigation */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.key}
                to={item.url}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{t.sidebar[item.key]}</span>
                {item.key === "meetings" && (unassignedCount ?? 0) > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] font-semibold">
                    {unassignedCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile?.full_name ?? "User"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <UserCircle className="h-4 w-4" />
                {t.profile?.title ?? "Profile Settings"}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleLang} className="flex items-center gap-2 cursor-pointer">
              <Globe className="h-4 w-4" />
              {t.common.language}: {lang === "en" ? "Español" : "English"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/users" className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    {t.sidebar.users}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    {t.sidebar.settings}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer text-destructive">
              <LogOut className="h-4 w-4" />
              {lang === "en" ? "Sign Out" : "Cerrar Sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 overflow-auto p-5 lg:p-7">
        <Outlet />
      </main>

      <FloatingChatWidget />

      {/* Session timeout warning */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Session expiring soon
            </DialogTitle>
            <DialogDescription>
              Your session will expire in 2 minutes due to inactivity. Would you like to stay logged in?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={signOut} className="text-destructive hover:text-destructive">
              Sign out now
            </Button>
            <Button onClick={stayLoggedIn}>
              Stay logged in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
