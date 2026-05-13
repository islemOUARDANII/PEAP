import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRouter } from '@/app/router';
import { queryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/auth';
import { LocaleProvider } from '@/i18n/LocaleProvider';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocaleProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRouter />
        </TooltipProvider>
      </AuthProvider>
    </LocaleProvider>
  </QueryClientProvider>
);

export default App;
