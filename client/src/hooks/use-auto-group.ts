import { useState, useRef } from "react";
import { api } from "@shared/routes";
import type { FileItem } from "@/hooks/use-staged-images";

export type AutoGroupMode = "default" | "variant-family";

export interface AutoGroupResult {
  label: string;
  imageIndices: number[];
  confidence: "high" | "medium" | "low";
}

export interface UseAutoGroupReturn {
  startGrouping: (files: FileItem[], productContext?: string, mode?: AutoGroupMode) => void;
  isGrouping: boolean;
  groups: AutoGroupResult[];
  totalGroups: number | null;
  error: string | null;
  cancel: () => void;
}

/**
 * Resize an image to max 1024px on longest side, returning a JPEG blob.
 * If the image is already small enough, returns the original file as-is.
 */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (Math.max(width, height) <= 1024) {
    bitmap.close();
    return file;
  }

  const scale = 1024 / Math.max(width, height);
  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);

  const canvas = new OffscreenCanvas(newW, newH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
}

/**
 * Convert a Blob to a base64 data string (without the data URL prefix).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip "data:...;base64," prefix
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function buildAutoGroupImagePayloads(files: File[]) {
  return Promise.all(
    files.map(async (file, index) => {
      const resized = await resizeImage(file);
      const base64 = await blobToBase64(resized);
      const mimeType = resized instanceof File ? resized.type : "image/jpeg";

      return {
        index,
        base64,
        mimeType,
        filename: file.name,
      };
    }),
  );
}

export async function requestAutoGroup(
  files: File[],
  productContext?: string,
  mode: AutoGroupMode = "default",
  options?: {
    signal?: AbortSignal;
    onGroup?: (group: AutoGroupResult) => void;
    onDone?: (totalGroups: number) => void;
  },
): Promise<AutoGroupResult[]> {
  const imagePayloads = await buildAutoGroupImagePayloads(files);

  const res = await fetch(api.images.autoGroup.path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildAutoGroupRequestPayload(imagePayloads, productContext, mode)),
    signal: options?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Auto-grouping failed (${res.status}): ${text}`);
  }

  if (!res.body) {
    throw new Error("Auto-grouping failed: empty response body");
  }

  const groups: AutoGroupResult[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      const json = JSON.parse(dataLine.slice(6));
      if (json.type === "group") {
        groups.push(json.group);
        options?.onGroup?.(json.group);
      } else if (json.type === "done") {
        options?.onDone?.(json.totalGroups);
      } else if (json.type === "error") {
        throw new Error(json.message || "Auto-grouping failed");
      }
    }
  }

  return groups;
}

export function useAutoGroup(): UseAutoGroupReturn {
  const [isGrouping, setIsGrouping] = useState(false);
  const [groups, setGroups] = useState<AutoGroupResult[]>([]);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function cancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsGrouping(false);
  }

  function startGrouping(files: FileItem[], productContext?: string, mode: AutoGroupMode = "default") {
    // Reset state
    setIsGrouping(true);
    setGroups([]);
    setTotalGroups(null);
    setError(null);

    // Abort any previous request
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        await requestAutoGroup(
          files.map((item) => item.file),
          productContext,
          mode,
          {
            signal: controller.signal,
            onGroup: (group) => setGroups((prev) => [...prev, group]),
            onDone: (groupCount) => setTotalGroups(groupCount),
          },
        );

        setIsGrouping(false);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — silently stop
          return;
        }
        setError(
          err instanceof Error ? err.message : "Auto-grouping failed"
        );
        setIsGrouping(false);
      }
    })();
  }

  return {
    startGrouping,
    isGrouping,
    groups,
    totalGroups,
    error,
    cancel,
  };
}

export function buildAutoGroupRequestPayload(
  images: Array<{ index: number; base64: string; mimeType: string; filename: string }>,
  productContext?: string,
  mode: AutoGroupMode = "default",
) {
  return {
    images,
    productContext: productContext || undefined,
    mode,
  };
}
