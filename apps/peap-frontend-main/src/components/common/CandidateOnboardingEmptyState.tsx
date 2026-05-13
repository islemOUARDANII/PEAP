import CandidateProfileOnboardingCard from '@/components/common/CandidateProfileOnboardingCard';
import { cn } from '@/lib/utils';

interface CandidateOnboardingEmptyStateProps {
  className?: string;
}

export function CandidateOnboardingEmptyState({
  className,
}: CandidateOnboardingEmptyStateProps) {
  return <CandidateProfileOnboardingCard className={cn(className)} />;
}
