import React from 'react';
import { Construction } from 'lucide-react';

interface ComingSoonViewProps {
  moduleName: string;
  phase: string;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ moduleName, phase }) => {
  return (
    <div className="bg-card border border-border rounded-card p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-sm my-12">
      <div className="size-14 rounded-full bg-secondary flex items-center justify-center text-primary mb-4">
        <Construction className="size-7" />
      </div>
      <h2 className="font-serif font-semibold text-2xl text-foreground mb-2">
        Modul {moduleName}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Fitur ini dijadwalkan pada <strong>{phase}</strong> sesuai roadmap implementasi TASKS.md.
      </p>
      <span className="inline-flex items-center px-3 py-1 rounded-pill bg-muted text-muted-foreground text-xs font-semibold">
        Segera Hadir
      </span>
    </div>
  );
};
