# Prompt For Antigravity Agent: Implement CAPSync Progress Tracker

You are working in the existing CAPSync repository. Implement the supplied standalone CAPSync Progress Tracker artifact as a real Next.js + Supabase + shadcn feature.

Do not paste the standalone HTML into React. Recreate the same user experience using the app’s existing architecture, routes, Supabase schema, UI components, Tailwind 4 styling, and circle-based permissions.

## Project Context

- Framework: Next.js `16.2.1` with App Router.
- React: `19.2.4`.
- Styling: Tailwind CSS `4`, shadcn `base-nova`, CSS variables in `app/globals.css`.
- UI primitives already exist in `components/ui`.
- Icons: use `lucide-react`.
- Supabase: `@supabase/ssr` and `@supabase/supabase-js`.
- Server Supabase helper: `lib/supabaseServer.ts`.
- Client Supabase helper: `lib/supabaseClient.ts`.
- Auth guard exists in `app/(app)/layout.tsx`.
- Circle membership guard exists in `app/(app)/[groupId]/layout.tsx`.
- Existing app shell/sidebar is in `app/(app)/AppShellClient.tsx`.

Important: do not recreate the standalone artifact’s global sidebar or topbar. The app shell already handles navigation, circle switching, members, logout, and responsive sidebar behavior. Implement only the tracker content inside the existing page area.

Because this project uses Next `16.2.1`, check local Next docs in `node_modules/next/dist/docs/` before using APIs that may have changed.

## Current Tracker Files To Fill

The tracker routes and components already exist but are placeholders or empty shells. Use these exact files as the primary implementation targets:

- `app/(app)/[groupId]/tracker/page.tsx`
- `app/(app)/[groupId]/tracker/board/page.tsx`
- `app/(app)/[groupId]/tracker/calendar/page.tsx`
- `components/tracker/KanbanBoard.tsx`
- `components/tracker/SprintHeader.tsx`
- `components/tracker/TaskCard.tsx`
- `components/tracker/TaskDetailSheet.tsx`
- `components/tracker/TaskForm.tsx`
- `components/tracker/TaskList.tsx`
- `lib/tracker/getTasksForCalendar.ts`
- `lib/tracker/reorderTasks.ts`

Create additional tracker components only when useful, for example:

- `components/tracker/TrackerWorkspace.tsx`
- `components/tracker/MethodologyBanner.tsx`
- `components/tracker/MethodologyDialog.tsx`
- `components/tracker/AiTaskAssistant.tsx`
- `components/tracker/tracker-utils.ts`

## Desired Experience

Recreate the behavior and layout of the artifact:

- Stats section:
  - overall progress
  - tasks done
  - due this week
  - overdue
- Methodology banner:
  - Scrum
  - Agile
  - Waterfall
  - Kanban
- Member color legend and task status legend.
- List/pipeline view with phases/sprints.
- Board view with task status columns.
- Calendar view with task due dates.
- Add task dialog.
- Task detail dialog or sheet.
- Methodology change dialog.
- PM action to mark sprint/phase complete and unlock the next phase.
- AI task assistant powered by Groq through a secure server endpoint.

The page should feel like an operational student capstone tracker, not a landing page.

## Existing Database Support

The current `supabase/schema.sql` already includes the core tracker model:

- `groups`
  - `id`
  - `name`
  - `created_by`
  - `subject`
  - `color`
  - `invite_code`
  - `methodology`
- `group_members`
  - `group_id`
  - `member_id`
  - `role`
  - `color`
- `sprints`
  - `group_id`
  - `title`
  - `start_date`
  - `end_date`
  - `goal`
  - `status`
  - `ai_generated`
- `tasks`
  - `group_id`
  - `sprint_id`
  - `created_by`
  - `assigned_to`
  - `title`
  - `description`
  - `status`
  - `category`
  - `due_date`
  - `priority`
  - `requires_pm_approval`
  - `approved_by`
  - `approved_at`
  - `position`
  - `starts_at`
  - `ends_at`
  - `is_all_day`
- `task_comments`

## Required Schema And RLS Updates

