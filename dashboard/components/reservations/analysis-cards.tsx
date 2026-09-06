import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Analysis } from "@/lib/types";

export function AnalysisCards({ analysis }: { analysis: Analysis }) {
  const stats = [
    { label: "Confirmed", value: analysis.confirmed },
    { label: "Cancelled", value: analysis.cancelled },
    { label: "Total guests", value: analysis.total_guests },
    {
      label: "Avg party size",
      value:
        analysis.confirmed > 0 ? analysis.avg_party_size.toFixed(1) : "—",
    },
  ];

  const byDate = Object.entries(analysis.by_date).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const max = Math.max(1, ...byDate.map(([, n]) => n));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-semibold tabular-nums">
                {s.value}
              </div>
              <div className="text-muted-foreground text-xs">{s.label}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Confirmed by date
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byDate.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No confirmed bookings yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {byDate.map(([date, n]) => (
                <li key={date} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-28 shrink-0 text-xs">
                    {formatDate(date)}
                  </span>
                  <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums">
                    {n}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {analysis.busiest_date ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Busiest: {formatDate(analysis.busiest_date)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
