/** Invitation and share paths contain a bearer secret. Keep it out of logs. */
export function loggablePath(path: string): string {
  return path.replace(/^\/(join|r)\/.*/, "/$1/:token");
}
