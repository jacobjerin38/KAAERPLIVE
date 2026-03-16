import React from 'react';
import { ModuleConfig } from '../types';
import { ArrowRight } from 'lucide-react';

interface ModuleCardProps {
  module: ModuleConfig;
  onClick: () => void;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ module, onClick }) => {
  const Icon = module.icon;

  return (
    <div 
      onClick={onClick}
      className="group relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 flex flex-col justify-between h-56 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/30 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      <div className="flex items-start justify-between z-10">
        <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${module.bgColor} transition-transform duration-300 group-hover:scale-105`}>
          <Icon className={`w-6 h-6 ${module.color}`} strokeWidth={2} />
        </div>
      </div>

      <div className="z-10 mt-4">
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-white group-hover:text-black dark:group-hover:text-zinc-200 transition-colors tracking-tight">
          {module.name}
        </h3>
        <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
          {module.description}
        </p>
      </div>

      <div className="absolute bottom-6 right-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        <ArrowRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
      </div>
    </div>
  );
};