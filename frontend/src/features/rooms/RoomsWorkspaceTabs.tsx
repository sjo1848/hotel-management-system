import { TabStrip } from "@/components/ui/tab-strip";

export type RoomsWorkspaceTab = "inventory" | "availability" | "planner" | "holds";

export const roomsWorkspaceTabs: Array<{ id: RoomsWorkspaceTab; label: string }> = [
  { id: "inventory", label: "Inventario" },
  { id: "availability", label: "Disponibilidad" },
  { id: "planner", label: "Planificador" },
  { id: "holds", label: "Bloqueos" },
];

type RoomsWorkspaceTabsProps = {
  activeTab: RoomsWorkspaceTab;
  onTabChange: (tab: RoomsWorkspaceTab) => void;
};

export const RoomsWorkspaceTabs = ({ activeTab, onTabChange }: RoomsWorkspaceTabsProps) => (
  <TabStrip
    tabs={roomsWorkspaceTabs}
    activeTab={activeTab}
    onTabChange={onTabChange}
    ariaLabel="Tareas del workspace de habitaciones"
    idPrefix="rooms-workspace"
  />
);
