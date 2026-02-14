import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TicketCard from './TicketCard';
import type { Ticket, TicketViewer } from '../../types';

interface SortableTicketCardProps {
  ticket: Ticket;
  onClick: (t: Ticket) => void;
  onLaunch: (id: number) => void;
  viewers?: TicketViewer[];
  draggingBy?: { userId: number; email: string } | null;
}

export default function SortableTicketCard({ ticket, onClick, onLaunch, viewers, draggingBy }: SortableTicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} onClick={onClick} onLaunch={onLaunch} viewers={viewers} draggingBy={draggingBy} />
    </div>
  );
}
