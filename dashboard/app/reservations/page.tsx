import { AnalysisCards } from "@/components/reservations/analysis-cards";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { getAnalysis, getReservations } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const [reservations, analysis] = await Promise.all([
    getReservations(),
    getAnalysis(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-semibold">Reservations</h1>
          <p className="text-muted-foreground text-sm">
            {analysis.confirmed} confirmed · {analysis.cancelled} cancelled
          </p>
        </div>
        <ReservationFormDialog mode="create" />
      </div>

      <AnalysisCards analysis={analysis} />
      <ReservationsTable reservations={reservations} />
    </div>
  );
}
