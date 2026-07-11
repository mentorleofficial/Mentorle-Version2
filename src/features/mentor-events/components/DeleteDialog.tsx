import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventTitle: string | undefined;
  isDeleting: boolean;
}

export default function DeleteDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  eventTitle, 
  isDeleting 
}: DeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Delete Event</DialogTitle>
          <DialogDescription className="pt-2">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{eventTitle}"</span>? 
            This action cannot be undone and will delete all associated participant registrations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
