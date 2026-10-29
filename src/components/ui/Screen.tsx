import type { ReactNode } from 'react';
import {
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/design';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: Props) {
  const theme = useTheme();
  const gutter = theme.space.screen;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        {
          paddingHorizontal: gutter,
          paddingTop: theme.space.sm,
          paddingBottom: theme.space.xxl,
          flexGrow: 1,
          alignItems: 'stretch',
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: gutter,
          paddingTop: theme.space.sm,
          alignItems: 'stretch',
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[
        { flex: 1, backgroundColor: theme.colors.canvas },
        style,
      ]}
    >
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {body}
    </SafeAreaView>
  );
}
