import { ActivityIndicator, Pressable, Text, StyleSheet } from 'react-native';

import { colors } from '../theme';

export default function Button({ children, icon, variant = 'primary', loading, disabled, style, textStyle, ...props }) {
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.maroon : colors.surface} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, isSecondary && styles.secondaryText, isGhost && styles.ghostText, textStyle]}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  secondary: {
    backgroundColor: colors.green,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 42,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  secondaryText: {
    color: colors.surface,
  },
  ghostText: {
    color: colors.maroon,
  },
});
