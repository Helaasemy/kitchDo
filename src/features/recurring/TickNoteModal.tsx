import { Modal, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { useTheme } from '@/design';
import { useT } from '@/i18n';

export function TickNoteModal({
  visible,
  note,
  onChangeNote,
  onSave,
  onClose,
}: {
  visible: boolean;
  note: string;
  onChangeNote: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().runs;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.canvas,
            borderTopLeftRadius: theme.radii.xxl,
            borderTopRightRadius: theme.radii.xxl,
            padding: theme.space.xl,
            paddingBottom: theme.space.xxl,
            gap: theme.space.lg,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 28,
              lineHeight: 32,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.exceptionTitle}
          </Text>
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder={copy.noteRequired}
            placeholderTextColor={theme.colors.inkSubtle}
            multiline
            autoFocus
            style={{
              minHeight: 96,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.xl,
              padding: theme.space.lg,
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.ink,
              backgroundColor: theme.colors.white,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <Button
              label={t().common.cancel}
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              label={copy.exceptionSave}
              disabled={!note.trim()}
              onPress={onSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
