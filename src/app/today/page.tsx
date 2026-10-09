"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskItem } from "@/components/tasks/TaskItem";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { useTasks } from "@/lib/queries/tasks";
import { sellersKey, useSellers } from "@/lib/queries/sellers";
import { splitOverdueToday } from "@/lib/todayList";
import { formatPhone, phoneToTel } from "@/lib/utils";
import type { Seller } from "@/types";

export default function TodayPage() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: tasks = [], isLoading: tasksLoading, isError: tasksError } =
    useTasks(false);
  const { data: sellers = [], isLoading: sellersLoading, isError: sellersError } =
    useSellers();

  const { overdueTasks, todayTasks, overdueSellers, todaySellers } = useMemo(() => {
    const taskSplit = splitOverdueToday(tasks, (t) => t.due_date, todayStr);
    const sellerSplit = splitOverdueToday(sellers, (s) => s.follow_up_date, todayStr);
    return {
      overdueTasks: taskSplit.overdue,
      todayTasks: taskSplit.today,
      overdueSellers: sellerSplit.overdue,
      todaySellers: sellerSplit.today,
    };
  }, [tasks, sellers, todayStr]);

  const isLoading = tasksLoading || sellersLoading;
  const isError = tasksError || sellersError;
  const totalCount =
    overdueTasks.length + todayTasks.length + overdueSellers.length + todaySellers.length;

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: sellersKey }),
    ]);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-lg font-semibold tracking-tight">Today</h1>
        <p className="text-xs text-muted-foreground">
          {format(new Date(), "EEEE, d MMM yyyy")}
          {totalCount > 0 && ` · ${totalCount} due`}
        </p>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-base font-semibold">Could not load today&apos;s list</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your Supabase connection.
            </p>
            <Button className="mt-4" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : totalCount === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-base font-semibold">All clear</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing due today. New follow-ups from the call queue land here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {(overdueTasks.length > 0 || overdueSellers.length > 0) && (
              <section>
                <SectionTitle label="Overdue" />
                <div className="flex flex-col gap-3">
                  {overdueTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                  {overdueSellers.map((seller) => (
                    <SellerFollowUpRow key={seller.id} seller={seller} />
                  ))}
                </div>
              </section>
            )}

            {(todayTasks.length > 0 || todaySellers.length > 0) && (
              <section>
                <SectionTitle label="Due today" />
                <div className="flex flex-col gap-3">
                  {todayTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                  {todaySellers.map((seller) => (
                    <SellerFollowUpRow key={seller.id} seller={seller} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">{label}</p>
  );
}

function SellerFollowUpRow({ seller }: { seller: Seller }) {
  const subtitle = [seller.unit_number, seller.projects?.name]
    .filter(Boolean)
    .join(" · ");
  const phone = seller.contact_phone ?? seller.alt_phone;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
      <Link
        href={`/sellers/${seller.id}`}
        className="min-w-0 flex-1 rounded-md hover:opacity-80"
      >
        <p className="truncate text-sm font-semibold">
          Follow up: {seller.owner_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[subtitle, phone ? formatPhone(phone) : null].filter(Boolean).join(" · ")}
        </p>
      </Link>
      {phone && (
        <Button asChild variant="outline" size="icon" className="shrink-0" aria-label={`Call ${seller.owner_name}`}>
          <a href={`tel:${phoneToTel(phone)}`}>
            <Phone />
          </a>
        </Button>
      )}
    </div>
  );
}
