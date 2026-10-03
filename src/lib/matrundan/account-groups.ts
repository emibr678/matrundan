/** Session-bound membership reads. No data survives an account transition. */
export type GroupsSnapshot<T> = {
  userId: string | null;
  epoch: number;
  resolved: boolean;
  status: "idle" | "loading" | "ready" | "error";
  groups: T[];
};

export class AccountGroups<T> {
  private snapshot: GroupsSnapshot<T> = {
    userId: null,
    epoch: 0,
    resolved: false,
    status: "idle",
    groups: [],
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending: Promise<void> | null = null;

  constructor(private read: () => Promise<T[]>) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(snapshot: GroupsSnapshot<T>) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  setAccount(userId: string | null) {
    if (this.snapshot.userId === userId) return;
    this.generation += 1;
    this.pending = null;
    this.publish({
      userId,
      epoch: this.snapshot.epoch + 1,
      resolved: false,
      status: "idle",
      groups: [],
    });
  }

  load(force = false): Promise<void> {
    const { userId } = this.snapshot;
    if (!userId) return Promise.resolve();
    if (!force && this.pending) return this.pending;
    if (!force && this.snapshot.status === "ready") return Promise.resolve();
    const generation = ++this.generation;
    this.publish({ ...this.snapshot, status: "loading" });
    const pending = Promise.resolve()
      .then(this.read)
      .then(
        (groups) => {
          if (generation === this.generation)
            this.publish({ ...this.snapshot, userId, groups, resolved: true, status: "ready" });
        },
        (error: unknown) => {
          if (generation !== this.generation) return;
          console.error("[Matrundan] kunde inte läsa medlemskap:", error);
          this.publish({ ...this.snapshot, status: "error" });
        },
      )
      .finally(() => {
        if (generation === this.generation) this.pending = null;
      });
    this.pending = pending;
    return pending;
  }

  reset() {
    this.generation += 1;
    this.pending = null;
    this.publish({
      userId: null,
      epoch: this.snapshot.epoch + 1,
      resolved: false,
      status: "idle",
      groups: [],
    });
  }
}
