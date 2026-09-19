/**
 * Minimal in-browser stand-in for the parts of the Supabase client this app uses.
 * Data lives in localStorage. Only used when `DEMO_MODE` is 'true' (see config.ts).
 */

type Row = Record<string, any>;
type Db = Record<string, Row[]>;
type Result = { data: any; error: any };

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const STORAGE_KEY = 'kanban:demo-db';
const DEMO_USER = { id: DEMO_USER_ID, email: 'demo@example.com' };
const DEMO_SESSION = { access_token: 'demo', user: DEMO_USER };

const TABLES = [
  'kanban_boards',
  'kanban_columns',
  'kanban_cards',
  'kanban_categories',
  'kanban_board_members',
  'kanban_profiles',
];

// child table -> { parent table: fk column on child }, used for embedded selects and filters
const PARENTS: Record<string, Record<string, string>> = {
  kanban_columns: { kanban_boards: 'board_id' },
  kanban_cards: { kanban_columns: 'column_id', kanban_categories: 'category_id' },
  kanban_board_members: { kanban_boards: 'board_id', kanban_profiles: 'user_id' },
};
// parent table -> [child table, fk column on child], for cascading deletes
const CASCADE: Record<string, [string, string][]> = {
  kanban_boards: [
    ['kanban_columns', 'board_id'],
    ['kanban_board_members', 'board_id'],
  ],
  kanban_columns: [['kanban_cards', 'column_id']],
};

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function seed(): Db {
  const boardId = uuid();
  const cols = ['To Do', 'Doing', 'Done'].map((name, position) => ({
    id: uuid(),
    board_id: boardId,
    name,
    position,
    user_id: DEMO_USER_ID,
  }));
  const card = (col: number, position: number, title: string, description: string | null = null): Row => ({
    id: uuid(),
    column_id: cols[col].id,
    title,
    description,
    due_date: null,
    position,
    created_at: now(),
    category_id: null,
    user_id: DEMO_USER_ID,
  });
  return {
    kanban_boards: [
      { id: boardId, name: 'Demo board', owner_id: DEMO_USER_ID, user_id: DEMO_USER_ID, created_at: now() },
    ],
    kanban_columns: cols,
    kanban_cards: [
      card(0, 0, 'Try dragging a card', 'Demo data is stored in this browser only.'),
      card(0, 1, 'Add your own card'),
      card(1, 0, 'Create a category'),
      card(2, 0, 'Open the demo'),
    ],
    kanban_categories: [],
    kanban_board_members: [],
    kanban_profiles: [],
  };
}

let db: Db | null = null;

function load(): Db {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) db = JSON.parse(raw) as Db;
  } catch {
    /* corrupted or unavailable: fall through to seed */
  }
  if (!db) {
    db = seed();
    persist();
  }
  for (const t of TABLES) db[t] ??= [];
  return db;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota / private mode: keep in-memory only */
  }
}

export function resetDemoData(): void {
  db = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectExpr = '*';
  private payload: Row | Row[] = {};
  private filters: { col: string; test: (v: any) => boolean }[] = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private onConflict: string[] = [];

  constructor(private readonly table: string) {}

  select(expr = '*') {
    this.selectExpr = expr;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.onConflict = opts?.onConflict?.split(',').map((s) => s.trim()) ?? [];
    return this;
  }
  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ col, test: (v) => v === val });
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push({ col, test: (v) => vals.includes(v) });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending ?? true };
    return this;
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: Result;
    try {
      result = { data: this.run(), error: null };
    } catch (e) {
      result = { data: null, error: e };
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  /** Embedded resources in the select string, e.g. `kanban_columns!inner(board_id)`, `kanban_boards(*)`. */
  private embeds(): string[] {
    return [...this.selectExpr.matchAll(/(\w+)(?:!inner)?\(/g)].map((m) => m[1]);
  }

  private parentOf(row: Row, parentTable: string): Row | undefined {
    const fk = PARENTS[this.table]?.[parentTable];
    if (!fk) return undefined;
    const key = parentTable === 'kanban_profiles' ? 'user_id' : 'id';
    return load()[parentTable].find((p) => p[key] === row[fk]);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const [head, sub] = f.col.split('.');
      if (!sub) return f.test(row[head]);
      const parent = this.parentOf(row, head);
      return !!parent && f.test(parent[sub]);
    });
  }

  private project(row: Row): Row {
    const out = { ...row };
    for (const parentTable of this.embeds()) out[parentTable] = this.parentOf(row, parentTable) ?? null;
    return out;
  }

  private run(): any {
    const data = load();
    const rows = data[this.table];
    if (!rows) throw new Error(`Unknown table ${this.table}`);

    switch (this.op) {
      case 'select': {
        let out = rows.filter((r) => this.matches(r));
        const o = this.orderBy;
        if (o) {
          out = out
            .slice()
            .sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1));
        }
        return out.map((r) => this.project(r));
      }
      case 'insert':
      case 'upsert': {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const item of items) {
          const existing =
            this.op === 'upsert' && this.onConflict.length
              ? rows.find((r) => this.onConflict.every((k) => r[k] === item[k]))
              : undefined;
          if (existing) Object.assign(existing, item);
          else rows.push({ id: uuid(), created_at: now(), ...item });
        }
        persist();
        return null;
      }
      case 'update': {
        for (const r of rows.filter((r) => this.matches(r))) Object.assign(r, this.payload);
        persist();
        return null;
      }
      case 'delete': {
        const doomed = rows.filter((r) => this.matches(r));
        data[this.table] = rows.filter((r) => !doomed.includes(r));
        const ids = new Set(doomed.map((r) => r['id']));
        for (const [child, fk] of CASCADE[this.table] ?? []) {
          const q = new Query(child).delete().in(fk, [...ids]);
          q.run();
        }
        persist();
        return null;
      }
    }
  }
}

// Realtime stub: the demo has a single writer, and services update optimistically.
const noopChannel = {
  on() {
    return noopChannel;
  },
  subscribe() {
    return noopChannel;
  },
  unsubscribe() {
    return Promise.resolve('ok');
  },
};

export function createDemoClient() {
  return {
    from: (table: string) => new Query(table),
    channel: () => noopChannel,
    // Sharing needs real accounts: lookup finds nobody.
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
      getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    // Snapshots are cached in IndexedDB by snapshot-angular; there is no remote copy.
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: { statusCode: '404', message: 'not found' } }),
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  };
}
