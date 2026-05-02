import { Loader2 } from 'lucide-react';

const LoadingCard = ({ text }: { text: string }) => {
  return (
    <div className="panel p-6 text-sm text-muted-foreground card-border-20 flex gap-2 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {text}
      </p>
    </div>
  );
};

export default LoadingCard;
