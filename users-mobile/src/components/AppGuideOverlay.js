import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

import { colors, shadow } from '../theme';
import handTapAnimation from '../../assets/animations/hand-tap.json';

const OVERLAY_COLOR = 'rgba(8, 13, 26, 0.72)';
const SPOTLIGHT_PADDING = 8;
const GUIDE_Y_OFFSET = 40;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function AppGuideOverlay({
  visible,
  steps,
  onBeforeMeasure,
  onBack,
  onNext,
  onSkip,
  onFinish,
  currentIndex,
}) {
  const [targetRect, setTargetRect] = useState(null);
  const [handAnimationAvailable, setHandAnimationAvailable] = useState(true);

  const bounce = useRef(new Animated.Value(0)).current;
  const screen = useWindowDimensions();

  const step = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  useEffect(() => {
    if (!visible) return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [bounce, visible]);

  useEffect(() => {
    setTargetRect(null);

    if (!visible || !step?.targetRef?.current) {
      return undefined;
    }

    let cancelled = false;
    let frameId = null;
    let retryTimer = null;
    let refreshTimer = null;
    let attempts = 0;

    const measureExactTarget = () => {
      const target = step?.targetRef?.current;

      if (cancelled || !target) return;

      target.measureInWindow((x, y, width, height) => {
        if (cancelled) return;

        if ((width <= 0 || height <= 0) && attempts < 10) {
          attempts += 1;

          retryTimer = setTimeout(() => {
            frameId = requestAnimationFrame(measureExactTarget);
          }, 80);

          return;
        }

        if (width > 0 && height > 0) {
          const adjustedY = y + GUIDE_Y_OFFSET;

          setTargetRect({
            x,
            y: adjustedY,
            width,
            height,
            padding: clamp(step.padding ?? SPOTLIGHT_PADDING, 6, 10),
            centerX: x + width / 2,
            centerY: adjustedY + height / 2,
          });
        }
      });
    };

    const interaction = InteractionManager.runAfterInteractions(async () => {
      await onBeforeMeasure?.(step);

      if (cancelled) return;

      frameId = requestAnimationFrame(() => {
        requestAnimationFrame(measureExactTarget);
      });

      refreshTimer = setTimeout(() => {
        frameId = requestAnimationFrame(measureExactTarget);
      }, 520);
    });

    return () => {
      cancelled = true;

      interaction.cancel?.();

      if (frameId) cancelAnimationFrame(frameId);
      if (retryTimer) clearTimeout(retryTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [
    currentIndex,
    onBeforeMeasure,
    screen.height,
    screen.width,
    step,
    visible,
  ]);

  const spotlightRect = useMemo(() => {
    if (!targetRect) return null;

    const padding = targetRect.padding ?? SPOTLIGHT_PADDING;

    return {
      x: targetRect.x - padding,
      y: targetRect.y - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
    };
  }, [targetRect]);

  const tooltipPlacement = useMemo(() => {
    if (!targetRect || !spotlightRect) return null;

    const tooltipWidth = Math.min(screen.width - 32, 330);
    const estimatedTooltipHeight =
      step?.message?.length > 130 ? 236 : 206;

    const clearance = 16;
    const spaceBelow =
      screen.height - (spotlightRect.y + spotlightRect.height);

    const spaceAbove = spotlightRect.y;

    const placeBelow =
      spaceBelow >= estimatedTooltipHeight + clearance ||
      spaceBelow >= spaceAbove;

    const top = placeBelow
      ? clamp(
          spotlightRect.y + spotlightRect.height + clearance,
          24,
          screen.height - estimatedTooltipHeight - 20,
        )
      : clamp(
          spotlightRect.y - estimatedTooltipHeight - clearance,
          24,
          screen.height - estimatedTooltipHeight - 20,
        );

    const left = clamp(
      targetRect.centerX - tooltipWidth / 2,
      16,
      screen.width - tooltipWidth - 16,
    );

    return {
      top,
      left,
      width: tooltipWidth,
      placeBelow,
    };
  }, [
    screen.height,
    screen.width,
    spotlightRect,
    step?.message,
    targetRect,
  ]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect || !tooltipPlacement) return null;

    return [
      styles.tooltip,
      {
        width: tooltipPlacement.width,
        left: tooltipPlacement.left,
        top: tooltipPlacement.top,
      },
    ];
  }, [targetRect, tooltipPlacement]);

  const spotlightStyle = useMemo(() => {
    if (!spotlightRect) return null;

    const radius = spotlightRect.height > 120 ? 24 : 18;

    return {
      left: spotlightRect.x,
      top: spotlightRect.y,
      width: spotlightRect.width,
      height: spotlightRect.height,
      borderRadius: radius,
    };
  }, [spotlightRect]);

  const arrowStyle = useMemo(() => {
    if (!targetRect || !spotlightRect) return null;

    const translate = bounce.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    });

    const spaceAbove = spotlightRect.y;
    const spaceBelow =
      screen.height - (spotlightRect.y + spotlightRect.height);

    const spaceLeft = spotlightRect.x;
    const spaceRight =
      screen.width - (spotlightRect.x + spotlightRect.width);

    const centerX = targetRect.centerX;
    const centerY = targetRect.centerY;

    if (spaceAbove >= 54) {
      return {
        icon: 'arrow-down',
        style: [
          styles.pointer,
          {
            left: clamp(centerX - 21, 12, screen.width - 54),
            top: spotlightRect.y - 52,
            transform: [{ translateY: translate }],
          },
        ],
      };
    }

    if (spaceBelow >= 54) {
      return {
        icon: 'arrow-up',
        style: [
          styles.pointer,
          {
            left: clamp(centerX - 21, 12, screen.width - 54),
            top: spotlightRect.y + spotlightRect.height + 10,
            transform: [{ translateY: Animated.multiply(translate, -1) }],
          },
        ],
      };
    }

    if (spaceLeft > spaceRight) {
      return {
        icon: 'arrow-right',
        style: [
          styles.pointer,
          {
            left: spotlightRect.x - 52,
            top: clamp(centerY - 21, 18, screen.height - 60),
            transform: [{ translateX: translate }],
          },
        ],
      };
    }

    return {
      icon: 'arrow-left',
      style: [
        styles.pointer,
        {
          left: spotlightRect.x + spotlightRect.width + 10,
          top: clamp(centerY - 21, 18, screen.height - 60),
          transform: [{ translateX: Animated.multiply(translate, -1) }],
        },
      ],
    };
  }, [
    bounce,
    screen.height,
    screen.width,
    spotlightRect,
    targetRect,
  ]);

  const handStyle = useMemo(() => {
  if (!targetRect || !spotlightRect || !arrowStyle) return null;

  const size = 52;
  const centerX = targetRect.centerX;s

  const horizontalOffset = -20;
  const spaceBelow =
    screen.height - (spotlightRect.y + spotlightRect.height);

  const targetIsNearBottom = spotlightRect.y > screen.height * 0.62;

  const handTopBelow = spotlightRect.y + spotlightRect.height + 28;
  const handTopAbove = spotlightRect.y - size + 70;

  return {
    left: clamp(centerX + horizontalOffset, 12, screen.width - size - 12),
    top: targetIsNearBottom || spaceBelow < 130
      ? clamp(handTopAbove, 12, screen.height - size - 12)
      : clamp(handTopBelow, 12, screen.height - size - 12),
    width: size,
    height: size,
  };
}, [
  arrowStyle,
  screen.height,
  screen.width,
  spotlightRect,
  targetRect,
]);

  if (!step) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <View style={styles.root} pointerEvents="box-none">
        {targetRect ? (
          <>
            <View
              style={[
                styles.dim,
                {
                  top: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(0, spotlightRect.y),
                },
              ]}
            />

            <View
              style={[
                styles.dim,
                {
                  top: Math.max(
                    0,
                    spotlightRect.y + spotlightRect.height,
                  ),
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
              ]}
            />

            <View
              style={[
                styles.dim,
                {
                  top: Math.max(0, spotlightRect.y),
                  left: 0,
                  width: Math.max(0, spotlightRect.x),
                  height: spotlightRect.height,
                },
              ]}
            />

            <View
              style={[
                styles.dim,
                {
                  top: Math.max(0, spotlightRect.y),
                  left: spotlightRect.x + spotlightRect.width,
                  right: 0,
                  height: spotlightRect.height,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={[styles.spotlight, spotlightStyle]}
            />

            {arrowStyle && (
              <Animated.View style={arrowStyle.style}>
                <Feather
                  name={arrowStyle.icon}
                  size={22}
                  color="#fff"
                />
              </Animated.View>
            )}

            {handStyle && handAnimationAvailable && (
              <View pointerEvents="none" style={[styles.handHint, handStyle]}>
                <LottieView
                  source={handTapAnimation}
                  autoPlay
                  loop
                  onAnimationFailure={() => setHandAnimationAvailable(false)}
                  resizeMode="contain"
                  style={styles.guideHandAnimation}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.fullDim} />
        )}

        {targetRect && tooltipStyle && (
          <View style={tooltipStyle}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.stepCounter}>
                {currentIndex + 1} of {steps.length}
              </Text>

              <Pressable onPress={onSkip} hitSlop={10}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{step.title}</Text>

            <Text style={styles.message}>{step.message}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={onBack}
                disabled={isFirst}
                style={[
                  styles.secondaryButton,
                  isFirst && styles.disabledButton,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryText,
                    isFirst && styles.disabledText,
                  ]}
                >
                  Back
                </Text>
              </Pressable>

              <Pressable
                onPress={isLast ? onFinish : onNext}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>
                  {isLast ? 'Finish' : 'Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },

  fullDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_COLOR,
  },

  dim: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },

spotlight: {
  position: 'absolute',
  borderRadius: 22,
  borderWidth: 2,
  borderColor: '#fff',
  backgroundColor: 'transparent',
},

  handHint: {
    position: 'absolute',
    opacity: 0.92,
  },

  guideHandAnimation: {
    width: '100%',
    height: '100%',
  },

  pointer: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.maroon,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tooltip: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  stepCounter: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  skipText: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '900',
  },

  title: {
    color: '#101827',
    fontSize: 17,
    fontWeight: '900',
  },

  message: {
    color: '#536987',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DDE5EF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.maroon,
  },

  secondaryText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: '900',
  },

  primaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.45,
  },

  disabledText: {
    color: '#8AA0BF',
  },
});
