/**
 * Shared drag-and-drop primitives for the admin.
 *
 * Wraps dnd-kit so every sortable surface (table rows, sidebar, page blocks,
 * media) behaves identically: keyboard accessible, 6px activation distance so
 * clicks still register on buttons inside a row, and a grab handle rather than
 * whole-row dragging.
 */
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";

export { arrayMove };

/**
 * @param items   array of objects each with an `id`
 * @param onReorder(nextItems) called with the reordered array
 */
export function SortableList({ items, onReorder, children, grid = false }) {
  const sensors = useSensors(
    // Distance threshold: without it, a mousedown on an Edit button inside a
    // draggable row starts a drag instead of clicking.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Render-prop row. Gives you `handleProps` to spread onto your own grab handle
 * so the rest of the row stays clickable.
 */
export function SortableItem({ id, children, as: Tag = "div", className = "" }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <Tag ref={setNodeRef} style={style} className={className} data-dragging={isDragging}>
      {typeof children === "function"
        ? children({ handleProps: { ...attributes, ...listeners }, isDragging })
        : children}
    </Tag>
  );
}

/** The standard grab affordance. Spread `handleProps` from SortableItem. */
export function DragHandle({ handleProps, className = "" }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      {...handleProps}
      className={`cursor-grab active:cursor-grabbing text-[var(--ink-soft)] hover:text-[var(--ink)] touch-none ${className}`}
    >
      <DotsSixVertical size={16} weight="bold" />
    </button>
  );
}
