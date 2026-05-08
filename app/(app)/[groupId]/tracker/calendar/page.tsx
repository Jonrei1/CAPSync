import TrackerCalendar from "@/components/tracker/TrackerCalendar";
import { loadTrackerData } from "@/lib/tracker/loadTrackerData";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export default async function TrackerCalendarPage({ params }: PageProps) {
  const { groupId } = await Promise.resolve(params);
  const data = await loadTrackerData(groupId);

  return (
    <TrackerCalendar
      group={data.group}
      members={data.members}
      sprints={data.sprints}
      tasks={data.tasks}
      currentUserId={data.currentUserId}
      canManage={data.canManage}
    />
  );
}
