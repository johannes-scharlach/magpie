type Point = { x: number; y: number };

/** Points are relative to the wheel's center; positive degrees turn clockwise. */
export function rotationDelta(from: Point, to: Point): number {
  "worklet";
  if (Math.hypot(from.x, from.y) < 1 || Math.hypot(to.x, to.y) < 1) return 0;
  return (
    (Math.atan2(from.x * to.y - from.y * to.x, from.x * to.x + from.y * to.y) *
      180) /
    Math.PI
  );
}

/** Tangential finger velocity in points/second becomes degrees/second. */
export function angularVelocity(at: Point, velocity: Point): number {
  "worklet";
  const radiusSquared = at.x * at.x + at.y * at.y;
  if (radiusSquared < 1) return 0;
  return (
    ((at.x * velocity.y - at.y * velocity.x) / radiusSquared) * (180 / Math.PI)
  );
}

export function isTangential(at: Point, movement: Point): boolean {
  "worklet";
  return (
    Math.abs(at.x * movement.y - at.y * movement.x) >
    Math.abs(at.x * movement.x + at.y * movement.y)
  );
}
