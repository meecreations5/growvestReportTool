import Card from "./Card";
import PageHeader from "./PageHeader";

export default function ModulePlaceholder({ eyebrow, title, description, items }) {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-bold text-slate-950">Included in the reconciled scope</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div key={item} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-blue-700">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
