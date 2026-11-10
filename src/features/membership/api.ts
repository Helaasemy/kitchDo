import { getSupabase, rpcErrorMessage } from '@/lib/supabase';
import type { KitchenMode } from '@/i18n';
import { effectivePermissions } from './permissions';
import { normalizeJoinCode } from './joinCode';
import type { KitchenInvite, KitchenMember, KitchenMembership } from './types';

function asMode(kind: string): KitchenMode {
  return kind === 'business' ? 'business' : 'home';
}

export async function listMemberships(userId: string): Promise<KitchenMembership[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kdo_kitchen_members')
    .select('kitchen_id, user_id, role, can_complete, can_edit_templates, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load kitchens.'));

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((row) => row.kitchen_id))];
  const { data: kitchens, error: kitchenErr } = await supabase
    .from('kdo_kitchens')
    .select('id, name, kind, owner_user_id, revision, archived_at')
    .in('id', ids)
    .is('archived_at', null);
  if (kitchenErr) throw new Error(rpcErrorMessage(kitchenErr, 'Could not load kitchens.'));

  const byId = new Map((kitchens ?? []).map((kitchen) => [kitchen.id, kitchen]));
  return rows.flatMap((row) => {
    const kitchen = byId.get(row.kitchen_id);
    if (!kitchen) return [];
    const perms = effectivePermissions({
      role: row.role as 'admin' | 'member',
      canComplete: row.can_complete,
      canEditTemplates: row.can_edit_templates,
    });
    return [
      {
        kitchenId: kitchen.id,
        name: kitchen.name,
        mode: asMode(kitchen.kind),
        ownerUserId: kitchen.owner_user_id,
        revision: kitchen.revision,
        role: row.role as 'admin' | 'member',
        canComplete: perms.canComplete,
        canEditTemplates: perms.canEditTemplates,
        joinedAt: row.joined_at,
      },
    ];
  });
}

export async function listKitchenMembers(kitchenId: string): Promise<KitchenMember[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kdo_kitchen_members')
    .select('user_id, role, can_complete, can_edit_templates, joined_at')
    .eq('kitchen_id', kitchenId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load members.'));

  const rows = data ?? [];
  const ids = rows.map((row) => row.user_id);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from('kdo_profiles')
      .select('user_id, display_name')
      .in('user_id', ids);
    if (profileErr) throw new Error(rpcErrorMessage(profileErr, 'Could not load members.'));
    for (const profile of profiles ?? []) {
      names.set(profile.user_id, profile.display_name);
    }
  }

  return rows.map((row) => {
    const perms = effectivePermissions({
      role: row.role as 'admin' | 'member',
      canComplete: row.can_complete,
      canEditTemplates: row.can_edit_templates,
    });
    return {
      userId: row.user_id,
      displayName: names.get(row.user_id) ?? 'Member',
      email: null,
      role: row.role as 'admin' | 'member',
      canComplete: perms.canComplete,
      canEditTemplates: perms.canEditTemplates,
      joinedAt: row.joined_at,
    };
  });
}

export async function listKitchenInvites(kitchenId: string): Promise<KitchenInvite[]> {
  const { data, error } = await getSupabase()
    .from('kdo_kitchen_invites')
    .select(
      'id, kitchen_id, code, can_complete, can_edit_templates, expires_at, revoked_at, created_at',
    )
    .eq('kitchen_id', kitchenId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load invites.'));
  return (data ?? []).map((row) => ({
    id: row.id,
    kitchenId: row.kitchen_id,
    code: row.code,
    canComplete: row.can_complete,
    canEditTemplates: row.can_edit_templates,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export async function createKitchen(input: {
  name: string;
  mode: KitchenMode;
  kitchenId?: string;
}): Promise<{ kitchenId: string }> {
  const { data, error } = await getSupabase().rpc('create_kitchen', {
    p_name: input.name.trim(),
    p_kind: input.mode,
    p_kitchen_id: input.kitchenId,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not create kitchen.'));
  const result = (data ?? {}) as { kitchen_id?: string };
  if (!result.kitchen_id) throw new Error('Could not create kitchen.');
  return { kitchenId: result.kitchen_id };
}

export async function createKitchenInvite(input: {
  kitchenId: string;
  canComplete: boolean;
  canEditTemplates: boolean;
}): Promise<KitchenInvite> {
  const { data, error } = await getSupabase().rpc('create_kitchen_invite', {
    p_kitchen_id: input.kitchenId,
    p_can_complete: input.canComplete,
    p_can_edit_templates: input.canEditTemplates,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not create invite.'));
  const result = (data ?? {}) as {
    invite_id: string;
    code: string;
    expires_at: string;
    can_complete: boolean;
    can_edit_templates: boolean;
  };
  return {
    id: result.invite_id,
    kitchenId: input.kitchenId,
    code: result.code,
    canComplete: result.can_complete,
    canEditTemplates: result.can_edit_templates,
    expiresAt: result.expires_at,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export async function revokeKitchenInvite(inviteId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_kitchen_invite', {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not revoke invite.'));
}

export async function joinKitchen(input: {
  code: string;
  displayName?: string;
}): Promise<{
  kitchenId: string;
  name: string;
  mode: KitchenMode;
  alreadyMember: boolean;
}> {
  const code = normalizeJoinCode(input.code);
  if (!code) throw new Error('invalid join code');
  const { data, error } = await getSupabase().rpc('join_kitchen', {
    p_code: code,
    p_display_name: input.displayName?.trim() || undefined,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not join kitchen.'));
  const result = (data ?? {}) as {
    kitchen_id?: string;
    kitchen_name?: string;
    kind?: string;
    already_member?: boolean;
  };
  if (!result.kitchen_id) throw new Error('Could not join kitchen.');
  return {
    kitchenId: result.kitchen_id,
    name: result.kitchen_name ?? 'Kitchen',
    mode: asMode(result.kind ?? 'home'),
    alreadyMember: Boolean(result.already_member),
  };
}

export async function leaveKitchen(kitchenId: string): Promise<void> {
  const { error } = await getSupabase().rpc('leave_kitchen', {
    p_kitchen_id: kitchenId,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not leave kitchen.'));
}

export async function removeMember(kitchenId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('remove_member', {
    p_kitchen_id: kitchenId,
    p_user_id: userId,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not remove member.'));
}

export async function updateMemberPermissions(input: {
  kitchenId: string;
  userId: string;
  canComplete: boolean;
  canEditTemplates: boolean;
}): Promise<void> {
  const { error } = await getSupabase().rpc('update_member_permissions', {
    p_kitchen_id: input.kitchenId,
    p_user_id: input.userId,
    p_can_complete: input.canComplete,
    p_can_edit_templates: input.canEditTemplates,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not update permissions.'));
}