If these are not already present, update `supabase/schema.sql` safely and idempotently.

Add stricter task and sprint status constraints:

```sql
alter table tasks
drop constraint if exists tasks_status_check;

alter table tasks
add constraint tasks_status_check
check (status in ('todo', 'doing', 'review', 'done', 'blocked'));

alter table sprints
drop constraint if exists sprints_status_check;

alter table sprints
add constraint sprints_status_check
check (status in ('upcoming', 'active', 'done', 'locked'));
```

Add task mutation policies for group members:

```sql
drop policy if exists "members can create tasks in their group" on tasks;
drop policy if exists "members can update tasks in their group" on tasks;
drop policy if exists "members can delete tasks in their group" on tasks;

create policy "members can create tasks in their group"
on tasks
for insert
with check (
  public.is_group_member(group_id, auth.uid())
  and created_by = auth.uid()
);

create policy "members can update tasks in their group"
on tasks
for update
using (public.is_group_member(group_id, auth.uid()))
with check (public.is_group_member(group_id, auth.uid()));

create policy "members can delete tasks in their group"
on tasks
for delete
using (public.is_group_member(group_id, auth.uid()));
```

Add sprint policies:

```sql
drop policy if exists "members can view sprints in their group" on sprints;
drop policy if exists "members can create sprints in their group" on sprints;
drop policy if exists "members can update sprints in their group" on sprints;

create policy "members can view sprints in their group"
on sprints
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "members can create sprints in their group"
on sprints
for insert
with check (public.is_group_member(group_id, auth.uid()));

create policy "members can update sprints in their group"
on sprints
for update
using (public.is_group_member(group_id, auth.uid()))
with check (public.is_group_member(group_id, auth.uid()));
```

Add a PM helper for PM-only actions:

```sql
create or replace function public.is_group_pm(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.member_id = target_user_id
      and gm.role in ('pm', 'admin', 'owner')
  );
$$;

revoke all on function public.is_group_pm(uuid, uuid) from public;
grant execute on function public.is_group_pm(uuid, uuid) to authenticated;
```

Use this helper in server-side mutation checks for:

- changing `groups.methodology`
- marking a sprint complete
- unlocking the next sprint

## Type Updates

Update `types/index.ts` so local types match the schema.

Add or refine these types:

```ts
export type Methodology = "scrum" | "agile" | "waterfall" | "kanban";
export type TaskStatus = "todo" | "doing" | "review" | "done" | "blocked";
export type SprintStatus = "upcoming" | "active" | "done" | "locked";

export type TrackerTask = Task & {
  assignee?: User | null;
};

export type TrackerSprint = Sprint & {
  tasks: TrackerTask[];
};
```

Ensure `Group` includes:

```ts
invite_code?: string | null;
methodology?: Methodology | string | null;
```

Ensure `Task` includes:

```ts
starts_at: string | null;
ends_at: string | null;
is_all_day: boolean;
```

## Route Requirements

### `app/(app)/[groupId]/tracker/page.tsx`

Implement the main list/pipeline tracker.

Server-side tasks:

- Read `groupId` from `params`.
- Create Supabase server client with `createClient()`.
- Get the authenticated user.
- Fetch group:
  - `id`
  - `name`
  - `color`
  - `methodology`
  - `created_by`
- Fetch members:
  - `group_members.role`
  - `group_members.color`
  - `profiles.id`
  - `profiles.full_name`
  - `profiles.email`
- Fetch sprints ordered by `start_date`.
- Fetch tasks ordered by `position`, then `due_date`, then `created_at`.
- Compose tasks into sprints.
- Render a client component like `TrackerWorkspace`.

UI tasks:

- Render stat cards.
- Render methodology banner.
- Render list/board/calendar navigation.
- Render member and task-status legend.
- Render sprint/phase pipeline.
- Support expand/collapse.
- Support add task dialog.
- Support task detail dialog.
- Support methodology dialog.
- Support secure AI assistant panel.

### `app/(app)/[groupId]/tracker/board/page.tsx`

Implement board view.

