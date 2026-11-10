import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, ListRow, Sheet, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useT, type KitchenMode } from '@/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function KitchenSwitcher({ visible, onClose }: Props) {
  const t = useT();
  const theme = useTheme();
  const {
    kitchens,
    kitchenId,
    switchKitchen,
    createAnotherKitchen,
    kitchenMode,
  } = useAuth();
  const copy = t().settings;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<KitchenMode>(kitchenMode);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setCreating(false);
    setName('');
    onClose();
  };

  return (
    <Sheet visible={visible} title={copy.yourKitchens} onClose={close}>
      <View style={{ gap: theme.space.sm }}>
        {kitchens.map((kitchen) => (
          <ListRow
            key={kitchen.kitchenId}
            title={kitchen.name}
            subtitle={
              kitchen.role === 'admin'
                ? t().invite.owner
                : kitchen.canEditTemplates
                  ? t().invite.canEditTemplates
                  : t().invite.canComplete
            }
            onPress={() => {
              void switchKitchen(kitchen.kitchenId);
              close();
            }}
            right={
              kitchen.kitchenId === kitchenId ? (
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyExtraBold,
                    fontSize: 10,
                    color: theme.colors.primary,
                    textTransform: 'uppercase',
                  }}
                >
                  {t().invite.you}
                </Text>
              ) : null
            }
          />
        ))}
      </View>

      {creating ? (
        <View style={{ gap: theme.space.md }}>
          <TextField
            label={t().common.kitchenName}
            value={name}
            onChangeText={setName}
            placeholder={
              kind === 'home'
                ? t().onboarding.kitchenPlaceholderHome
                : t().onboarding.kitchenPlaceholderBusiness
            }
          />
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            {(['home', 'business'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setKind(mode)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: theme.radii.pill,
                  borderWidth: 1.5,
                  borderColor:
                    kind === mode ? theme.colors.primary : theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    kind === mode ? theme.colors.sand : theme.colors.white,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyBold,
                    color: theme.colors.ink,
                  }}
                >
                  {mode === 'home'
                    ? t().onboarding.homeLabel
                    : t().onboarding.businessLabel}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={copy.addKitchen}
            loading={saving}
            onPress={() => {
              if (!name.trim()) return;
              setSaving(true);
              void createAnotherKitchen({ mode: kind, name }).then((result) => {
                setSaving(false);
                if (result.error) {
                  Alert.alert(t().common.errorGeneric, result.error);
                  return;
                }
                close();
              });
            }}
          />
        </View>
      ) : (
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={copy.addKitchen}
            variant="secondary"
            onPress={() => setCreating(true)}
          />
          <Button
            label={copy.joinKitchen}
            variant="secondary"
            onPress={() => {
              close();
              router.push('/join');
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
