"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";

import {
  cancelReservationAction,
  deleteReservationAction,
} from "@/actions/reservations";
import { ConfirmDialog } from "@/components/reservations/confirm-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/format";
import type { Reservation } from "@/lib/types";

export function ReservationsTable({
  reservations,
}: {
  reservations: Reservation[];
}) {
  if (reservations.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
        No reservations yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((r) => (
            <ReservationRow key={r.id} reservation={r} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReservationRow({ reservation: r }: { reservation: Reservation }) {
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const cancelled = r.status === "cancelled";

  return (
    <>
      <TableRow className={cancelled ? "text-muted-foreground" : undefined}>
        <TableCell className="font-medium">
          {r.customer_name}
          {r.notes ? (
            <span className="text-muted-foreground block text-xs font-normal">
              {r.notes}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="tabular-nums">{r.party_size}</TableCell>
        <TableCell className="whitespace-nowrap">
          {formatDate(r.date)}
          <span className="text-muted-foreground"> · {formatTime(r.time)}</span>
        </TableCell>
        <TableCell className="tabular-nums">{r.phone}</TableCell>
        <TableCell>
          <Badge variant={cancelled ? "secondary" : "default"}>
            {r.status}
          </Badge>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Actions" />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={cancelled}
                onClick={() => setCancelOpen(true)}
              >
                Cancel booking
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <ReservationFormDialog
        mode="edit"
        reservation={r}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this booking?"
        description={`${r.customer_name}, ${formatDate(r.date)} at ${formatTime(
          r.time,
        )}. The row stays but is marked cancelled.`}
        confirmLabel="Cancel booking"
        action={() => cancelReservationAction(r.id)}
        successMessage="Booking cancelled"
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this reservation?"
        description={`${r.customer_name}, ${formatDate(r.date)}. This removes the record permanently.`}
        confirmLabel="Delete"
        destructive
        action={() => deleteReservationAction(r.id)}
        successMessage="Reservation deleted"
      />
    </>
  );
}