- Fetch the same group, member, sprint, and task data.
- Flatten tasks.
- Render `KanbanBoard`.
- Group tasks by status:
  - `todo`
  - `doing`
  - `review`
  - `done`
- For Kanban methodology, label columns:
  - `To Do (Backlog)`
  - `In Progress`
  - `Review / Blocked`
  - `Done`
- Display assignee color, due date, overdue state, and status badge.
- Add task button per column.
- Drag-and-drop is optional for the first pass; if implemented, update `tasks.status` and `tasks.position`.

### `app/(app)/[groupId]/tracker/calendar/page.tsx`

Implement task calendar view.

- Use `lib/tracker/getTasksForCalendar.ts` as the normalizer.
- Display tasks with `due_date`, `starts_at`, `ends_at`, and `assigned_to`.
- Render month grid.
- Show task dots using assignee colors.
- Show deadline flags.
- Clicking a day should allow viewing tasks and opening the add task dialog.

## Component Requirements

### `components/tracker/TrackerWorkspace.tsx`

Create this client component for the list page.

Props:

```ts
type TrackerWorkspaceProps = {
  group: Group;
  members: Profile[];
  sprints: TrackerSprint[];
  currentUserId: string;
};
```

Responsibilities:

- Hold UI state for:
  - selected methodology modal value
  - open task detail
  - open task form
  - expanded sprint IDs
- Render stats, methodology banner, legend, pipeline, and AI panel.
- Call API routes for mutations.
- Call `router.refresh()` after successful mutations.

### `components/tracker/MethodologyBanner.tsx`

Use existing shadcn components:

- `Card`
- `Badge`
- `Button`

Use lucide icons:

- Scrum: `ListChecks`
- Agile: `RefreshCcw`
- Waterfall: `Waves`
- Kanban: `Kanban`

Methodology metadata:

```ts
const METHODOLOGIES = {
  scrum: {
    name: "Scrum - 2-week sprints",
    badge: "Structured",
    description: "Tasks are organized into fixed sprints. Complete all tasks in a sprint before the next one unlocks.",
  },
  agile: {
    name: "Agile - Iterative cycles",
    badge: "Adaptive",
    description: "Overlapping iterative cycles. Tasks can move across iterations.",
  },
  waterfall: {
    name: "Waterfall - Sequential phases",
    badge: "Phase-based",
    description: "Sequential phase-by-phase delivery with sign-offs at each gate.",
  },
  kanban: {
    name: "Kanban - Continuous flow",
    badge: "Flow-based",
    description: "Continuous task flow with WIP limits.",
  },
};
```

### `components/tracker/MethodologyDialog.tsx`

Use `Dialog`, `Button`, and compact option cards.

Responsibilities:

- Show Scrum, Agile, Waterfall, Kanban options.
- Show preview copy for selected methodology.
- Persist selected methodology to `groups.methodology`.
- Restrict mutation server-side to PM/admin/owner.
- If Kanban is selected, remove phase locking in UI.

### `components/tracker/TaskList.tsx`

Replace the placeholder with the phase pipeline.

Props:

```ts
type TaskListProps = {
  sprints: TrackerSprint[];
  membersById: Map<string, Profile>;
  methodology: Methodology;
  canManage: boolean;
  onOpenTask: (task: TrackerTask) => void;
  onMarkSprintComplete: (sprintId: string) => void;
};
```

Responsibilities:

- Render sprint/phase block.
- Render vertical connector.
- Show phase status.
- Collapse/expand tasks.
- Lock future phases for Scrum and Waterfall.
- Allow softer iteration behavior for Agile.
- Remove locks for Kanban.
- Show PM action when the phase is active and user can manage.

### `components/tracker/TaskCard.tsx`

Use this in list, board, and detail contexts.

Responsibilities:

- Render task title.
- Render assignee avatar/color.
- Render status badge.
- Render due date.
- Render overdue/soon states.

### `components/tracker/KanbanBoard.tsx`

Replace placeholder with a client board.

Props:

```ts
type KanbanBoardProps = {
  tasks: TrackerTask[];
  members: Profile[];
  methodology: Methodology;
  onOpenTask: (task: TrackerTask) => void;
};
```

