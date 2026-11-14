import { Button, Modal } from '@chpli2/ui';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive-action confirmation, built on the shared Modal. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
