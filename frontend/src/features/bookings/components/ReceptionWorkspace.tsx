import type { ReactNode } from "react";
import {
  ReceptionWorkspaceTabs,
  type ReceptionWorkspaceView,
} from "./ReceptionWorkspaceTabs";

export type { ReceptionWorkspaceView } from "./ReceptionWorkspaceTabs";

type ReceptionWorkspaceProps = {
  view: ReceptionWorkspaceView;
  onViewChange: (view: ReceptionWorkspaceView) => void;
  counts: Record<ReceptionWorkspaceView, number>;
  shiftView: ReactNode;
  arrivalsView: ReactNode;
  inHouseView: ReactNode;
  departuresView: ReactNode;
  reservationsView: ReactNode;
};

export const ReceptionWorkspace = ({
  view,
  onViewChange,
  counts,
  shiftView,
  arrivalsView,
  inHouseView,
  departuresView,
  reservationsView,
}: ReceptionWorkspaceProps) => {
  const panels: Array<{ id: ReceptionWorkspaceView; content: ReactNode }> = [
    { id: "shift", content: shiftView },
    { id: "arrivals", content: arrivalsView },
    { id: "in-house", content: inHouseView },
    { id: "departures", content: departuresView },
    { id: "reservations", content: reservationsView },
  ];

  return (
    <section className="space-y-4">
      <ReceptionWorkspaceTabs activeView={view} counts={counts} onViewChange={onViewChange} />
      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          id={`reception-workspace-panel-${panel.id}`}
          aria-labelledby={`reception-workspace-tab-${panel.id}`}
          hidden={view !== panel.id}
          className="min-w-0"
        >
          {panel.content}
        </div>
      ))}
    </section>
  );
};
