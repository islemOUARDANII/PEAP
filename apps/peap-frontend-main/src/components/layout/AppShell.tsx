import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Role } from '@/models';

interface AppShellProps {
  role: Role;
}

export function AppShell({ role }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
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