Initial version:

- No drag-and-drop required.
- Group tasks by status.
- Add task buttons open `TaskForm`.

Optional later version:

- Add drag-and-drop.
- Update `tasks.status` and `tasks.position`.
- Use `lib/tracker/reorderTasks.ts`.

### `components/tracker/TaskForm.tsx`

Replace placeholder with real create/edit form.

Use:

- `Dialog`
- `Input`
- `Textarea`
- `Select`
- `Button`
- `Label`

Fields:

- title
- description
- sprint/phase
- status
- assigned member
- due date
- category
- priority

Submit behavior:

- Insert into `tasks`.
- Set `created_by` to current user.
- Set `group_id`.
- If assigning to someone else and current user is not PM, set `requires_pm_approval = true`.

### `components/tracker/TaskDetailSheet.tsx`

Use `Dialog` unless a Sheet component exists or is added.

Responsibilities:

- Show task metadata.
- Allow status update.
- Allow assignment update.
- Show comments from `task_comments`.
- Add comments.

## Supabase Query Guidance

Recommended task query:

```ts
const { data: tasks } = await supabase
  .from("tasks")
  .select("*")
  .eq("group_id", groupId)
  .order("position", { ascending: true, nullsFirst: false })
  .order("due_date", { ascending: true, nullsFirst: false })
  .order("created_at", { ascending: true });
```

Fetch profiles separately and join in TypeScript if Supabase relationship aliases are not available.

Recommended sprint query:

```ts
const { data: sprints } = await supabase
  .from("sprints")
  .select("*")
  .eq("group_id", groupId)
  .order("start_date", { ascending: true });
```

Recommended member query:

```ts
const { data: members } = await supabase
  .from("group_members")
  .select("role, color, profiles(id, full_name, email)")
  .eq("group_id", groupId)
  .order("joined_at", { ascending: true });
```

## API Routes / Mutations

Use API routes under `app/api/tracker/*` or server actions if they fit the existing style. Prefer API routes for consistency with the current app.

Implement:

- `POST /api/tracker/tasks`
  - create task
- `PATCH /api/tracker/tasks/[taskId]`
  - update task
- `POST /api/tracker/sprints/[sprintId]/complete`
  - mark sprint complete and unlock next
- `PATCH /api/tracker/groups/[groupId]/methodology`
  - update methodology
- `POST /api/tracker/ai`
  - secure AI assistant endpoint

Every mutation must:

- Use the server Supabase client.
- Get authenticated user.
- Verify group membership.
- Verify PM/admin/owner role for PM-only operations.
- Return typed JSON.
- Avoid exposing server secrets.
- Refresh client data after success.

## Secure Groq API Key Requirement

The standalone artifact asks the user to paste a Groq API key into the UI. Do not implement that.

The Groq API key must be stored only in the server environment:

- Put the real key in `.env.local` for local development.
- Put the real key in the deployment provider’s server-side environment settings for production.
- Add only the variable name to `.env.example`.
- Never prefix this key with `NEXT_PUBLIC_`.
- Never send it to the client.
- Never store it in Supabase.
- Never log the full key.

Update `.env.example`:

```env
# Server-only. Never expose with NEXT_PUBLIC_ and never commit the real value.
GROQ_API_KEY=
```

Local `.env.local` should contain:

```env
GROQ_API_KEY=gsk_your_real_key_here
```

Do not create:

```env
NEXT_PUBLIC_GROQ_API_KEY=
```

Any variable prefixed with `NEXT_PUBLIC_` is exposed to browser JavaScript and is unsafe for provider secrets.

## Secure AI Endpoint

Create `app/api/tracker/ai/route.ts`.

Expected request:

```ts
POST /api/tracker/ai
body: {
  groupId: string;
  prompt: string;
}
```

Expected response:

```ts
{
  message: string;
}
```

