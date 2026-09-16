"use client";

import { useCallback, useRef, useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileUp, GripVertical, X } from "lucide-react";

import { useFileStore, type FileItem } from "@/store/useFileStore";
import { validateFiles } from "@/lib/utils/fileValidation";
import { bytesToSize } from "@/lib/utils/download";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  /** MIME types, contoh: ["application/pdf"] atau ["image/jpeg", "image/png"] */
  accept: string[];
  multiple?: boolean;
  maxSizeMB?: number;
  hint?: string;
  /** Drag-reorder daftar file (urutan penting: merge, jpg→pdf). */
  sortable?: boolean;
}

export function FileDropzone({
  accept,
  multiple = true,
  maxSizeMB = 200,
  hint,
  sortable = false,
}: FileDropzoneProps) {
  const { files, addFiles, removeFile, reorderFiles } = useFileStore();
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const { valid, errors: errs } = validateFiles(list, accept, maxSizeMB);
      setErrors(errs);
      if (valid.length) addFiles(valid, !multiple);
    },
    [accept, maxSizeMB, multiple, addFiles]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = files.findIndex((f) => f.id === active.id);
    const to = files.findIndex((f) => f.id === over.id);
    if (from >= 0 && to >= 0) reorderFiles(from, to);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver
            ? "border-primary bg-accent"
            : "border-border bg-white hover:border-primary/60 hover:bg-accent/40"
        )}
      >
        <FileUp className="h-8 w-8 text-primary" />
        <p className="text-sm font-medium text-foreground">
          Seret file ke sini, atau klik untuk memilih
        </p>
        <p className="text-xs text-muted-foreground">
          {hint ?? `Format: ${accept.join(", ")} • maks ${maxSizeMB} MB`}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept.join(",")}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {files.length > 0 &&
        (sortable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={files.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {files.map((item) => (
                  <SortableFileItem
                    key={item.id}
                    item={item}
                    onRemove={() => removeFile(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="flex flex-col gap-2">
            {files.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm shadow-soft"
              >
                <span className="truncate font-medium">{item.file.name}</span>
                <span className="tnum shrink-0 text-xs text-muted-foreground">
                  {bytesToSize(item.file.size)}
                </span>
                <button
                  onClick={() => removeFile(item.id)}
                  aria-label={`Hapus ${item.file.name}`}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ))}

      {sortable && files.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Seret item untuk mengubah urutan (urutan = urutan hasil).
        </p>
      )}
    </div>
  );
}

function SortableFileItem({
  item,
  onRemove,
}: {
  item: FileItem;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-2.5 text-sm shadow-soft",
        isDragging ? "border-primary opacity-70" : "border-border"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={`Seret untuk mengurutkan ${item.file.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="truncate font-medium">{item.file.name}</span>
      </span>
      <span className="tnum shrink-0 text-xs text-muted-foreground">
        {bytesToSize(item.file.size)}
      </span>
      <button
        onClick={onRemove}
        aria-label={`Hapus ${item.file.name}`}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
