import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

type Props = {
  children: ReactNode;
  /** When true, chips scroll horizontally (long suggestion lists). */
  scroll?: boolean;
};

const ROW_H = 34;

/**
 * Tight chip row. Default wraps with 8pt gaps and left alignment.
 * Never uses flex distribution that spreads chips across the row.
 */
export function ChipScroller({ children, scroll = false }: Props) {
  if (!scroll) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'center',
          alignContent: 'flex-start',
          columnGap: 8,
          rowGap: 8,
          width: '100%',
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={{ height: ROW_H, width: '100%', overflow: 'hidden' }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: ROW_H }}
        contentContainerStyle={{
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            columnGap: 8,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
