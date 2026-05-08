"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Methodology } from "@/types";
import { METHODOLOGIES } from "./tracker-utils";

type MethodologyBannerProps = {
  methodology: Methodology;
  canManage: boolean;
  onChangeClick: () => void;
};

export default function MethodologyBanner({ methodology, canManage, onChangeClick }: MethodologyBannerProps) {
  const method = METHODOLOGIES[methodology];
  const Icon = method.icon;

  return (
    <Card className="flex-row items-center gap-4 rounded-lg px-4 py-4 shadow-xs">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{method.name}</h2>
          <Badge variant="secondary">{method.badge}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{method.description}</p>
      </div>
      {canManage ? (
        <Button variant="outline" size="sm" onClick={onChangeClick}>
          Change
        </Button>
      ) : null}
    </Card>
  );
}
