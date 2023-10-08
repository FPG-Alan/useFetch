export type DBRecord = {
  id: number;
  [key: string]: unknown;
};
const db: Map<string, Map<number, DBRecord>> = new Map();

function insert(tableName: string, record: DBRecord) {
  if (!db.get(tableName)) {
    db.set(tableName, new Map());
  }

  const table = db.get(tableName)!;

  if (!table.get(record.id)) {
    table.set(record.id, record);
  }
}

export { insert };
