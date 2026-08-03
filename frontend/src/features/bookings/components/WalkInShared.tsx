import type { Guest, Room } from "@/types/domain";

export type WalkInGuestMode = "existing" | "new";

export type WalkInGuestDraft = {
  full_name: string;
  email: string;
  phone: string;
};

export type WalkInSidebarPanelsProps = {
  guestMode: WalkInGuestMode;
  selectedGuest: Guest | null;
  newGuestName: string;
  selectedRoom: Room | null;
  nights: number;
  checkIn: string;
  checkOut: string;
};

export type WalkInStaySectionProps = {
  checkIn: string;
  checkOut: string;
  minCheckIn: string;
  nights: number;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
};

export type WalkInGuestSectionProps = {
  guestMode: WalkInGuestMode;
  guestSearch: string;
  selectedGuestId: string | null;
  filteredGuests: Guest[];
  guestsLoading: boolean;
  guestsError?: unknown;
  newGuest: WalkInGuestDraft;
  onGuestModeChange: (mode: WalkInGuestMode) => void;
  onGuestSearchChange: (value: string) => void;
  onRefreshGuests: () => void;
  onSelectGuest: (guestId: string) => void;
  onNewGuestChange: (patch: Partial<WalkInGuestDraft>) => void;
};

export type WalkInRoomSelectionSectionProps = {
  nights: number;
  roomsLoading: boolean;
  roomsError: string | null;
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
};
