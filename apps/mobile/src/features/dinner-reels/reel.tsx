// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { Reel } from "./reel.android";

export type ReelProps = {
  /** The quality this reel sets, e.g. "Base". */
  label: string;
  /** Top to bottom; only values that lead somewhere. */
  values: readonly string[];
  value: string;
  /** Fires once the reel settles on another value. */
  onChange: (value: string) => void;
};
