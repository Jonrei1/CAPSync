import TrackerBoardWorkspace from "@/components/tracker/TrackerBoardWorkspace";
import { loadTrackerData } from "@/lib/tracker/loadTrackerData";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export default async function TrackerBoardPage({ params }: PageProps) {
  const { groupId } = await Promise.resolve(params);
  const data = await loadTrackerData(groupId);

  return (
    <TrackerBoardWorkspace
      group={data.group}
      members={data.members}
      sprints={data.sprints}
      currentUserId={data.currentUserId}
      canManage={data.canManage}
    />
  );
}
