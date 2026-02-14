import { useCallback, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { COLUMNS } from '../../constants';
import Column from './Column';
import { useTicketViewers, useDragAwareness } from '../../hooks/useCollaboration';
import type { Ticket, TicketViewer } from '../../types';

interface KanbanBoardProps {
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
  onLaunch: (id: number) => void;
  onCreateClick: () => void;
  onReorder?: (ticketIds: number[]) => void;
  hideEmptyCTA?: boolean;
}

export default function KanbanBoard({ tickets, onTicketClick, onLaunch, onCreateClick, onReorder, hideEmptyCTA }: KanbanBoardProps) {
  const { viewersMap, getViewers } = useTicketViewers();
  const { isDragging, startDragging, stopDragging } = useDragAwareness();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const backlogTickets = useMemo(
    () => tickets.filter(t => t.status === 'backlog'),
    [tickets],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticketId = Number(event.active.id);
    if (ticketId) startDragging(ticketId);
  }, [startDragging]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const ticketId = Number(event.active.id);
    if (ticketId) stopDragging(ticketId);

    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = backlogTickets.findIndex(t => t.id === active.id);
    const newIndex = backlogTickets.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(backlogTickets, oldIndex, newIndex);
    onReorder(reordered.map(t => t.id));
  }, [backlogTickets, onReorder, stopDragging]);
  // Find the "furthest" active step for the pipeline indicator
  const activeStatuses = new Set(tickets.map(t => t.status));
  const lastActiveIdx = COLUMNS.reduce((max, col, i) => activeStatuses.has(col.id) ? i : max, -1);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-x-auto flex flex-col">
      {/* Pipeline flow indicator */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center">
          {COLUMNS.map((col, i) => {
            const hasTickets = activeStatuses.has(col.id);
            const isPast = i <= lastActiveIdx;
            return (
              <div key={col.id} className="flex items-center flex-1 min-w-[140px]">
                <div className="flex flex-col items-center flex-1">
                  {/* Dot + line */}
                  <div className="flex items-center w-full">
                    {i > 0 && (
                      <div
                        className="flex-1 h-[2px] transition-all duration-500"
                        style={{
                          background: isPast
                            ? `linear-gradient(to right, ${COLUMNS[i - 1].color}60, ${col.color}60)`
                            : 'var(--color-border)',
                        }}
                      />
                    )}
                    <div
                      className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 transition-all duration-300 ${hasTickets ? 'scale-125 anim-dot-active' : ''}`}
                      style={{
                        backgroundColor: hasTickets ? col.color : 'transparent',
                        borderColor: isPast ? col.color : 'var(--color-border-strong)',
                        boxShadow: hasTickets ? `0 0 10px ${col.color}50` : 'none',
                        '--pulse-color': `${col.color}60`,
                      } as React.CSSProperties}
                    />
                    {i < COLUMNS.length - 1 && (
                      <div
                        className="flex-1 h-[2px] transition-all duration-500"
                        style={{
                          background: isPast && i < lastActiveIdx
                            ? `linear-gradient(to right, ${col.color}60, ${COLUMNS[i + 1].color}60)`
                            : 'var(--color-border)',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-0 flex-1 px-3 pb-3" data-onboard="columns">
        {COLUMNS.map((column, i) => {
          const columnTickets = tickets.filter(t => t.status === column.id);
          return (
            <div key={column.id} className="flex flex-1 min-w-[140px]">
              <Column
                column={column}
                tickets={columnTickets}
                onTicketClick={onTicketClick}
                onLaunch={onLaunch}
                onCreateClick={onCreateClick}
                stepNumber={i + 1}
                totalTickets={hideEmptyCTA ? -1 : tickets.length}
                getViewers={getViewers}
                isDragging={isDragging}
              />
              {i < COLUMNS.length - 1 && (
                <div className="w-px bg-th-border self-stretch my-2 opacity-50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
    </DndContext>
  );
}
