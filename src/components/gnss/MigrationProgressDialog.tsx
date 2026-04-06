import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface MigrationProgressDialogProps {
  open: boolean;
  progress: { stage: string; percent: number; message: string };
}

export function MigrationProgressDialog({ open, progress }: MigrationProgressDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Migrating GNSS Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Progress value={progress.percent} />
          <p className="text-sm text-muted-foreground">{progress.message}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
