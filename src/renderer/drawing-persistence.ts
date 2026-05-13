export type DrawingSavePayload = {
  canvasData: string;
  slideId: number;
};

export type DrawingSaveDebouncer = {
  cancel: () => void;
  flush: () => Promise<void>;
  schedule: (payload: DrawingSavePayload) => void;
};

export type DrawingSlideSyncRequest = {
  captureCanvasData: () => string | null;
  clearCanvas: () => void;
  isDirty: boolean;
  loadDrawing: (slideId: number) => Promise<string | null>;
  nextSlideId: number;
  previousSlideId: number | null;
  restoreDrawing: (canvasData: string) => Promise<void> | void;
  saveDrawing: (slideId: number, canvasData: string) => Promise<void> | void;
};

export function createDrawingSaveDebouncer(
  save: (payload: DrawingSavePayload) => Promise<void> | void,
  delayMs: number,
): DrawingSaveDebouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingPayload: DrawingSavePayload | undefined;

  const clearPendingTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const flush = async () => {
    clearPendingTimer();

    if (!pendingPayload) {
      return;
    }

    const payload = pendingPayload;
    pendingPayload = undefined;
    await save(payload);
  };

  return {
    cancel: () => {
      clearPendingTimer();
      pendingPayload = undefined;
    },
    flush,
    schedule: (payload) => {
      pendingPayload = payload;
      clearPendingTimer();
      timer = setTimeout(() => {
        void flush();
      }, delayMs);
    },
  };
}

export async function syncDrawingSlide(request: DrawingSlideSyncRequest): Promise<void> {
  if (
    request.previousSlideId !== null &&
    request.previousSlideId !== request.nextSlideId &&
    request.isDirty
  ) {
    const canvasData = request.captureCanvasData();

    if (canvasData) {
      await request.saveDrawing(request.previousSlideId, canvasData);
    }
  }

  request.clearCanvas();

  const nextCanvasData = await request.loadDrawing(request.nextSlideId);

  if (nextCanvasData) {
    await request.restoreDrawing(nextCanvasData);
  }
}
