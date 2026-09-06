"use client";

import React, { useState } from 'react';
import { Database, Plus, Bell, BookOpen, Heart, Briefcase, Sparkles, Check, Trash2 } from 'lucide-react';
import { MemoryFact, ReminderItem } from '../types';

interface MemoryInspectorProps {
  memories: { facts: MemoryFact[]; reminders: ReminderItem[] };
  onAddFact?: (fact: string, category: string) => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ memories, onAddFact }) => {
  const [newFact, setNewFact] = useState('');
  const [category, setCategory] = useState('preference');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    onAddFact?.(newFact.trim(), category);
    setNewFact('');
    setIsAdding(false);
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'education':
        return { label: 'Education', icon: BookOpen, color: 'text-blue-300 bg-blue-500/15 border-blue-500/25' };
      case 'project':
        return { label: 'Project', icon: Briefcase, color: 'text-purple-300 bg-purple-500/15 border-purple-500/25' };
      case 'preference':
        return { label: 'Preference', icon: Heart, color: 'text-pink-300 bg-pink-500/15 border-pink-500/25' };
      default:
        return { label: 'General', icon: Database, color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25' };
    }
  };

  return (
    <div className="bg-[#0d091e]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database size={16} className="text-purple-400" />
          <span>Cross-Session Long-Term Memory</span>
        </div>
        <span className="text-[11px] font-mono text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/20">
          {memories.facts.length} facts saved
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Ayra automatically remembers context across calls so you never have to repeat yourself.
      </p>

      {/* Facts List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {memories.facts.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 italic">
            No long-term facts stored yet. Add a fact below!
          </div>
        ) : (
          memories.facts.map((f) => {
            const meta = getCategoryMeta(f.category);
            const Icon = meta.icon;
            return (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-all text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                    <Icon size={11} />
                    {meta.label}
                  </span>
                  <span className="font-mono text-slate-500">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">{f.fact}</p>
              </div>
            );
          })
        )}

        {/* Reminders list */}
        {memories.reminders && memories.reminders.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Bell size={12} className="text-amber-400" />
              <span>Active Reminders</span>
            </div>
            {memories.reminders.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs flex items-center justify-between"
              >
                <span className="text-amber-200">{r.text}</span>
                <span className="text-[10px] text-slate-400 font-mono">{r.timeString}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Fact Form */}
      {isAdding ? (
        <form onSubmit={handleAdd} className="pt-3 border-t border-white/[0.08] space-y-2.5 animate-in fade-in duration-150">
          <input
            type="text"
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            placeholder="e.g. Preparing for full-stack engineer interviews..."
            className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            autoFocus
          />

          <div className="flex items-center justify-between gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-xs text-slate-300 focus:outline-none"
            >
              <option value="preference" className="bg-[#0d091e]">Preference</option>
              <option value="project" className="bg-[#0d091e]">Project</option>
              <option value="education" className="bg-[#0d091e]">Education</option>
              <option value="general" className="bg-[#0d091e]">General</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFact.trim()}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-30"
              >
                Save Fact
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full py-2 rounded-xl border border-dashed border-white/[0.15] hover:border-purple-500/50 hover:bg-white/[0.02] text-xs text-slate-400 hover:text-purple-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Custom Memory Fact</span>
        </button>
      )}
    </div>
  );
};
