import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
}) => {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4 sm:mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex min-w-0 flex-wrap items-center gap-1 mb-1.5" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <span className={`text-xs font-medium ${index === breadcrumbs.length - 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="break-words text-xl font-bold tracking-tight leading-tight text-slate-900 sm:text-2xl"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.05 }}
            className="break-words text-sm leading-relaxed text-slate-500 mt-1"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.1 }}
          className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3"
        >
          {actions}
        </motion.div>
      )}
    </div>
  );
};
