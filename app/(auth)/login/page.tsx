import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>CAPSync Login</CardTitle>
          <CardDescription>Authentication UI placeholder</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">Continue</Button>
        </CardContent>
      </Card>
    </section>
  );
}
