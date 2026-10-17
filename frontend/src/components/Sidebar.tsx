import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  PlayCircle,
  Cpu,
  BarChart3,
  ScrollText,
  BookOpen,
  Info
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/database', label: 'Database Manager', icon: Database },
    { to: '/simulation', label: 'Simulation Lab', icon: PlayCircle },
    { to: '/visualizer', label: 'Live Visualizer', icon: Cpu },
    { to: '/analytics', label: 'Performance Analytics', icon: BarChart3 },
    { to: '/logs', label: 'Activity Logs', icon: ScrollText },
    { to: '/explainer', label: 'Algorithm Explainer', icon: BookOpen },
    { to: '/about', label: 'About Project', icon: Info },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between p-4 flex-shrink-0">
      <div>
        <div className="px-3 py-2 mb-6">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold tracking-wider text-xs uppercase">
            <span>Operating System Lab</span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">POSIX Concurrency</div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-900 pt-4 px-3">
        <div className="text-[11px] text-slate-400 font-medium">Project Group G-15</div>
        <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
          <div>B. Thrinadh (2520030529)</div>
          <div>Madhan (2520030263)</div>
          <div>M. Nihal (2520030124)</div>
        </div>
      </div>
    </aside>
  );
};
