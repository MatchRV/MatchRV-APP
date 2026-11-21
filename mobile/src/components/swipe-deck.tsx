// Swipe deck: pan right = save/like, pan left = pass. gesture-handler v3 hooks + Reanimated 4.
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { RvSummary } from '@/lib/models/rv';
import { Brand, Radius, Spacing, Type } from '@/theme';

import { SwipeCardContent } from './rv-card';

export type SwipeDirection = 'left' | 'right';

function TopCard({ rv, onSwiped, onOpen }: { rv: RvSummary; onSwiped: (dir: SwipeDirection) => void; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const threshold = width * 0.28;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY * 0.25;
    },
    onDeactivate: (e) => {
      'worklet';
      const fling = Math.abs(e.velocityX) > 900;
      if (Math.abs(e.translationX) > threshold || fling) {
        const dir: SwipeDirection = (fling ? e.velocityX : e.translationX) > 0 ? 'right' : 'left';
        tx.value = withTiming(dir === 'right' ? width * 1.4 : -width * 1.4, { duration: 220 }, (done) => {
          if (done) scheduleOnRN(onSwiped, dir);
        });
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, threshold], [0, 1], Extrapolation.CLAMP) }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP) }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, cardStyle]} testID="swipe-top-card">
        <Pressable style={{ flex: 1 }} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${rv.title}. Swipe right to save, left to pass. Tap for details.`}>
          <SwipeCardContent rv={rv} />
        </Pressable>
        <Animated.View style={[styles.stamp, styles.likeStamp, likeStyle]} pointerEvents="none">
          <Text style={[Type.headlineMedium, { color: Brand.saveGreen }]}>SAVE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.passStamp, passStyle]} pointerEvents="none">
          <Text style={[Type.headlineMedium, { color: Brand.passCoral }]}>PASS</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeDeck({
  deck,
  onSwipe,
  onOpen,
}: {
  deck: RvSummary[];
  onSwipe: (rv: RvSummary, dir: SwipeDirection) => void;
  onOpen: (rv: RvSummary) => void;
}) {
  const top = deck[0];
  const next = deck[1];
  return (
    <View style={styles.deck}>
      {next ? (
        <View style={[StyleSheet.absoluteFill, styles.behind]} pointerEvents="none">
          <SwipeCardContent rv={next} />
        </View>
      ) : null}
      {top ? <TopCard key={top.unitId} rv={top} onSwiped={(dir) => onSwipe(top, dir)} onOpen={() => onOpen(top)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1, marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
  behind: { transform: [{ scale: 0.95 }, { translateY: 10 }], opacity: 0.6 },
  stamp: {
    position: 'absolute',
    top: Spacing.xl,
    borderWidth: 3,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  likeStamp: { left: Spacing.xl, borderColor: Brand.saveGreen, transform: [{ rotate: '-12deg' }] },
  passStamp: { right: Spacing.xl, borderColor: Brand.passCoral, transform: [{ rotate: '12deg' }] },
});
