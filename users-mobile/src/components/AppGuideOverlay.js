import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';

import { colors, shadow } from '../theme';
import handTapAnimation from '../../assets/animations/hand-tap.json';

const OVERLAY_COLOR = 'rgba(8, 13, 26, 0.76)';
const EDGE_GAP = 16;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateGuidePlacement({ target, cardHeight, screen, insets, preferred }) {
  const safeTop = insets.top + 12;
  const safeBottom = screen.height - insets.bottom - 12;
  const gap = 16;
  const below = safeBottom - (target.y + target.height);
  const above = target.y - safeTop;
  const useBelow = preferred === 'below'
    ? below >= cardHeight + gap || below >= above
    : preferred === 'above'
      ? !(above >= cardHeight + gap || above >= below)
      : below >= cardHeight + gap || below >= above;

  return clamp(
    useBelow ? target.y + target.height + gap : target.y - cardHeight - gap,
    safeTop,
    Math.max(safeTop, safeBottom - cardHeight),
  );
}

function GuideProgress({ count, current }) {
  return (
    <View style={styles.progress} accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.dot, index === current && styles.activeDot]} />
      ))}
    </View>
  );
}

function SpotlightMask({ rect, screen }) {
  return (
    <>
      <View style={[styles.dim, { left: 0, right: 0, top: 0, height: rect.y }]} />
      <View style={[styles.dim, { left: 0, right: 0, top: rect.y + rect.height, bottom: 0 }]} />
      <View style={[styles.dim, { left: 0, top: rect.y, width: rect.x, height: rect.height }]} />
      <View style={[styles.dim, { left: rect.x + rect.width, right: 0, top: rect.y, height: rect.height }]} />
      <View
        pointerEvents="none"
        style={[
          styles.spotlight,
          {
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            borderRadius: rect.radius,
            maxWidth: screen.width,
          },
        ]}
      />
    </>
  );
}

function GesturePointer({ rect, screen, insets, reduceMotion, animationAvailable, onAnimationFailure }) {
  const size = 58;

  const tapAnchorX = 32 / 64;
  const tapAnchorY = 22 / 64;

  const verticalOffset = 25; 

  const minTop = insets.top + 4;
  const maxTop = screen.height - insets.bottom - size - 4;

  const position = {
    left: clamp(
      rect.x + rect.width / 2 - size * tapAnchorX,
      8,
      screen.width - size - 8,
    ),
    top: clamp(
      rect.y + rect.height / 2 - size * tapAnchorY + verticalOffset,
      minTop,
      maxTop,
    ),
  };

  return (
    <View pointerEvents="none" style={[styles.hand, { ...position, width: size, height: size }]}>
      {animationAvailable ? (
        <LottieView
          source={handTapAnimation}
          autoPlay={!reduceMotion}
          loop={!reduceMotion}
          progress={reduceMotion ? 0.45 : undefined}
          onAnimationFailure={onAnimationFailure}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <MaterialCommunityIcons name="gesture-tap" size={42} color="#FFFFFF" />
      )}
    </View>
  );
}

function ArrowPointer({ rect, screen, insets, bounce }) {
  const size = 44;
  const canFitAbove = rect.y - size > insets.top;
  const top = canFitAbove ? rect.y - size : rect.y + rect.height;
  const icon = canFitAbove ? 'arrow-down' : 'arrow-up';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.arrow,
        {
          left: clamp(rect.x + rect.width / 2 - size / 2, 8, screen.width - size - 8),
          top: clamp(top, insets.top + 4, screen.height - insets.bottom - size - 4),
          transform: [{ translateY: bounce }],
        },
      ]}
    >
      <Feather name={icon} size={23} color="#FFFFFF" />
    </Animated.View>
  );
}

