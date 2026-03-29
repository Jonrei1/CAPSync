import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  subtitle?: string;
};

export function PagePlaceholder({
  title,
  subtitle = "Placeholder content for this route.",
}: PagePlaceholderProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
            CAPSync scaffold page
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
