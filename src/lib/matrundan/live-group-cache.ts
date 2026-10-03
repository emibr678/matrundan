import type { AppState } from "./types";

export class GroupReadError extends Error {
  constructor(public readonly accessDenied: boolean) {
    super(
      accessDenied ? "Du har inte längre tillgång till gruppen." : "Kunde inte läsa gruppens data.",
    );
  }
}

export interface LiveGroupRead {
  state: AppState;
  loadPhotos: (signal: AbortSignal) => Promise<AppState>;
  dispose: () => void;
}

type Snapshot = { state: AppState | null; error: string | null };
type Entry = {
  snapshot: Snapshot;
  updatedAt: number;
  generation: number;
  pending?: Promise<void>;
  controller?: AbortController;
  read?: LiveGroupRead;
};
const EMPTY: Snapshot = { state: null, error: null };
const MAX_GROUPS = 5;
const MAX_AGE_MS = 5 * 60 * 1000;

/** One instance per signed-in account; every cache use still revalidates on the server. */
export class LiveGroupCache {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private activeGroupId: string | null = null;

  constructor(
    private userId: string,
    private read: (groupId: string) => Promise<LiveGroupRead>,
    private now = Date.now,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish() {
    this.listeners.forEach((listener) => listener());
  }

  getSnapshot(groupId: string | null): Snapshot {
    if (!groupId) return EMPTY;
    const entry = this.entries.get(groupId);
    if (!entry) return EMPTY;
    if (
      groupId !== this.activeGroupId &&
      entry.snapshot.state &&
      this.now() - entry.updatedAt > MAX_AGE_MS
    )
      return EMPTY;
    return entry.snapshot;
  }

  activate(groupId: string | null) {
    if (groupId && groupId !== this.activeGroupId) {
      const entry = this.entries.get(groupId);
      if (entry && this.now() - entry.updatedAt > MAX_AGE_MS) this.remove(groupId);
    }
    this.activeGroupId = groupId;
    return groupId ? this.load(groupId) : Promise.resolve();
  }

  retain(groupIds: string[]) {
    const allowed = new Set(groupIds);
    for (const id of this.entries.keys()) if (!allowed.has(id)) this.remove(id);
  }

  private remove(groupId: string) {
    const entry = this.entries.get(groupId);
    if (!entry) return;
    entry.generation += 1;
    entry.controller?.abort();
    entry.read?.dispose();
    this.entries.delete(groupId);
    this.publish();
  }

  clear() {
    this.activeGroupId = null;
    for (const id of this.entries.keys()) this.remove(id);
  }

  invalidateOthers(groupId: string) {
    for (const id of this.entries.keys()) if (id !== groupId) this.remove(id);
  }

  load(groupId: string, force = false): Promise<void> {
    let entry = this.entries.get(groupId);
    if (!entry) {
      entry = { snapshot: EMPTY, updatedAt: 0, generation: 0 };
      this.entries.set(groupId, entry);
    }
    if (!force && entry.pending) return entry.pending;
    // Touch for bounded LRU retention.
    this.entries.delete(groupId);
    this.entries.set(groupId, entry);
    while (this.entries.size > MAX_GROUPS) this.remove(this.entries.keys().next().value!);
    if (groupId !== this.activeGroupId && this.now() - entry.updatedAt > MAX_AGE_MS) {
      entry.read?.dispose();
      entry.read = undefined;
      entry.snapshot = EMPTY;
    }
    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    const generation = ++entry.generation;
    const current = entry;
    const valid = () => this.entries.get(groupId) === current && current.generation === generation;
    current.snapshot = { ...current.snapshot, error: null };
    this.publish();

    const pending = this.read(groupId)
      .then((read) => {
        if (!valid()) {
          read.dispose();
          return;
        }
        if (read.state.currentUserId !== this.userId || read.state.group.id !== groupId) {
          read.dispose();
          throw new GroupReadError(true);
        }
        current.read?.dispose();
        current.read = read;
        current.updatedAt = this.now();
        current.snapshot = { state: read.state, error: null };
        this.publish();
        // Media never holds back the base snapshot or mutation acknowledgement.
        void read
          .loadPhotos(controller.signal)
          .then((state) => {
            if (!valid() || controller.signal.aborted) return;
            current.snapshot = { state, error: null };
            this.publish();
          })
          .catch(() => {
            // Keep the usable base state when an individual image cannot be delivered.
          });
      })
      .catch((error: unknown) => {
        if (!valid()) return;
        const denied = error instanceof GroupReadError && error.accessDenied;
        if (denied) {
          current.read?.dispose();
          current.read = undefined;
        }
        current.snapshot = {
          state: denied ? null : current.snapshot.state,
          error: error instanceof GroupReadError ? error.message : "Kunde inte läsa gruppens data.",
        };
        this.publish();
      })
      .finally(() => {
        if (valid()) current.pending = undefined;
      });
    current.pending = pending;
    return pending;
  }
}
