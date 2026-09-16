"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Loader2, RotateCcw, Trash2 } from "lucide-react";

import { loadPdfDocument, renderPageToCanvas, yieldToMain } from "@/lib/pdf/preview";
import { cn } from "@/lib/utils";

interface PagePreviewGridProps {
  file: File;
  /** Multi-select halaman (extract / split). */
  selectable?: boolean;
  /** Drag-reorder halaman (organize). */
  sortable?: boolean;
  /** Tombol hapus per halaman (organize). */
  deletable?: boolean;
  /** Tombol aksi tambahan per halaman (contoh: putar). */
  pageActions?: (pageNumber: number) => React.ReactNode;
  onSelectionChange?: (pages: number[]) => void;
  onOrderChange?: (order: number[]) => void;
}

const THUMB_WIDTH = 160;

export function PagePreviewGrid({
  file,
  selectable = false,
  sortable = false,
  deletable = false,
  pageActions,
  onSelectionChange,
  onOrderChange,
}: PagePreviewGridProps) {
  const [total, setTotal] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [deleted, setDeleted] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dokumen + render thumbnail secara berurutan (jangan banjiri main thread).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTotal(0);
    setOrder([]);
    setDeleted([]);
    setSelected([]);
    setThumbnails(new Map());

    if (!file) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const doc = await loadPdfDocument(file);
        if (cancelled) {
          doc.destroy();
          return;
        }
        const n = doc.numPages;
        setTotal(n);
        setOrder(Array.from({ length: n }, (_, i) => i + 1));

        const map = new Map<number, string>();
        for (let p = 1; p <= n; p++) {
          if (cancelled) break;
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: 1 });
          const canvas = await renderPageToCanvas(
            doc,
            p,
            THUMB_WIDTH / viewport.width
          );
          map.set(p, canvas.toDataURL("image/jpeg", 0.8));
          if (p % 4 === 0) {
            setThumbnails(new Map(map));
            await yieldToMain();
          }
        }
        if (!cancelled) setThumbnails(map);
        doc.destroy();
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Gagal membaca PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const visible = order.filter((p) => !deleted.includes(p));
  const visibleKey = visible.join(",");
  const selectedKey = selected.join(",");

  useEffect(() => {
    onOrderChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  useEffect(() => {
    onSelectionChange?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const toggleSelect = (p: number) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const toggleDelete = (p: number) =>
    setDeleted((d) => (d.includes(p) ? d.filter((x) => x !== p) : [...d, p]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = visible.map(String);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setOrder(arrayMove(visible, from, to));
  };

  if (!file) return null;

  const grid = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {visible.map((p) => (
        <Thumb
          key={p}
          page={p}
          src={thumbnails.get(p)}
          selectable={selectable}
          sortable={sortable}
          selected={selected.includes(p)}
          deleted={false}
          actions={pageActions?.(p)}
          onClick={() => selectable && toggleSelect(p)}
          onDelete={() => deletable && toggleDelete(p)}
        />
      ))}
      {deleted.map((p) => (
        <Thumb
          key={`del-${p}`}
          page={p}
          src={thumbnails.get(p)}
          selectable={false}
          sortable={false}
          selected={false}
          deleted
          actions={undefined}
          onClick={() => {}}
          onDelete={() => toggleDelete(p)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pratinjau — <span className="tnum">{total}</span> halaman
        </p>
        <div className="flex items-center gap-2">
          {selectable && selected.length > 0 && (
            <span className="tnum rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              {selected.length} dipilih
            </span>
          )}
          {deletable && deleted.length > 0 && (
            <button
              onClick={() => setDeleted([])}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Pulihkan {deleted.length} halaman
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Merender pratinjau…
        </div>
      ) : (
        sortable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={visible.map(String)}
              strategy={rectSortingStrategy}
            >
              {grid}
            </SortableContext>
          </DndContext>
        ) : (
          grid
        )
      )}

      {sortable && visible.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Seret halaman untuk mengubah urutan.
        </p>
      )}
    </div>
  );
}

function Thumb({
  page,
  src,
  selectable,
  sortable,
  selected,
  deleted,
  actions,
  onClick,
  onDelete,
}: {
  page: number;
  src?: string;
  selectable: boolean;
  sortable: boolean;
  selected: boolean;
  deleted: boolean;
  actions?: React.ReactNode;
  onClick: () => void;
  onDelete: () => void;
}) {
  const inner = (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white shadow-soft",
        selectable && "cursor-pointer",
        deleted && "opacity-45 grayscale",
        selected
          ? "border-primary ring-2 ring-primary/60"
          : "border-border hover:border-primary/50"
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Halaman ${page}`}
          className="aspect-[3/4] w-full object-cover object-top"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted/30">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectable && selected && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
      {deleted && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          Dihapus
        </span>
      )}

      <div
        className="flex items-center justify-between border-t border-border bg-white px-2 py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="tnum text-xs font-medium text-muted-foreground">
          {page}
        </span>
        <span className="flex items-center gap-1">
          {actions}
          <button
            onClick={onDelete}
            aria-label={deleted ? "Pulihkan halaman" : "Hapus halaman"}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>
  );

  if (sortable) {
    return (
      <SortableThumb page={page} deleted={deleted}>
        {inner}
      </SortableThumb>
    );
  }
  return inner;
}

function SortableThumb({
  page,
  deleted,
  children,
}: {
  page: number;
  deleted: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(page) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && !deleted && "z-10 opacity-80")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
