import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the content (e.g. Cancel / Save row). */
  footer?: ReactNode;
  /** Tapping the dimmed backdrop closes the sheet. Default true. */
  dismissOnBackdrop?: boolean;
};

/** Bottom sheet modal: keyboard-aware, safe-area padded, closes on Android back. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
  dismissOnBackdrop = true,
}: Props) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t().common.cancel}
          disabled={!dismissOnBackdrop}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.overlay,
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '90%',
            backgroundColor: theme.colors.canvas,
            borderTopLeftRadius: theme.radii.xxl,
            borderTopRightRadius: theme.radii.xxl,
            paddingTop: theme.space.xl,
            paddingHorizontal: theme.space.xl,
            paddingBottom: theme.space.lg + insets.bottom,
            gap: theme.space.lg,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 28,
              lineHeight: 32,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {title}
          </Text>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: theme.space.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
