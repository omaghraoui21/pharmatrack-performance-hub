import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Activity,
  LayoutDashboard,
  Users,
  FileText,
  CheckSquare,
  Trophy,
  Settings,
  LogOut,
  ChevronUp,
  Upload,
  ListChecks,
  Target,
  Users2,
} from 'lucide-react';

type AppRole = 'super_admin' | 'admin_site' | 'manager_unite' | 'superviseur' | 'readonly';

const MANAGER_ROLES: AppRole[] = ['manager_unite', 'admin_site', 'super_admin'];
const ALL_ACTIVE_ROLES: AppRole[] = ['superviseur', ...MANAGER_ROLES];
const ALL_ROLES: AppRole[] = ['readonly', ...ALL_ACTIVE_ROLES];

const navigationItems = [
  {
    title: 'Tableau de bord',
    url: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Opérateurs',
    url: '/operators',
    icon: Users,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Saisir un événement',
    url: '/events/new',
    icon: FileText,
    allowedRoles: ALL_ACTIVE_ROLES,
  },
  {
    title: 'File de validation',
    url: '/validation',
    icon: CheckSquare,
    allowedRoles: MANAGER_ROLES,
  },
  {
    title: 'Import CSV/Excel',
    url: '/import',
    icon: Upload,
    allowedRoles: MANAGER_ROLES,
  },
  {
    title: 'Grille de scoring',
    url: '/scoring',
    icon: ListChecks,
    allowedRoles: MANAGER_ROLES,
  },
  {
    title: 'Classement annuel',
    url: '/ranking',
    icon: Trophy,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Objectifs',
    url: '/objectives',
    icon: Target,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Classement hiérarchique',
    url: '/hierarchy-ranking',
    icon: Users2,
    allowedRoles: MANAGER_ROLES,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, appRoles, signOut } = useAuth();

  const filteredNavItems = navigationItems.filter((item) =>
    appRoles.some((role) => item.allowedRoles.includes(role))
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayRole = () => {
    if (appRoles.includes('super_admin')) return 'Super Admin';
    if (appRoles.includes('admin_site')) return 'Admin Site';
    if (appRoles.includes('manager_unite')) return 'Manager Unité';
    if (appRoles.includes('superviseur')) return 'Superviseur';
    if (appRoles.includes('readonly')) return 'Lecture seule';
    return profile?.role === 'manager' ? 'Manager' : 'Superviseur';
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-primary">
            <Activity className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sidebar-foreground">PharmaTrack</h2>
            <p className="text-xs text-sidebar-foreground/70">Performance</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">
                      {profile?.full_name || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/70">
                      {displayRole()}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
