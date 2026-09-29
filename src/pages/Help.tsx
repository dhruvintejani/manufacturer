import React, { useState } from 'react';
import { BookOpen, ChevronDown, ClipboardList, FileText, Factory, LifeBuoy, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

const sections = [
  {
    title: 'Enquiries', icon: ClipboardList, link: '/enquiries',
    introduction: 'Capture customer requirements and move each enquiry from initial contact through quotation and conversion.',
    steps: [
      'Open Enquiries and select New Enquiry to record a customer, product, quantity, requirement, expected delivery and owner.',
      'Open a record to check its contact information. Contact Customer prepares an email in your default mail app.',
      'Create Quotation starts a prefilled quotation using that enquiry. Keep the status current as discussions progress.',
    ],
  },
  {
    title: 'Quotations', icon: FileText, link: '/quotations',
    introduction: 'Prepare commercial offers, preview their line items and convert approved quotations into orders.',
    steps: [
      'Choose a customer and optional enquiry. Add products, quantities, unit prices, discounts, taxes, validity and commercial terms.',
      'Save Draft to preserve the quotation. Generate PDF creates a downloadable document for review and sharing.',
      'Prepare Email opens your email application. Attach the downloaded PDF and send it yourself; this demo does not send email automatically.',
      'Mark the quotation as Sent only after sending. Once approved, use Convert to Order to carry the offer into order management.',
    ],
  },
  {
    title: 'Orders', icon: PackageCheck, link: '/orders',
    introduction: 'Track customer orders through a controlled, auditable manufacturing and dispatch lifecycle.',
    steps: [
      'The normal order sequence is Confirmed → Production → Quality Check → Ready → Dispatched → Completed.',
      'Open an order and choose Update Status to advance one normal step at a time. Optionally add a note.',
      'The status timeline records when each transition happened and who made the change in this demo.',
      'Create a linked production job to manage factory work independently from customer-order dispatch.',
    ],
  },
  {
    title: 'Production', icon: Factory, link: '/production',
    introduction: 'Track manufacturing work independently while keeping the linked order informed of major milestones.',
    steps: [
      'The production sequence is Planning → In Production → Quality Check → Ready → Completed; Delayed flags an exception.',
      'Each job shows its linked order, product, quantity, assigned team, target completion date and progress.',
      'Updating a production milestone can advance its order to the corresponding manufacturing stage; dispatch and completion remain order actions.',
    ],
  },
];

export const Help: React.FC = () => {
  const [expanded, setExpanded] = useState<string[]>(['Enquiries']);
  return (
    <div className="page-shell">
      <PageHeader title="Help & Support" subtitle="Practical guidance for the ForgeFlow manufacturing demo."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Help & Support' }]} />
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-600 p-3 text-white"><BookOpen className="h-6 w-6" /></div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Welcome to ForgeFlow</h2>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">Demo environment</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">This preview stores operational changes in your current browser. It has no shared database, sign-in service or automatic email delivery. Reset Demo Data restores the sample records and discards edits in this browser.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section aria-label="Workflow guidance" className="space-y-3">
          {sections.map(({ title, icon: Icon, link, introduction, steps }) => {
            const open = expanded.includes(title);
            const id = 'help-' + title.toLowerCase();
            return (
              <article key={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2>
                  <button type="button" aria-expanded={open} aria-controls={id}
                    onClick={() => setExpanded(items => open ? items.filter(item => item !== title) : [...items, title])}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5">
                    <span className="flex items-center gap-3"><Icon className="h-5 w-5 text-blue-600" /><span className="text-sm font-semibold text-slate-900">{title}</span></span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                </h2>
                {open && <div id={id} className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                  <p className="text-sm leading-6 text-slate-600">{introduction}</p>
                  <ol className="ml-5 mt-3 list-decimal space-y-2 text-sm leading-6 text-slate-700">
                    {steps.map(step => <li key={step}>{step}</li>)}
                  </ol>
                  <Link to={link} className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100">
                    Open {title}
                  </Link>
                </div>}
              </article>
            );
          })}
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-600" /> A typical project</h2>
            <ol className="mt-4 space-y-3">
              {['Customer enquiry', 'Prepare and share quotation', 'Approve and convert to order', 'Create production job', 'Inspect and mark production ready', 'Dispatch and complete order'].map((name, index) =>
                <li key={name} className="flex items-start gap-3 text-sm text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{index + 1}</span><span className="pt-0.5">{name}</span></li>
              )}
            </ol>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><LifeBuoy className="h-4 w-4 text-blue-600" /> Support & troubleshooting</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">If data seems unexpected, check active filters and search terms, then review your browser's local demo data. For deployment, authentication or live email integration questions, contact the project administrator responsible for this demo.</p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Reset Demo Data is destructive. Export any quotation PDFs you need before resetting.</p>
          </section>
          <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-blue-900"><Sparkles className="h-4 w-4" /> Keyboard tips</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900/80">Use Tab to move between actions. Dropdowns accept arrow keys and Enter. Escape closes a menu or the uppermost open dialog.</p>
          </section>
        </aside>
      </div>
    </div>
  );
};
