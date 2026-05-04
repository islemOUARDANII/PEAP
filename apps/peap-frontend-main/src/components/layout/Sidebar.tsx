import { NavLink } from '@/components/NavLink';
import { navByRole } from '@/config/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@/models';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
  ShieldCheck,
} from 'lucide-react';
import myImage from '@/assets/ANETI-RAW-LOGO-SYM.png';
interface SidebarProps {
  role: Role;
}
interface NavLeaf {
  to: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  tooltip?: string;
}
interface NavParent {
  label: string;
  icon: LucideIcon;
  tooltip?: string;
  children: NavLeaf[];
}
type NavItem = (NavLeaf & { icon: LucideIcon }) | NavParent;

interface NavGroup {
  label: string;
  items: NavItem[];
}

const roleProfile: Record<Role, { name: string; email: string }> = {
  candidate: {
    name: 'Candidat',
    email: 'candidate@aneti.tn',
  },
  provider: {
    name: 'Employeur',
    email: 'employeur@aneti.tn',
  },
  advisor: {
    name: 'Conseiller',
    email: 'advisor@aneti.tn',
  },
  functionalAdmin: {
    name: 'Admin fonctionnel',
    email: 'functional.admin@aneti.tn',
  },
  techAdmin: {
    name: 'Admin technique',
    email: 'tech.admin@aneti.tn',
  },
};

const isParent = (i: NavItem): i is NavParent => 'children' in i;
const OPEN_PARENT_KEY = 'sidebar:openParent';
export function Sidebar({ role }: SidebarProps) {
  const config = navByRole[role];
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const profile = roleProfile[role];
  const initials = profile.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2);

  const findActiveParent = () => {
    for (const g of config.groups) {
      for (const it of g.items) {
        if (
          isParent(it) &&
          it.children.some((c) => pathname.startsWith(c.to))
        ) {
          return it.label;
        }
      }
    }
    return null;
  };

  // Single-section accordion: only one parent open at a time. Persist across reloads.
  const [openParent, setOpenParent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${OPEN_PARENT_KEY}:${role}`) ?? null;
  });

  useEffect(() => {
    const active = findActiveParent();
    if (active) setOpenParent(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (openParent)
      localStorage.setItem(`${OPEN_PARENT_KEY}:${role}`, openParent);
    else localStorage.removeItem(`${OPEN_PARENT_KEY}:${role}`);
  }, [openParent, role]);
  return (
    <ShadSidebar
      collapsible="icon"
      className="border-r border-sidebar-border [&>[data-sidebar=sidebar]]:bg-sidebar [&>[data-sidebar=sidebar]]:text-sidebar-foreground transition-[width] duration-300 ease-in-out"
    >
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-1 h-12">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md ">
            <img
              src={myImage}
              alt="Logo"
              className="flex h-7 w-7 object-contain object-left"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden animate-fade-in">
              <span className="text-sm font-semibold text-white tracking-tight truncate">
                ANETI
              </span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 truncate">
                {config.brand}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar scrollbar-thin gap-0">
        {config.groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  if (!isParent(item)) {
                    const active = pathname === item.to;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn(
                            'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                            'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
                          )}
                        >
                          <NavLink
                            to={item.to}
                            end
                            className={cn(
                              'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                              'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
                            )}
                            activeClassName="!bg-white/10 !text-white shadow-[inset_3px_0_0_hsl(var(--accent))]"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const isOpen = openParent === item.label;
                  const hasActiveChild = item.children.some((c) =>
                    pathname.startsWith(c.to),
                  );
                  const totalBadge = item.children.reduce(
                    (s, c) => s + (c.badge ?? 0),
                    0,
                  );

                  // Collapsed: render hover popover with submenu
                  if (collapsed) {
                    return (
                      <SidebarMenuItem key={item.label}>
                        <HoverCard openDelay={80} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <SidebarMenuButton
                              tooltip={item.tooltip ?? item.label}
                              isActive={hasActiveChild}
                              className={cn(
                                'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                                'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
                                hasActiveChild &&
                                  '!bg-white/10 !text-white shadow-[inset_3px_0_0_hsl(var(--accent))]',
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              {totalBadge > 0 && (
                                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                              )}
                            </SidebarMenuButton>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="right"
                            align="start"
                            sideOffset={8}
                            className="w-56 p-1.5 bg-sidebar text-sidebar-foreground border-sidebar-border"
                          >
                            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                              {item.label}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {item.children.map((child) => {
                                const childActive =
                                  pathname === child.to ||
                                  pathname.startsWith(child.to + '/');
                                return (
                                  <NavLink
                                    key={child.to}
                                    to={child.to}
                                    className={cn(
                                      'flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white transition-colors',
                                      childActive &&
                                        'bg-sidebar-accent text-white font-semibold',
                                    )}
                                  >
                                    <span>{child.label}</span>
                                    {child.badge != null && (
                                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-semibold text-sidebar-primary-foreground">
                                        {child.badge}
                                      </span>
                                    )}
                                  </NavLink>
                                );
                              })}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <Collapsible
                      key={item.label}
                      open={isOpen}
                      onOpenChange={(o) => setOpenParent(o ? item.label : null)}
                      asChild
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.tooltip ?? item.label}
                            className={cn(
                              'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white',
                              hasActiveChild && 'text-white',
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-left">
                              {item.label}
                            </span>
                            {totalBadge > 0 && !isOpen && (
                              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-semibold text-sidebar-primary-foreground">
                                {totalBadge}
                              </span>
                            )}
                            <ChevronRight
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                                isOpen && 'rotate-90',
                              )}
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                          <SidebarMenuSub className="border-sidebar-border/60">
                            {item.children.map((child) => {
                              const childActive =
                                pathname === child.to ||
                                pathname.startsWith(child.to + '/');
                              return (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={childActive}
                                    className={cn(
                                      'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white',
                                      'data-[active=true]:bg-sidebar-accent data-[active=true]:text-white data-[active=true]:font-semibold',
                                    )}
                                  >
                                    <NavLink
                                      to={child.to}
                                      className={cn(
                                        'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                                        'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
                                      )}
                                      activeClassName="!bg-white/10 !text-white shadow-[inset_3px_0_0_hsl(var(--accent))]"
                                    >
                                      <span className="flex-1">
                                        {child.label}
                                      </span>
                                      {child.badge != null && (
                                        <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sidebar-primary/90 px-1 text-[10px] font-semibold text-sidebar-primary-foreground">
                                          {child.badge}
                                        </span>
                                      )}
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {/* <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {config.groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === `/${role}`}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                      'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
                    )}
                    activeClassName="!bg-white/10 !text-white shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav> */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={
                collapsed
                  ? 'Expand sidebar (Ctrl+B)'
                  : 'Collapse sidebar (Ctrl+B)'
              }
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                'text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white',
              )}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
              <span>Collapse</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadSidebar>
  );
}
