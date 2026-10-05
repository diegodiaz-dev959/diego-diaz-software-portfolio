import type { DatabaseSync } from 'node:sqlite';
export class DomainError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const fail = (status: number, message: string): never => { throw new DomainError(status, message); };
export function text(value: unknown, label: string, max = 150): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${label}: texto de 1 a ${max} caracteres.`);
  return (value as string).trim();
}
export function integer(value: unknown, label: string, min = 0, max = 1000000): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(400, `${label}: entero entre ${min} y ${max}.`);
  return value as number;
}
export function tx<T>(db: DatabaseSync, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function audit(db: DatabaseSync, project: string, entity: string, action: string, detail: unknown, now: number) {
  db.prepare('INSERT INTO audit(project,entity,action,detail,created_at) VALUES(?,?,?,?,?)').run(project, entity, action, JSON.stringify(detail), now);
}
