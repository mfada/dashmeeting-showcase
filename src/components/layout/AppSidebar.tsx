import {
  LayoutDashboard,
  FolderKanban,
  Download,
  Users,
  Settings,
  LogOut,
  CalendarDays,
  Globe,
  MessageSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useUnassignedMeetingsCount } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import rbiLogo from "@/assets/rbi-logo.jpeg";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItemKeys = [
  { key: "dashboard" as const, url: "/", icon: LayoutDashboard },
  { key: "projects" as const, url: "/projects", icon: FolderKanban },
  { key: "meetings" as const, url: "/meetings", icon: MessageSquare },
  { key: "calendar" as const, url: "/calendar", icon: CalendarDays },
  { key: "imports" as const, url: "/imports", icon: Download },
];

const adminItemKeys = [
  { key: "users" as const, url: "/users", icon: Users },
  { key: "settings" as const, url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, isAdmin, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { data: unassignedCount } = useUnassignedMeetingsCount();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const toggleLang = () => setLang(lang === "en" ? "es" : "en");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <img src={rbiLogo} alt="RBI Private Lending" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">RBI Private Lending</span>
              <span className="text-[10px] text-sidebar-foreground/50">{t.sidebar.meetingIntelligence}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">{t.sidebar.main}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItemKeys.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={t.sidebar[item.key]}>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t.sidebar[item.key]}</span>}
                      {item.key === "meetings" && (unassignedCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-[10px] font-semibold">
                          {unassignedCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">{t.sidebar.admin}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItemKeys.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={t.sidebar[item.key]}>
                      <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{t.sidebar[item.key]}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {/* Language toggle */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={`${collapsed ? "w-full" : "w-full justify-start gap-2"} text-sidebar-foreground/60 hover:text-sidebar-foreground`}
          onClick={toggleLang}
        >
          <Globe className="h-3.5 w-3.5" />
          {!collapsed && <span className="text-xs uppercase">{lang === "en" ? "ES" : "EN"}</span>}
        </Button>

        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-sidebar-foreground">{profile?.full_name ?? "User"}</span>
                <span className="text-[10px] text-sidebar-foreground/50">{isAdmin ? "Admin" : t.users.user}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