function GuideCard({ step, index, total, isFirst, isLast, onBack, onNext, onSkip, onLayout, style }) {
  return (
    <View style={[styles.card, style]} onLayout={onLayout}>
      <View style={styles.cardHeader}>
        <Text style={styles.stepText}>{index + 1} OF {total}</Text>
        <GuideProgress count={total} current={index} />
        <Pressable accessibilityRole="button" accessibilityLabel="Skip tour" hitSlop={10} onPress={onSkip}>
          <Text style={styles.skip}>Skip tour</Text>
        </Pressable>
      </View>
      <Text style={styles.title} maxFontSizeMultiplier={1.35}>{step.title}</Text>
      <Text style={styles.description} maxFontSizeMultiplier={1.3}>{step.description || step.message}</Text>
      <View style={styles.actions}>
        {!isFirst && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish tour' : 'Next guide step'}
          style={[styles.nextButton, isFirst && styles.fullButton]}
          onPress={onNext}
        >
          <Text style={styles.nextText}>{isLast ? 'Finish' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AppGuideOverlay({ visible, steps, onBeforeMeasure, onBack, onNext, onSkip, onFinish, currentIndex }) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const step = steps[currentIndex];
  const [targetRect, setTargetRect] = useState(null);
  const [cardHeight, setCardHeight] = useState(210);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animationAvailable, setAnimationAvailable] = useState(true);
  const bounceValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    if (!visible || reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bounceValue, { toValue: 6, duration: 600, useNativeDriver: true }),
      Animated.timing(bounceValue, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bounceValue, reduceMotion, visible]);

  useEffect(() => {
    setTargetRect(null);
    if (!visible || !step) return undefined;
    let cancelled = false;
    let timer;
    let attempts = 0;
    const measure = () => {
      const target = step.targetRef?.current;
      if (cancelled || !target) {
        if (!cancelled && attempts++ < 12) timer = setTimeout(measure, 80);
        return;
      }
      target.measureInWindow((x, y, width, height) => {
        if (cancelled) return;
        if (width <= 0 || height <= 0) {
          if (attempts++ < 12) timer = setTimeout(measure, 80);
          return;
        }
      const visualYOffset = 40; 
      const padding = clamp(step.spotlightPadding ?? 8, 6, 12);

      const left = clamp(x - padding, 0, screen.width);
      const top = clamp(
        y - padding + visualYOffset,
        insets.top,
        screen.height - insets.bottom,
      );
      const right = clamp(x + width + padding, 0, screen.width);
      const bottom = clamp(
        y + height + padding + visualYOffset,
        insets.top,
        screen.height - insets.bottom,
      );
        setTargetRect({
          x: left,
          y: top,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
          radius: step.spotlightRadius ?? (height > 90 ? 24 : 18),
        });
      });
    };
    const interaction = InteractionManager.runAfterInteractions(async () => {
      await onBeforeMeasure?.(step);
      if (!cancelled) requestAnimationFrame(() => requestAnimationFrame(measure));
    });
    return () => {
      cancelled = true;
      interaction.cancel?.();
      clearTimeout(timer);
    };
  }, [currentIndex, insets.bottom, insets.top, onBeforeMeasure, screen.height, screen.width, step, visible]);

  const cardWidth = Math.min(360, screen.width - EDGE_GAP * 2);
  const cardTop = targetRect
    ? calculateGuidePlacement({ target: targetRect, cardHeight, screen, insets, preferred: step.preferredCardPlacement })
    : insets.top + 24;
  const cardLeft = targetRect
    ? clamp(targetRect.x + targetRect.width / 2 - cardWidth / 2, EDGE_GAP, screen.width - cardWidth - EDGE_GAP)
    : EDGE_GAP;

  if (!step) return null;
  const isLast = currentIndex === steps.length - 1;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={styles.root} pointerEvents="box-none">
        {targetRect ? <SpotlightMask rect={targetRect} screen={screen} /> : <View style={styles.fullDim} />}
        {targetRect && step.pointerType === 'arrow' && (
          <ArrowPointer rect={targetRect} screen={screen} insets={insets} bounce={reduceMotion ? 0 : bounceValue} />
        )}
        {targetRect && step.pointerType === 'hand' && (
          <GesturePointer
            rect={targetRect}
            screen={screen}
            insets={insets}
            reduceMotion={reduceMotion}
            animationAvailable={animationAvailable}
            onAnimationFailure={() => setAnimationAvailable(false)}
          />
        )}
        {targetRect && (
          <GuideCard
            step={step}
            index={currentIndex}
            total={steps.length}
            isFirst={currentIndex === 0}
            isLast={isLast}
            onBack={onBack}
            onNext={isLast ? onFinish : onNext}
            onSkip={onSkip}
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
            style={{ width: cardWidth, left: cardLeft, top: cardTop }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  fullDim: { ...StyleSheet.absoluteFillObject, backgroundColor: OVERLAY_COLOR },
  dim: { position: 'absolute', backgroundColor: OVERLAY_COLOR },
  spotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.65,
    shadowRadius: 9,
    elevation: 8,
  },
  arrow: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.maroon, borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  hand: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  card: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingHorizontal: 22, paddingVertical: 20, ...shadow,
    shadowOpacity: 0.2, shadowRadius: 18, elevation: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepText: { color: colors.maroon, fontSize: 11, fontWeight: '900' },
  progress: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D5DCE6' },
  activeDot: { width: 8, backgroundColor: colors.maroon },
  skip: { color: '#667B98', fontSize: 12, fontWeight: '700' },
  title: { color: '#111A2C', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  description: { color: '#536987', fontSize: 13.5, lineHeight: 20, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 17 },
  backButton: {
    flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1.5,
    borderColor: colors.maroon, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  nextButton: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  fullButton: { flex: 1 },
  backText: { color: colors.maroon, fontSize: 14, fontWeight: '900' },
  nextText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
