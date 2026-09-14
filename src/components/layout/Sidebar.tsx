import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  UtensilsCrossed,
  Settings,
  Users,
  Target,
  LogOut,
  Briefcase,
  UserCircle,
  MessageCircle,
  Bell,
  Dumbbell,
  Menu,
  X,
  CalendarCheck,
  Newspaper,
  Shield,
  Compass,
  Star,
  Trophy,
  Video,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { FitSyncLogo } from "../FitSyncLogo";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useI18n } from "../../context/I18nContext";

interface NavItem {
  to: string;
  key: string;
  icon: typeof LayoutDashboard;
  proOnly?: boolean;
  ownerOnly?: boolean;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    labelKey: "nav.sectionMain",
    items: [
      { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
      { to: "/feed", key: "nav.feed", icon: Newspaper },
      { to: "/syncs", key: "nav.syncs", icon: Video },
      { to: "/explore", key: "nav.explore", icon: Compass },
      { to: "/reviews", key: "nav.reviews", icon: Star },
      { to: "/moderation", key: "nav.moderation", icon: Shield, ownerOnly: true },
    ],
  },
  {
    labelKey: "nav.sectionHealth",
    items: [
      { to: "/diary", key: "nav.diary", icon: BookOpen },
      { to: "/goals", key: "nav.goals", icon: Target },
      { to: "/workout", key: "nav.workout", icon: Dumbbell },
      { to: "/progress", key: "nav.progress", icon: TrendingUp },
      { to: "/recipes", key: "nav.recipes", icon: UtensilsCrossed },
    ],
  },
  {
    labelKey: "nav.sectionPro",
    items: [
      { to: "/team", key: "nav.team", icon: Users },
      { to: "/professional-profile", key: "nav.professionalProfile", icon: UserCircle, proOnly: true },
      { to: "/appointments", key: "nav.appointments", icon: CalendarCheck },
      { to: "/my-clients", key: "nav.myClients", icon: Users, proOnly: true },
      { to: "/messages", key: "nav.messages", icon: MessageCircle },
    ],
  },
  {
    labelKey: "nav.sectionAccount",
    items: [
      { to: "/my-profile", key: "nav.myProfile", icon: UserCircle },
      { to: "/achievements", key: "nav.achievements", icon: Trophy },
      { to: "/notifications", key: "nav.notifications", icon: Bell },
      { to: "/settings", key: "nav.settings", icon: Settings },
    ],
  },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function Sidebar() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "FitSync";
  const plan = profile?.plan === "pro" ? t("nav.planPro") : t("nav.planFree");
  const isPro = profile?.is_professional;
  const isOwner = profile?.role === "owner";

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (!item.proOnly || isPro) && (!item.ownerOnly || isOwner)),
    }))
    .filter((section) => section.items.length > 0);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const sidebarContent = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-edge-base bg-surface-card px-4 py-4">
      <header className="flex items-center gap-2.5 px-2 pb-6 pt-1">
        <FitSyncLogo size="sm" />
        <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-1.5 text-content-muted hover:bg-surface-subtle lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </header>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.labelKey} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              {t(section.labelKey)}
            </span>
            {section.items.map(({ to, key, icon: Icon }) => {
              const showBadge = to === "/notifications" && unreadCount > 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "bg-primary-50 text-primary-600" : "text-content-body hover:bg-surface-subtle hover:text-content-strong"
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {t(key)}
                  {showBadge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <footer className="border-t border-edge-base pt-4">
        <NavLink
          to="/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-subtle"
        >
          <Avatar className="h-9 w-9">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : (
              <AvatarFallback className="bg-primary-50 text-xs font-bold text-primary-700">{initials(displayName)}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-content-strong">{displayName}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-content-muted">{plan}</span>
              {isPro && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Briefcase className="h-2.5 w-2.5" />
                  PRO
                </span>
              )}
            </div>
          </div>
        </NavLink>
        <button
          onClick={handleSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-content-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </button>
      </footer>
    </aside>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-edge-base bg-surface-card px-4 py-3 lg:hidden">
        <FitSyncLogo size="sm" />
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-content-body hover:bg-surface-subtle">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="sidebar-mobile-enter absolute left-0 top-0 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
