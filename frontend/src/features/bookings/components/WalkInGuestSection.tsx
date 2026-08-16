import { Loader2, Mail, Phone, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WalkInGuestSectionProps } from "@/features/bookings/components/WalkInShared";

export const WalkInGuestSection = ({
  guestMode,
  guestSearch,
  selectedGuestId,
  filteredGuests,
  guestsLoading,
  guestsError,
  newGuest,
  onGuestModeChange,
  onGuestSearchChange,
  onRefreshGuests,
  onSelectGuest,
  onNewGuestChange,
  guestPickerOpen,
  onGuestPickerOpenChange,
}: WalkInGuestSectionProps) => (
  <div className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        {guestMode === "existing" ? <Users className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-foreground">Huesped</p>
            <p className="text-sm text-muted-foreground">
              Usa una ficha existente o registra alta rapida sin salir del panel.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1">
            <Button
              type="button"
              size="sm"
              variant={guestMode === "existing" ? "default" : "ghost"}
              className={cn("rounded-xl", guestMode === "existing" && "shadow-sm")}
              onClick={() => onGuestModeChange("existing")}
            >
              Existente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={guestMode === "new" ? "default" : "ghost"}
              className={cn("rounded-xl", guestMode === "new" && "shadow-sm")}
              onClick={() => onGuestModeChange("new")}
            >
              Alta rapida
            </Button>
          </div>
        </div>

        {guestMode === "existing" ? (
          <div className="space-y-4">
            <div className="md:hidden">
              <Button type="button" variant="outline" className="h-auto w-full justify-between rounded-2xl px-4 py-3 text-left" onClick={() => onGuestPickerOpenChange(true)}>
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Huésped seleccionado</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-foreground">
                    {selectedGuestId ? filteredGuests.find((guest) => guest.id === selectedGuestId)?.full_name ?? "Huésped seleccionado" : "Elegir de la base de huéspedes"}
                  </span>
                </span>
                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </div>

            <div className="hidden space-y-4 md:block">
            <div className="grid gap-2">
              <Label htmlFor="guest-search">Buscar huesped</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="guest-search"
                  value={guestSearch}
                  onChange={(event) => onGuestSearchChange(event.target.value)}
                  placeholder="Nombre, email o telefono"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Base de huespedes
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={onRefreshGuests}
                >
                  Actualizar
                </Button>
              </div>

              {guestsLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando huespedes...
                </div>
              ) : guestsError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  {String(guestsError)}
                </div>
              ) : filteredGuests.length === 0 ? (
                <div className="rounded-2xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                  No hay coincidencias. Cambia a alta rapida si es un walk-in nuevo.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGuests.map((guest) => (
                    <button
                      key={guest.id}
                      type="button"
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                        selectedGuestId === guest.id
                          ? "border-primary/20 bg-primary/10 shadow-sm"
                          : "border-border bg-background hover:border-primary/20 hover:bg-primary/10",
                      )}
                      onClick={() => onSelectGuest(guest.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{guest.full_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{guest.email}</p>
                          {guest.phone ? (
                            <p className="mt-1 text-xs text-muted-foreground">{guest.phone}</p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                            selectedGuestId === guest.id
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {selectedGuestId === guest.id ? "Activo" : "Seleccionar"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>

            {guestPickerOpen ? (
              <div
                role="region"
                aria-labelledby="mobile-guest-picker-title"
                className="mt-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm md:hidden"
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onGuestPickerOpenChange(false);
                }}
              >
                <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 id="mobile-guest-picker-title" className="text-base font-bold text-foreground">Seleccionar huésped</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Busca por nombre, email o teléfono.</p>
                  </div>
                  <Button type="button" variant="ghost" aria-label="Cerrar selección de huésped" className="h-11 w-11 shrink-0 rounded-xl p-0" onClick={() => onGuestPickerOpenChange(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="max-h-[52vh] overflow-y-auto pt-4">
                  <Label htmlFor="mobile-guest-search">Buscar huésped</Label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="mobile-guest-search" value={guestSearch} onChange={(event) => onGuestSearchChange(event.target.value)} placeholder="Nombre, email o teléfono" className="h-12 rounded-xl pl-9" autoFocus />
                  </div>
                  <div className="mt-4 space-y-2">
                    {guestsLoading ? <div className="flex items-center gap-2 rounded-2xl border border-border px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando huéspedes...</div> : guestsError ? <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-4 text-sm text-destructive">{String(guestsError)}</div> : filteredGuests.length === 0 ? <div className="rounded-2xl border border-border px-3 py-4 text-sm text-muted-foreground">No hay coincidencias. Prueba alta rápida.</div> : filteredGuests.map((guest) => (
                      <button key={guest.id} type="button" className={cn("w-full rounded-2xl border px-4 py-3 text-left", selectedGuestId === guest.id ? "border-primary/20 bg-primary/10" : "border-border bg-background")} onClick={() => { onSelectGuest(guest.id); onGuestPickerOpenChange(false); }}>
                        <p className="text-sm font-bold text-foreground">{guest.full_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{guest.email}{guest.phone ? ` · ${guest.phone}` : ""}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="new-guest-name">Nombre completo</Label>
              <Input
                id="new-guest-name"
                value={newGuest.full_name}
                onChange={(event) => onNewGuestChange({ full_name: event.target.value })}
                placeholder="Ej: Maria Lopez"
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-guest-email" className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="new-guest-email"
                type="email"
                value={newGuest.email}
                onChange={(event) => onNewGuestChange({ email: event.target.value })}
                placeholder="huesped@correo.com"
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-guest-phone" className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefono
              </Label>
              <Input
                id="new-guest-phone"
                value={newGuest.phone}
                onChange={(event) => onNewGuestChange({ phone: event.target.value })}
                placeholder="+54 11 5555 5555"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
