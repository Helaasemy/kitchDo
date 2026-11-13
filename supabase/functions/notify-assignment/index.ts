import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Body = {
  kitchenId?: string;
  templateId?: string;
  templateTitle?: string;
  assigneeUserIds?: unknown;
};

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    return await handle(req);
  } catch {
    return json(500, { error: 'Unexpected error' });
  }
});

async function handle(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing authorization' });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const kitchenId = typeof body.kitchenId === 'string' ? body.kitchenId : '';
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  const templateTitle =
    typeof body.templateTitle === 'string' ? body.templateTitle.trim().slice(0, 200) : '';
  const rawIds = Array.isArray(body.assigneeUserIds) ? body.assigneeUserIds : [];
  const assigneeUserIds = [
    ...new Set(
      rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 20),
    ),
  ];

  if (!kitchenId || !templateId || !templateTitle || assigneeUserIds.length === 0) {
    return json(400, { error: 'Missing fields' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json(500, { error: 'Server misconfigured' });

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();
  if (userError || !user) return json(401, { error: 'Unauthorized' });

  const targets = assigneeUserIds.filter((id) => id !== user.id);
  if (targets.length === 0) return json(200, { sent: 0 });

  const admin = createClient(url, service);
  const { data: actor, error: actorError } = await admin
    .from('kdo_kitchen_members')
    .select('role, can_edit_templates')
    .eq('kitchen_id', kitchenId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (actorError) return json(500, { error: 'Could not verify membership' });
  if (!actor || (actor.role !== 'admin' && !actor.can_edit_templates)) {
    return json(403, { error: 'Not allowed' });
  }

  const { data: members, error: memberError } = await admin
    .from('kdo_kitchen_members')
    .select('user_id')
    .eq('kitchen_id', kitchenId)
    .in('user_id', targets);
  if (memberError) return json(500, { error: 'Could not verify assignees' });
  const allowed = new Set((members ?? []).map((row) => row.user_id as string));
  const recipients = targets.filter((id) => allowed.has(id));
  if (recipients.length === 0) return json(200, { sent: 0 });

  const { data: tokens, error: tokenError } = await admin
    .from('kdo_push_tokens')
    .select('token, user_id')
    .in('user_id', recipients);
  if (tokenError) return json(500, { error: 'Could not load devices' });
  if (!tokens || tokens.length === 0) return json(200, { sent: 0 });

  const messages = tokens.map((row) => ({
    to: row.token,
    title: 'KitchDo',
    body: `You've been assigned ${templateTitle}`,
    sound: 'default',
    data: {
      type: 'assignment',
      kitchenId,
      templateId,
    },
  }));

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!expoRes.ok) return json(502, { error: 'Push service failed' });

  const expoJson = (await expoRes.json()) as {
    data?:
      | { status?: string; message?: string; details?: { error?: string } }
      | { status?: string; message?: string; details?: { error?: string } }[];
  };
  const tickets = Array.isArray(expoJson.data)
    ? expoJson.data
    : expoJson.data
      ? [expoJson.data]
      : [];
  const stale: string[] = [];
  const failures: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.status !== 'error') return;
    const code = ticket.details?.error ?? ticket.message ?? 'Push failed';
    failures.push(code);
    if (code === 'DeviceNotRegistered') {
      const token = tokens[index]?.token;
      if (token) stale.push(token);
    }
  });
  if (stale.length > 0) {
    await admin.from('kdo_push_tokens').delete().in('token', stale);
  }

  const sent = tokens.length - failures.length;
  if (sent <= 0 && failures.length > 0) {
    return json(502, { error: failures[0], sent: 0 });
  }
  return json(200, { sent, failures });
}
