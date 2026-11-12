/**
 * Linear undo/redo over serialised snapshots. Recording a snapshot equal to the
 * current one is a no-op, so re-applying an undone state never adds history.
 */
export class History {
  private stack: string[];
  private index = 0;

  constructor(
    initial: string,
    private limit = 100,
  ) {
    this.stack = [initial];
  }

  get current(): string {
    return this.stack[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** Returns true if a new entry was added. */
  record(snapshot: string): boolean {
    if (snapshot === this.current) return false;
    this.stack.splice(this.index + 1);
    this.stack.push(snapshot);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    return true;
  }

  undo(): string | null {
    if (!this.canUndo) return null;
    this.index--;
    return this.current;
  }

  redo(): string | null {
    if (!this.canRedo) return null;
    this.index++;
    return this.current;
  }
}
