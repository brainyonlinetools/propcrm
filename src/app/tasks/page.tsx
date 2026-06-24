"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TaskItem } from "@/components/tasks/TaskItem";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { useTasks } from "@/lib/queries/tasks";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const [showDone, setShowDone] = useState(false);
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading, isError } = useTasks(showDone);

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const incomplete = tasks.filter((t) => !t.is_done);
  const completed = tasks.filter((t) => t.is_done);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-done" className="text-xs text-muted-foreground">
              Show done
            </Label>
            <Switch
              id="show-done"
              checked={showDone}
              onCheckedChange={setShowDone}
            />
          </div>
        </div>
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
            <h2 className="text-base font-semibold">Could not load tasks</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your Supabase connection.
            </p>
            <Button className="mt-4" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-base font-semibold">No follow-ups due</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tasks are created from lead detail pages when you schedule a callback or site visit.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!showDone
              ? incomplete.map((task) => <TaskItem key={task.id} task={task} />)
              : (
                <>
                  {incomplete.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Pending
                      </p>
                      {incomplete.map((task) => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </>
                  )}
                  {completed.length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-medium text-muted-foreground uppercase">
                        Completed
                      </p>
                      {completed.map((task) => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </>
                  )}
                </>
              )}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
