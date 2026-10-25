
import { ClipboardCheck, Sparkles } from "lucide-react";

export default function PlanResult({ plan }) {
  if (!plan) return null;

  const content =
    typeof plan === "string"
      ? plan
      : plan.content || plan.text || JSON.stringify(plan, null, 2);

  return (
    <section className="panel">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
          <ClipboardCheck size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Your party plan</h2>
          <p className="text-sm text-slate-500">
            Prepared by your AI planning team
          </p>
        </div>
      </div>

      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
        {content}
      </div>

      <div className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <Sparkles size={16} className="mt-0.5 shrink-0" />
        Confirm prices, capacity, and availability with providers directly.
      </div>
    </section>
  );
}