Minimum route behavior:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI assistant is not configured." },
      { status: 500 },
    );
  }

  const { groupId, prompt } = await request.json();

  if (!groupId || !prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { error: "Missing groupId or prompt." },
      { status: 400 },
    );
  }

  if (prompt.length > 2000) {
    return NextResponse.json(
      { error: "Prompt is too long." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("member_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Fetch group, sprint, and task context here.
  // Call Groq using apiKey on the server only.
  // Return only the generated assistant message.
}
```

The AI system behavior should be:

```txt
You are a helpful capstone project tracker assistant integrated into CAPSync.
Keep responses under 150 words, practical, and specific to student thesis/capstone work.
Do not replace the team's workflow. Suggest next actions.
```

Set conservative `max_tokens`. Consider adding rate limiting per user if this becomes production-facing.

## Visual And Interaction Guidelines

- Use existing `Button`, `Card`, `Badge`, `Dialog`, `Input`, `Select`, `Textarea`, and `Label` components.
- Use `lucide-react` icons instead of inline SVG or emoji where possible.
- Keep cards compact with tight information density.
- Do not create a marketing page or hero layout.
- Use member colors from `group_members.color`; provide fallback colors:
  - `#4f46e5`
  - `#16a34a`
  - `#ea580c`
  - `#9333ea`
- Status colors:
  - todo: zinc
  - doing: blue
  - review: amber
  - done: green
  - blocked/overdue: red

## Tracker Calculations

Implement helper functions in `components/tracker/tracker-utils.ts`.

Overall progress:

```ts
const totalTasks = tasks.length;
const doneTasks = tasks.filter((task) => task.status === "done").length;
const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
```

Due this week:

- Use `date-fns`.
- Count tasks where `due_date` falls in the current week and status is not `done`.

Overdue:

- `due_date` is before today.
- status is not `done`.

Sprint progress:

- total tasks in sprint
- done tasks in sprint
- percent complete

Locking behavior:

- Scrum and Waterfall:
  - a sprint is locked if a previous sprint is not `done`.
- Agile:
  - show phases as soft iterations and allow task movement.
- Kanban:
  - no phase locks.
  - board view is primary.

## Recommended Implementation Order

1. Read the current files before editing.
2. Update `types/index.ts`.
3. Update `supabase/schema.sql` with idempotent RLS/schema additions if missing.
4. Implement tracker utility helpers.
5. Implement server-side data loaders inside route pages or reusable helpers.
6. Implement `TaskCard`.
7. Implement `TaskList`.
8. Implement `TrackerWorkspace`.
9. Implement `TaskForm`.
10. Implement `MethodologyDialog`.
11. Implement `KanbanBoard`.
12. Implement tracker calendar and `getTasksForCalendar`.
13. Implement secure AI endpoint and AI assistant panel.
14. Update `.env.example` with `GROQ_API_KEY=`.
15. Run lint.
16. Run build.
17. Verify tracker routes in the browser.

## Acceptance Criteria

- `/{groupId}/tracker` renders inside the existing app shell.
- `/{groupId}/tracker/board` renders the board view.
- `/{groupId}/tracker/calendar` renders the task calendar view.
- Pages use the `groupId` from the URL.
- Users can view only groups they belong to.
- Stats match Supabase task data.
- Member colors come from `group_members.color`.
- Methodology banner reflects `groups.methodology`.
- Changing methodology persists to Supabase.
- PM-only operations are checked server-side.
- List view shows sprint/phase progression.
- Scrum and Waterfall lock future phases.
- Kanban removes phase locking and emphasizes the board.
- Add task inserts a real row into `tasks`.
- Board groups real tasks by status.
- Calendar displays real task due dates.
- Task detail opens from list and board items.
- AI assistant works through `app/api/tracker/ai/route.ts`.
- Groq key is never exposed to the browser.
- `GROQ_API_KEY` exists only in `.env.local` or deployment server environment settings.
- `.env.example` includes `GROQ_API_KEY=` with no real key.
- No `NEXT_PUBLIC_GROQ_API_KEY` exists.
- `npm run lint` passes.
- `npm run build` passes.

## Final Deliverable

Implement the feature directly in the repository. At the end, report:

- files changed
- schema/RLS changes made
- env changes required
- how to test the tracker
- lint/build result
