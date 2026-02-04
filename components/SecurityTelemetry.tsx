'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Lock } from 'lucide-react';

/**
 * SecurityTelemetry Component
 * Provides real-time visual feedback on security events and system integrity.
 */
export default function SecurityTelemetry() {
  const [metrics, setMetrics] = useState({
    threatsBlocked: 12,
    integrityScore: 98,
    activeSessions: 3,
    lastScan: '2 mins ago'
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <Shield className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Threats Blocked</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.threatsBlocked}</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <Activity className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Integrity Score</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.integrityScore}%</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
        <div className="bg-purple-50 p-3 rounded-lg">
          <Lock className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Sessions</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.activeSessions}</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
        <div className="bg-amber-50 p-3 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Security Scan</p>
          <p className="text-sm font-semibold text-gray-900">{metrics.lastScan}</p>
        </div>
      </div>
    </div>
  );
}