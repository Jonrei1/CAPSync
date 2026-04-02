"use client";

import { forwardRef } from "react";

export type FloatingTooltipRow = {
  text: string;
  dot?: string;
};

export type FloatingTooltipContent = {
  title: string;
  rows: FloatingTooltipRow[];
};

type FloatingTooltipProps = {
  tooltip: FloatingTooltipContent | null;
  className: string;
  titleClassName: string;
  rowClassName: string;
  dotClassName: string;
};

const FloatingTooltip = forwardRef<HTMLDivElement, FloatingTooltipProps>(function FloatingTooltip(
  { tooltip, className, titleClassName, rowClassName, dotClassName },
  ref,
) {
  if (!tooltip) {
    return null;
  }

  return (
    <div ref={ref} className={className}>
      <div className={titleClassName}>{tooltip.title}</div>
      {tooltip.rows.map((row, index) => (
        <div key={`${row.text}-${index}`} className={rowClassName}>
          {row.dot ? <span className={dotClassName} style={{ backgroundColor: row.dot }} /> : null}
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  );
});

export default FloatingTooltip;
