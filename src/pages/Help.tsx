import React, { useState } from 'react';
import {
  Archive, BarChart3, BookOpen, Boxes, ChevronDown, ClipboardList, Factory,
  FileText, Layers3, LifeBuoy, PackageCheck, ShieldCheck, ShoppingBag, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

const sections = [
  {
    title: 'Enquiries', icon: ClipboardList, link: '/enquiries',
    introduction: 'Capture customer requirements and move each enquiry into a quotation and confirmed order.',
    steps: [
      'Open Enquiries and select New Enquiry to record the customer, product, quantity, requirement, expected delivery and owner.',
      'Open a record to review contact details and the commercial requirement before preparing a quotation.',
      'Create Quotation carries the enquiry into the quotation editor so the customer, product and quantity stay connected.',
    ],
  },
  {
    title: 'Quotations', icon: FileText, link: '/quotations',
    introduction: 'Prepare the commercial offer, export it as PDF and convert an approved quotation into a sales order.',
    steps: [
      'Add products, quantities, unit prices, discounts, taxes, validity and commercial terms.',
      'Save Draft while preparing the offer. Generate PDF creates a downloadable quotation document.',
      'Mark the quotation Sent only after sharing it with the customer. When accepted, mark it Approved and use Convert to Order.',
    ],
  },
  {
    title: 'Orders & Material Check', icon: PackageCheck, link: '/orders',
    introduction: 'Every confirmed order is connected to the product BOM before production can begin.',
    steps: [
      'When an order is created, ForgeFlow reads the selected product BOM and calculates the total material requirement from the order quantity.',
      'The Material Readiness panel compares required quantity with stock reserved for that order. A shortage keeps Create Production Job disabled.',
      'If every BOM line is reserved, the order becomes material-ready and production can start. Cancelling an order releases any open reservations.',
    ],
  },
  {
    title: 'Product BOM', icon: Layers3, link: '/bom',
    introduction: 'A BOM (Bill of Materials) defines exactly which materials and quantities are required to manufacture one unit of a product.',
    steps: [
      'Choose a product and review the material lines required per manufactured unit.',
      'Edit the BOM to add, remove or change material quantities. Saving a BOM creates the next BOM version.',
      'Open orders that have not started production are recalculated from the updated BOM so requirements and reservations stay synchronized.',
    ],
  },
  {
    title: 'Inventory / Stock', icon: Archive, link: '/inventory',
    introduction: 'Inventory separates physical stock, reserved stock and available stock so the same material cannot be promised twice.',
    steps: [
      'Physical Stock is the quantity currently on hand. Reserved Stock is held for open material requirements. Available Stock is physical minus reserved.',
      'Open a material to see which orders hold reservations and to review the complete stock transaction ledger.',
      'Manual stock adjustments require a reason and cannot reduce physical stock below quantities already reserved for open orders.',
      'Low Stock and Out of Stock statuses are based on the minimum stock level configured in Material Master.',
    ],
  },
  {
    title: 'Purchase / Restock', icon: ShoppingBag, link: '/purchases',
    introduction: 'Resolve material shortages through a controlled Requested → Ordered → Received restock workflow.',
    steps: [
      'A shortage can create a restock request linked to the affected order and material. Duplicate open requests for the same shortage are blocked.',
      'Move the request from Requested to Ordered when the supplier order is placed.',
      'Receive Material only after it has been ordered. Receiving adds stock, writes an inventory transaction and recalculates order reservations.',
      'When the last shortage is resolved, the linked order becomes material-ready automatically and can move into production.',
    ],
  },
  {
    title: 'Production', icon: Factory, link: '/production',
    introduction: 'Production starts only after all required BOM material is reserved and then consumes that reserved stock exactly once.',
    steps: [
      'Create Production Job from a material-ready order. Starting production converts each reserved BOM quantity into a stock-consumption transaction.',
      'The production sequence is Planning → In Production → Quality Check → Ready → Completed; Delayed is an exception state.',
      'Quality Check and Ready milestones synchronize the linked order. Dispatch and final order completion remain controlled from Orders.',
      'Because consumption is recorded when production starts, reopening or updating the job does not deduct the same material a second time.',
    ],
  },
  {
    title: 'Reports', icon: BarChart3, link: '/reports',
    introduction: 'Reports read the same live sales, production, inventory, consumption and purchasing data used by the operational pages.',
    steps: [
      'Use the Inventory report to review stock position, shortages, consumption and purchase/restock activity.',
      'Download Current Report PDF for the active report tab or Complete PDF for the full operations report.',
      'PDF totals are generated from the application data rather than screenshots, so they stay synchronized with the current demo state.',
    ],
  },
];

export const Help: React.FC = () => {
  const [expanded, setExpanded] = useState<string[]>(['Orders & Material Check', 'Product BOM', 'Inventory / Stock', 'Purchase / Restock', 'Production']);

  return (
    <div className="page-shell">
      <PageHeader
        title="Help & Support"
        subtitle="Practical guidance for the complete ForgeFlow manufacturing workflow."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Help & Support' }]}
      />

      <section aria-label="End-to-end workflow" className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-600 p-3 text-white"><BookOpen className="h-6 w-6" /></div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">ForgeFlow end-to-end demo</h2>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">Browser demo</span>
            </div>
            <p className="max-w-4xl text-sm leading-6 text-slate-600">
              The connected workflow is Customer → Enquiry → Quotation → Order → Product BOM → Material Requirement → Inventory Check → Production → Quality Check → Ready → Dispatched → Completed → Reports.
              If stock is short, the order branches through Purchase / Restock → Material Received → Inventory Updated before production can start.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
              {['Order confirmed', 'BOM calculated', 'Stock reserved', 'Restock if short', 'Consume on production start', 'Complete & report'].map((label, index) => (
                <span key={label} className="rounded-full border border-blue-100 bg-white px-3 py-1.5">
                  {index + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section aria-label="Workflow guidance" className="space-y-3">
          {sections.map(({ title, icon: Icon, link, introduction, steps }) => {
            const open = expanded.includes(title);
            const id = 'help-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return (
              <article key={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setExpanded(items => open ? items.filter(item => item !== title) : [...items, title])}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900">{title}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                </h2>
                {open && (
                  <div id={id} className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                    <p className="text-sm leading-6 text-slate-600">{introduction}</p>
                    <ol className="ml-5 mt-3 list-decimal space-y-2 text-sm leading-6 text-slate-700">
                      {steps.map(step => <li key={step}>{step}</li>)}
                    </ol>
                    <Link
                      to={link}
                      className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      Open {title}
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-600" /> Material control rules</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p className="flex gap-2"><Boxes className="mt-1 h-4 w-4 shrink-0 text-violet-600" /><span><strong className="text-slate-800">Reserve before production:</strong> open orders reserve available stock from their BOM requirement.</span></p>
              <p className="flex gap-2"><ShoppingBag className="mt-1 h-4 w-4 shrink-0 text-amber-600" /><span><strong className="text-slate-800">Restock shortages:</strong> receiving purchased material updates stock and recalculates reservations.</span></p>
              <p className="flex gap-2"><Factory className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /><span><strong className="text-slate-800">Consume once:</strong> production start consumes reserved material exactly once and writes the inventory ledger.</span></p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><LifeBuoy className="h-4 w-4 text-blue-600" /> Demo data & troubleshooting</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This preview stores operational changes in the current browser. It has no shared production database, sign-in service or automatic email delivery. Check active filters, search terms and linked order/material records if a value looks unexpected.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Reset Demo Data is destructive. It restores the original customers, enquiries, quotations, orders, production jobs, materials, product BOMs, inventory ledger, purchase/restock requests, notifications, activity history and demo profile in this browser.
            </p>
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
