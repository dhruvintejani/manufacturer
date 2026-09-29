import React, { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastProvider } from '../ui/Toast';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // The content is scrolled inside <main>, not the browser window.
  // Reset instantly before the next route is painted, including links
  // that change the search query while staying on the same path.
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.key]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC]">
      <ToastProvider />
      <Sidebar />
      <Sidebar mobile />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
