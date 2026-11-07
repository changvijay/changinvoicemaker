import { NavLink, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, FileText, Users, Settings, Plus, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/documents", label: "Invoices", icon: FileText },
  { to: "/renewals", label: "Renewals", icon: CalendarClock },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AppLayout = ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => {
  const { data: company } = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const { data: reminders } = useQuery({ queryKey: ["reminders"], queryFn: api.reminders, refetchInterval: 5 * 60_000 });
  const dueCount = (reminders?.renewals.length || 0) + (reminders?.invoices.length || 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur print:hidden">
        <div className="h-0.5 bg-brand-gradient" />
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="" className="h-9 w-9 object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient font-bold text-white">C</div>
            )}
            <div className="leading-tight">
              <div className="text-sm font-bold text-foreground">{company?.name || "Chang IT Solutions"}</div>
              <div className="text-[11px] text-muted-foreground">Billing</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
                {to === "/" && dueCount > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white" title="Reminders">
                    {dueCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {actions ?? (
              <>
                <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Link to="/proforma/new">
                    <Plus className="mr-1.5 h-4 w-4" /> Proforma
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-brand-gradient hover:opacity-90">
                  <Link to="/invoice/new">
                    <Plus className="mr-1.5 h-4 w-4" /> New invoice
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
};

export default AppLayout;
