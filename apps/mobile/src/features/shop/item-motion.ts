import {
  Easing,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

export const shoppingItemMove = LinearTransition.duration(140)
  .easing(Easing.bezier(0.77, 0, 0.175, 1))
  .reduceMotion(ReduceMotion.System);
