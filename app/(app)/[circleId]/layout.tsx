import type { ReactNode } from "react";

type CircleLayoutProps = {
  children: ReactNode;
};

export default function CircleLayout({ children }: CircleLayoutProps) {
  return <>{children}</>;
}
