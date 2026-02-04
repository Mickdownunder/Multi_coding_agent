import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface SecurityTelemetryProps {
  entropy: number;
  label?: string;
  lastRotation?: string;
}

const SecurityTelemetry: React.FC<SecurityTelemetryProps> = ({
  entropy,
  label = "System Entropy",
  lastRotation = "N/A"
}) => {
  const isCyberLime = entropy > 128;
  
  const getStatusColor = () => {
    if (entropy < 64) return 'bg-red-500';
    if (entropy <= 128) return 'bg-yellow-500';
    return 'bg-[#ccff00]';
  };

  const getTextColor = () => {
    if (entropy < 64) return 'text-red-400';
    if (entropy <= 128) return 'text-yellow-400';
    return 'text-[#ccff00]';
  };

  const getStatusIcon = () => {
    if (entropy < 64) return <ShieldAlert className="w-4 h-4 text-red-500" />;
    if (entropy <= 128) return <Shield className="w-4 h-4 text-yellow-500" />;
    return <ShieldCheck className="w-4 h-4 text-[#ccff00]" />;
  };

  const percentage = Math.min((entropy / 256) * 100, 100);

  return (
    <div 
      className="p-4 rounded-lg bg-slate-900 border border-blue-500/20 shadow-lg shadow-blue-500/5"
      role="region"
      aria-label="Security Telemetry Monitor"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-blue-100">
            {label}
          </h3>
        </div>
        <div 
          className={`px-2 py-1 rounded text-[10px] font-bold border ${isCyberLime ? 'border-[#ccff00] bg-[#ccff00]/10' : 'border-blue-500/30 bg-blue-500/10'} text-blue-400 uppercase tracking-tighter`}
        >
          Atomic-Blue Protocol
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase">Strength</span>
            <span className={`text-2xl font-mono font-black ${getTextColor()}`}>
              {entropy} <span className="text-xs font-normal">bits</span>
            </span>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              {getStatusIcon()}
              <span className={`text-[10px] font-bold uppercase ${getTextColor()}`}>
                {entropy > 128 ? 'Optimal' : entropy > 64 ? 'Sufficient' : 'Critical'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">ROT: {lastRotation}</span>
          </div>
        </div>

        <div 
          className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex"
          role="progressbar"
          aria-valuenow={entropy}
          aria-valuemin={0}
          aria-valuemax={256}
          aria-label={`${label} strength indicator`}
        >
          <div 
            className={`h-full transition-all duration-500 ease-out ${getStatusColor()} ${
              isCyberLime ? 'shadow-[0_0_10px_#ccff00]' : ''
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-[8px] font-mono text-slate-600 uppercase">
          <span>0</span>
          <span>64</span>
          <span>128</span>
          <span>256</span>
        </div>
      </div>

      {isCyberLime && (
        <div className="mt-3 flex items-center gap-2 p-2 bg-[#ccff00]/5 border border-[#ccff00]/20 rounded">
          <div className="w-1 h-1 rounded-full bg-[#ccff00] animate-pulse" />
          <span className="text-[9px] font-bold text-[#ccff00] uppercase tracking-widest">
            High Entropy State Detected
          </span>
        </div>
      )}
    </div>
  );
};

export default SecurityTelemetry;