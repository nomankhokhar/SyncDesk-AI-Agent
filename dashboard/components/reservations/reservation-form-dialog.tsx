"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  createReservationAction,
  updateReservationAction,
} from "@/actions/reservations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reservationSchema, type ReservationInput } from "@/lib/schemas";
import type { Reservation } from "@/lib/types";

// The form works in the schema's *input* space (party_size arrives as a string
// from <input type="number">); zodResolver coerces it to the output type on
// submit.
type FormValues = z.input<typeof reservationSchema>;

const EMPTY: FormValues = {
  customer_name: "",
  phone: "",
  party_size: 2,
  date: "",
  time: "",
  notes: "",
};

function toInput(r: Reservation): FormValues {
  return {
    customer_name: r.customer_name,
    phone: r.phone,
    party_size: r.party_size,
    date: r.date,
    time: r.time,
    notes: r.notes ?? "",
  };
}

type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      reservation: Reservation;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export function ReservationFormDialog(props: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = props.mode === "edit" ? props.open : uncontrolledOpen;
  const setOpen =
    props.mode === "edit" ? props.onOpenChange : setUncontrolledOpen;

  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues, unknown, ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues:
      props.mode === "edit" ? toInput(props.reservation) : EMPTY,
  });

  // Reset the form whenever the dialog opens (pick up latest row / clear).
  useEffect(() => {
    if (open) {
      form.reset(
        props.mode === "edit" ? toInput(props.reservation) : EMPTY,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(values: ReservationInput) {
    startTransition(async () => {
      const res =
        props.mode === "edit"
          ? await updateReservationAction(props.reservation.id, values)
          : await createReservationAction(values);

      if (!res.ok) {
        if (res.field && res.field in EMPTY) {
          form.setError(res.field as keyof FormValues, {
            message: res.error,
          });
        }
        toast.error(res.error);
        return;
      }

      toast.success(
        props.mode === "edit"
          ? "Reservation updated"
          : `Reservation confirmed (#${res.data.id})`,
      );
      setOpen(false);
    });
  }

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger
          render={
            <Button>
              <PlusIcon />
              New reservation
            </Button>
          }
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "edit" ? "Edit reservation" : "New reservation"}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "edit"
              ? "All fields are replaced."
              : "Enter the guest and booking details."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="reservation-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4"
          noValidate
        >
          <Field label="Name" error={errors.customer_name?.message}>
            <Input
              autoFocus
              placeholder="Ayesha Khan"
              aria-invalid={!!errors.customer_name}
              {...form.register("customer_name")}
            />
          </Field>

          <Field label="Phone" error={errors.phone?.message}>
            <Input
              type="tel"
              placeholder="+14155551234"
              aria-invalid={!!errors.phone}
              {...form.register("phone")}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Guests" error={errors.party_size?.message}>
              <Input
                type="number"
                min={1}
                max={50}
                aria-invalid={!!errors.party_size}
                {...form.register("party_size")}
              />
            </Field>
            <Field label="Date" error={errors.date?.message}>
              <Input
                type="date"
                aria-invalid={!!errors.date}
                {...form.register("date")}
              />
            </Field>
            <Field label="Time" error={errors.time?.message}>
              <Input
                type="time"
                aria-invalid={!!errors.time}
                {...form.register("time")}
              />
            </Field>
          </div>

          <Field label="Notes (optional)" error={errors.notes?.message}>
            <Textarea
              rows={2}
              placeholder="Window seat, allergy, …"
              {...form.register("notes")}
            />
          </Field>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="reservation-form" disabled={pending}>
            {pending
              ? "Saving…"
              : props.mode === "edit"
                ? "Save changes"
                : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
    </div>
  );
}
