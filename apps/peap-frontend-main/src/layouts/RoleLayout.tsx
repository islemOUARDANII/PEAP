import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import type { Role } from '@/models';
import { SidebarProvider } from '@/components/ui/sidebar';

interface RoleLayoutProps {
  role: Role;
}

export function RoleLayout({ role }: RoleLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background ">
        <Sidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col border-top-aneti-blue ">
          <Topbar role={role} />
          <main className="flex-1 px-4 sm:px-6 py-6 animate-fade-in">
            <div className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
