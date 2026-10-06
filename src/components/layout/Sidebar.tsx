import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, ClipboardList, FileText,
  ShoppingCart, Factory, BarChart3, Settings,
  HelpCircle, ChevronLeft, ChevronRight, Zap,
  Boxes, Layers3, Archive, ShoppingBag, X
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAppStore } from '../../store/useAppStore';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/dashboard' },
  ]},
  { label: 'Sales & Customers', items: [
    { label: 'Customers', icon: <Users className="w-5 h-5" />, path: '/customers' },
    { label: 'Enquiries', icon: <ClipboardList className="w-5 h-5" />, path: '/enquiries' },
    { label: 'Quotations', icon: <FileText className="w-5 h-5" />, path: '/quotations' },
    { label: 'Orders', icon: <ShoppingCart className="w-5 h-5" />, path: '/orders' },
  ]},
  { label: 'Manufacturing', items: [
    { label: 'Product BOM', icon: <Layers3 className="w-5 h-5" />, path: '/bom' },
    { label: 'Production', icon: <Factory className="w-5 h-5" />, path: '/production' },
  ]},
  { label: 'Materials & Procurement', items: [
    { label: 'Materials', icon: <Boxes className="w-5 h-5" />, path: '/materials' },
    { label: 'Inventory / Stock', icon: <Archive className="w-5 h-5" />, path: '/inventory' },
    { label: 'Purchase / Restock', icon: <ShoppingBag className="w-5 h-5" />, path: '/purchases' },
  ]},
  { label: 'Analytics', items: [
    { label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, path: '/reports' },
  ]},
];

const bottomItems: NavItem[] = [
  { label: 'Settings', icon: <Settings className="w-5 h-5" />, path: '/settings' },
  { label: 'Help', icon: <HelpCircle className="w-5 h-5" />, path: '/help' },
];

interface SidebarProps {
  mobile?: boolean;
}

const Logo = ({ collapsed }: { collapsed: boolean }) => (
  <div className="flex items-center gap-3 px-4 py-5">
    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
      <Zap className="w-5 h-5 text-white" />
    </div>
    <AnimatePresence>
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="text-white font-bold text-base tracking-tight whitespace-nowrap font-['Plus_Jakarta_Sans',sans-serif]">
            ForgeFlow
          </div>
          <div className="text-blue-300 text-[10px] font-medium tracking-wide whitespace-nowrap">
            Manufacturing Operations
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ mobile = false }) => {
  const { sidebarCollapsed, setSidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen, profile } = useAppStore();
  const location = useLocation();

  const collapsed = mobile ? false : sidebarCollapsed;

  const NavItemComp = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    return (
      <NavLink
        to={item.path}
        onClick={() => mobile && setSidebarMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex cursor-pointer items-center gap-3 rounded-lg border-l-[3px] transition-colors duration-150',
          collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive
            ? 'border-blue-300 bg-blue-600/85 text-white shadow-sm'
            : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
        )}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {/* Tooltip for collapsed */}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {item.label}
          </div>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col" style={{ background: '#0F1F3D' }}>
      <Logo collapsed={collapsed} />

      {/* Main Nav */}
      <div className="px-3 flex-1 overflow-y-auto sidebar-scroll">
        <div className="space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              {!collapsed && <div className="px-3 pb-2 text-[10px] font-bold tracking-[.18em] text-slate-400 uppercase">{group.label}</div>}
              <div className="space-y-1">
                {group.items.map(item => <NavItemComp key={item.path} item={item} />)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 space-y-1">
          {!collapsed && <div className="px-3 pb-2 text-[10px] font-bold tracking-[.18em] text-slate-400 uppercase">Manage</div>}
          {bottomItems.map(item => (
            <NavItemComp key={item.path} item={item} />
          ))}
        </div>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-white/10">
        <NavLink to="/settings" onClick={() => mobile && setSidebarMobileOpen(false)} aria-label="Account settings" className={cn(
          'flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/10 transition-colors cursor-pointer',
          collapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{profile.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="text-white text-sm font-medium whitespace-nowrap">{profile.name}</div>
                <div className="text-slate-400 text-xs whitespace-nowrap">{profile.role || 'Demo User'}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </NavLink>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3.5 top-20 w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 shadow-sm transition-colors z-10"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );

  if (mobile) {
    return (
      <AnimatePresence>
        {sidebarMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-30"
              onClick={() => setSidebarMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[min(18rem,90vw)] z-40"
            >
              <button
                onClick={() => setSidebarMobileOpen(false)}
                className="absolute right-3 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-50"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 264 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative hidden lg:block flex-shrink-0 h-screen overflow-visible"
      style={{ background: '#0F1F3D' }}
    >
      {sidebarContent}
    </motion.aside>
  );
};
