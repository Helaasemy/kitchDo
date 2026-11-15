import { Text, View } from 'react-native';

import { useTheme } from '@/design';

import { legalSections, type LegalDoc } from './content';

export function LegalBody({ doc }: { doc: LegalDoc }) {
  const theme = useTheme();
  const sections = legalSections(doc);

  return (
    <View style={{ gap: theme.space.xl }}>
      {sections.map((section) => (
        <View key={section.title} style={{ gap: theme.space.sm }}>
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text
              key={paragraph.slice(0, 48)}
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
                color: theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
