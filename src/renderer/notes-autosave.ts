export type NotesSavePayload = {
  contentJson: GarlicSauceNotesContentJson;
  plainText: string;
  slideId: number;
};

export type NotesSaveDebouncer = {
  cancel: () => void;
  flush: () => Promise<void>;
  schedule: (payload: NotesSavePayload) => void;
};

export function createNotesSaveDebouncer(
  save: (payload: NotesSavePayload) => Promise<void> | void,
  delayMs: number,
): NotesSaveDebouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingPayload: NotesSavePayload | undefined;

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
