import type { ReactNode } from "react";
import { BedDouble, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  RoomsWorkspaceTabs,
  type RoomsWorkspaceTab,
} from "./RoomsWorkspaceTabs";

type RoomsWorkspaceProps = {
  activeTab: RoomsWorkspaceTab;
  onTabChange: (tab: RoomsWorkspaceTab) => void;
  canManageInventory: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCreateRoom: () => void;
  inventory: ReactNode;
  availability: ReactNode;
  planner: ReactNode;
  holds: ReactNode;
};

export const RoomsWorkspace = ({
  activeTab,
  onTabChange,
  canManageInventory,
  isRefreshing,
  onRefresh,
  onCreateRoom,
  inventory,
  availability,
  planner,
  holds,
}: RoomsWorkspaceProps) => {
  const panels: Array<{ id: RoomsWorkspaceTab; content: ReactNode }> = [
    { id: "inventory", content: inventory },
    { id: "availability", content: availability },
    { id: "planner", content: planner },
    { id: "holds", content: holds },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habitaciones"
        description="Inventario, disponibilidad y bloqueos"
        icon={<BedDouble className="h-5 w-5" />}
        actions={
          <>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isRefreshing}
              onClick={onRefresh}
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isRefreshing ? "Actualizando…" : "Actualizar"}
            </Button>
            {canManageInventory ? (
              <Button className="h-10 rounded-xl" onClick={onCreateRoom}>
                <Plus className="h-4 w-4" />
                Nueva habitación
              </Button>
            ) : null}
          </>
        }
      />

      <RoomsWorkspaceTabs activeTab={activeTab} onTabChange={onTabChange} />

      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          id={`rooms-workspace-panel-${panel.id}`}
          aria-labelledby={`rooms-workspace-tab-${panel.id}`}
          hidden={activeTab !== panel.id}
          className="min-w-0"
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
};
