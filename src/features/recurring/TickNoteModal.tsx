import { TextInput, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
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
    <Sheet
      visible={visible}
      title={copy.exceptionTitle}
      onClose={onClose}
      footer={
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
      }
    >
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
    </Sheet>
  );
}
