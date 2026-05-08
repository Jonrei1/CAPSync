import TrackerWorkspace from "@/components/tracker/TrackerWorkspace";
import { loadTrackerData } from "@/lib/tracker/loadTrackerData";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export default async function CircleTrackerPage({ params }: PageProps) {
  const { groupId } = await Promise.resolve(params);
  const data = await loadTrackerData(groupId);

  return (
    <TrackerWorkspace
      group={data.group}
      members={data.members}
      sprints={data.sprints}
      currentUserId={data.currentUserId}
      canManage={data.canManage}
    />
  );
}
