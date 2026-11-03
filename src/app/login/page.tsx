import { ActionForm, Submit } from "@/components/forms";
import { Card, inputCls } from "@/components/ui";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card>
        <h1 className="text-xl font-bold">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Dashboard Social Autopilot Marqthink</p>
        <ActionForm action={login} className="mt-5 space-y-3">
          <input type="password" name="password" placeholder="Password admin" className={inputCls} required autoFocus />
          <Submit className="w-full" pendingText="Masuk…">Masuk</Submit>
        </ActionForm>
      </Card>
    </div>
  );
}
