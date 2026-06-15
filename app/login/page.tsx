import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-serif text-2xl font-semibold tracking-tight text-ink">
            NOVA
          </span>
        </div>
        <Card className="w-full shadow-sm">
          <CardHeader>
            <p className="eyebrow">NOVA · Portal</p>
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription>
              Client and setter access for NOVA Consulting and Setters
              Collaborative.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          The only setup you need in one place.
        </p>
      </div>
    </div>
  );
}
