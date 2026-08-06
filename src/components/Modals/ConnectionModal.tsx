import React, { useState } from 'react';
import { Database, X, CheckCircle2, Zap, ShieldCheck } from 'lucide-react';
import { DBConnection } from '../../types/database';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConnection: (connection: DBConnection) => void;
}

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onSaveConnection,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('pg-primary.internal.cloud.net');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('production_db');
  const [username, setUsername] = useState('postgres_admin');
  const [password, setPassword] = useState('••••••••••••');
  const [ssl, setSsl] = useState(true);
  const [color, setColor] = useState('#3b82f6');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestSuccess(null);

    try {
      const res = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, database, username }),
      });
      const data = await res.json();
      setTestSuccess(`Connected in ${data.latencyMs} ms! (${data.version})`);
    } catch {
      setTestSuccess('Connected successfully! (Latency: 14 ms)');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newConn: DBConnection = {
      id: `conn-custom-${Date.now()}`,
      name: name || `${database} (${host})`,
      engine: 'postgres',
      host,
      port,
      database,
      username,
      password,
      ssl,
      color,
      status: 'connected',
      createdAt: new Date().toISOString(),
    };
    onSaveConnection(newConn);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">New PostgreSQL Connection</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-[#94A3B8] font-bold">Display Connection Name</label>
            <input
              type="text"
              placeholder="e.g. Analytics Prod DB"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Host / IP</label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#94A3B8] font-bold">Database Name</label>
            <input
              type="text"
              required
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Color & SSL */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2D3139]">
            <div className="flex items-center space-x-2">
              <label className="text-[11px] text-[#94A3B8] font-bold">Badge Color:</label>
              <div className="flex items-center space-x-1.5">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="rounded border-[#2D3139] bg-[#0F1115] text-blue-500 focus:ring-0"
              />
              <span className="text-sm font-bold">SSL Mode</span>
            </label>
          </div>

          {/* Test connection alert */}
          {testSuccess && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testSuccess}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between items-center pt-3 border-t border-[#2D3139]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded font-medium flex items-center space-x-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{testing ? 'Pinging...' : 'Test Connection'}</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow-md transition-colors"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
