'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Reveals text that is invisible to people but read by AI agents.
export function AgentViewToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-hidden-injection]').forEach((el) => {
      el.style.fontSize = on ? '13px' : '1px';
      el.style.lineHeight = on ? '1.5' : '1';
      el.style.color = on ? '#C41E1E' : '#FFFFFF';
      el.style.background = on ? '#FDECEC' : 'transparent';
      el.style.padding = on ? '10px 12px' : '0';
      el.style.borderRadius = on ? '12px' : '0';
      el.style.border = on ? '1px dashed #C41E1E' : '0';
    });
  }, [on]);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-tile border border-no/30 bg-no-bg px-4 py-3 text-sm">
      <span className="font-semibold text-no">This lookalike store hides instructions for AI agents.</span>
      <button className="btn btn-xs btn-secondary ml-auto" onClick={() => setOn((v) => !v)}>
        {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {on ? 'Hide' : 'See what agents see'}
      </button>
    </div>
  );
}
