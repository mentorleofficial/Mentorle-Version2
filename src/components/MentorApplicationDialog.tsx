import { Dialog, DialogContent } from "@/components/ui/dialog";
import MentorApplicationForm from "@/components/MentorApplicationForm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MentorApplicationDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <MentorApplicationForm onComplete={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default MentorApplicationDialog;
