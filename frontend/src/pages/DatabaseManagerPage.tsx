import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  ArrowUpDown, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Send, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { Account, Transaction } from '../types';
import { Modal } from '../components/Modal';

export const DatabaseManagerPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'balance'>('id');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'CREATE' | 'EDIT' | 'DELETE' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'RESET' | null
  >(null);
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);

  // Form Fields
  const [formAccId, setFormAccId] = useState('');
  const [formHolderName, setFormHolderName] = useState('');
  const [formAmountRupees, setFormAmountRupees] = useState('');
  const [formTargetAccId, setFormTargetAccId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const accRes = await api.listAccounts();
      setAccounts(accRes.accounts);
      const txnRes = await api.listTransactions(50);
      setTransactions(txnRes.transactions);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to fetch database records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paise = Math.round(parseFloat(formAmountRupees || '0') * 100);
      await api.createAccount({
        account_id: formAccId.toUpperCase().trim(),
        holder_name: formHolderName.trim(),
        balance_paise: paise,
      });
      setActiveModal(null);
      showFeedback('success', `Account ${formAccId} created successfully`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) return;
    try {
      await api.updateAccount(selectedAcc.account_id, {
        holder_name: formHolderName.trim(),
      });
      setActiveModal(null);
      showFeedback('success', `Account ${selectedAcc.account_id} updated`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedAcc) return;
    try {
      await api.deleteAccount(selectedAcc.account_id);
      setActiveModal(null);
      showFeedback('success', `Account ${selectedAcc.account_id} deleted`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) return;
    try {
      const paise = Math.round(parseFloat(formAmountRupees) * 100);
      await api.manualDeposit(selectedAcc.account_id, paise);
      setActiveModal(null);
      showFeedback('success', `Deposited ₹${formAmountRupees} into ${selectedAcc.account_id}`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) return;
    try {
      const paise = Math.round(parseFloat(formAmountRupees) * 100);
      await api.manualWithdraw(selectedAcc.account_id, paise);
      setActiveModal(null);
      showFeedback('success', `Withdrew ₹${formAmountRupees} from ${selectedAcc.account_id}`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) return;
    try {
      const paise = Math.round(parseFloat(formAmountRupees) * 100);
      await api.manualTransfer(selectedAcc.account_id, formTargetAccId, paise);
      setActiveModal(null);
      showFeedback('success', `Transferred ₹${formAmountRupees} from ${selectedAcc.account_id} to ${formTargetAccId}`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleResetDb = async () => {
    try {
      await api.resetDatabase();
      setActiveModal(null);
      showFeedback('success', 'Database restored to initial seed state');
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Filter & Sort
  const filtered = accounts
    .filter((a) =>
      a.account_id.toLowerCase().includes(search.toLowerCase()) ||
      a.holder_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.holder_name.localeCompare(b.holder_name);
      if (sortBy === 'balance') return b.balance_paise - a.balance_paise;
      return a.account_id.localeCompare(b.account_id);
    });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <span>SQLite Database Manager</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Genuine SQL transactions executed via POSIX C engine prepared statements
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setFormAccId('');
              setFormHolderName('');
              setFormAmountRupees('10000');
              setActiveModal('CREATE');
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Account</span>
          </button>

          <button
            onClick={() => setActiveModal('RESET')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            <span>Reset to Seed</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2 transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Accounts Management Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search account ID or holder name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Sort by:</span>
            <button
              onClick={() => setSortBy('id')}
              className={`px-2.5 py-1 rounded font-mono ${
                sortBy === 'id' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-2.5 py-1 rounded font-mono ${
                sortBy === 'name' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('balance')}
              className={`px-2.5 py-1 rounded font-mono ${
                sortBy === 'balance' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Balance
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-3 px-3">Account ID</th>
                <th className="py-3 px-3">Holder Name</th>
                <th className="py-3 px-3">Balance (₹ INR)</th>
                <th className="py-3 px-3">Balance (Paise)</th>
                <th className="py-3 px-3 text-right">Transactions & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((acc) => (
                <tr key={acc.account_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                    {acc.account_id}
                  </td>
                  <td className="py-3 px-3 text-slate-200 font-medium">{acc.holder_name}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                    ₹{(acc.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {acc.balance_paise.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => {
                          setSelectedAcc(acc);
                          setFormAmountRupees('1000');
                          setActiveModal('DEPOSIT');
                        }}
                        className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-mono flex items-center space-x-1"
                        title="Deposit money"
                      >
                        <ArrowDownLeft className="w-3 h-3" />
                        <span>Deposit</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAcc(acc);
                          setFormAmountRupees('500');
                          setActiveModal('WITHDRAW');
                        }}
                        className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-mono flex items-center space-x-1"
                        title="Withdraw money"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Withdraw</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAcc(acc);
                          setFormAmountRupees('250');
                          setFormTargetAccId(
                            accounts.find((a) => a.account_id !== acc.account_id)?.account_id || ''
                          );
                          setActiveModal('TRANSFER');
                        }}
                        className="px-2 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[11px] font-mono flex items-center space-x-1"
                        title="Atomic transfer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Transfer</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAcc(acc);
                          setFormHolderName(acc.holder_name);
                          setActiveModal('EDIT');
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                        title="Edit name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAcc(acc);
                          setActiveModal('DELETE');
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History Log Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>SQLite Transaction Audit Log</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Recorded {transactions.length} genuine transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Destination</th>
                <th className="py-2.5 px-3">Amount (₹)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {transactions.slice(0, 15).map((txn) => (
                <tr key={txn.transaction_id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 text-slate-300">{txn.transaction_id}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        txn.transaction_type === 'DEPOSIT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : txn.transaction_type === 'WITHDRAW'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : txn.transaction_type === 'TRANSFER'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {txn.transaction_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-indigo-300">{txn.source_account || '—'}</td>
                  <td className="py-2.5 px-3 text-indigo-300">{txn.destination_account || '—'}</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    ₹{(txn.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        txn.status === 'SUCCESS'
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : 'text-rose-400 bg-rose-950/40'
                      }`}
                    >
                      {txn.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{txn.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {/* Create Account Modal */}
      <Modal isOpen={activeModal === 'CREATE'} onClose={() => setActiveModal(null)} title="Create New Bank Account">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Account ID</label>
            <input
              type="text"
              required
              value={formAccId}
              onChange={(e) => setFormAccId(e.target.value)}
              placeholder="e.g. ACC006"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Holder Name</label>
            <input
              type="text"
              required
              value={formHolderName}
              onChange={(e) => setFormHolderName(e.target.value)}
              placeholder="Customer Name"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Initial Balance (₹ Rupees)</label>
            <input
              type="number"
              step="any"
              required
              value={formAmountRupees}
              onChange={(e) => setFormAmountRupees(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Deposit Modal */}
      <Modal isOpen={activeModal === 'DEPOSIT'} onClose={() => setActiveModal(null)} title={`Deposit to ${selectedAcc?.account_id}`}>
        <form onSubmit={handleDeposit} className="space-y-4">
          <p className="text-xs text-slate-400">
            Account Holder: <strong className="text-white">{selectedAcc?.holder_name}</strong>
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Deposit Amount (₹ Rupees)</label>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={formAmountRupees}
              onChange={(e) => setFormAmountRupees(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white">
              Confirm Deposit
            </button>
          </div>
        </form>
      </Modal>

      {/* Withdraw Modal */}
      <Modal isOpen={activeModal === 'WITHDRAW'} onClose={() => setActiveModal(null)} title={`Withdraw from ${selectedAcc?.account_id}`}>
        <form onSubmit={handleWithdraw} className="space-y-4">
          <p className="text-xs text-slate-400">
            Available Balance: <strong className="text-emerald-400">₹{selectedAcc ? (selectedAcc.balance_paise / 100).toLocaleString('en-IN') : 0}</strong>
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Withdrawal Amount (₹ Rupees)</label>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={formAmountRupees}
              onChange={(e) => setFormAmountRupees(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 text-xs font-semibold text-white">
              Confirm Withdrawal
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={activeModal === 'TRANSFER'} onClose={() => setActiveModal(null)} title={`Transfer from ${selectedAcc?.account_id}`}>
        <form onSubmit={handleTransfer} className="space-y-4">
          <p className="text-xs text-slate-400">
            From: <strong className="text-white">{selectedAcc?.account_id}</strong> (Available: ₹{selectedAcc ? (selectedAcc.balance_paise / 100).toLocaleString('en-IN') : 0})
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Destination Account</label>
            <select
              value={formTargetAccId}
              onChange={(e) => setFormTargetAccId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            >
              {accounts
                .filter((a) => a.account_id !== selectedAcc?.account_id)
                .map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.account_id} — {a.holder_name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Amount (₹ Rupees)</label>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={formAmountRupees}
              onChange={(e) => setFormAmountRupees(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">
              Execute Atomic Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={activeModal === 'EDIT'} onClose={() => setActiveModal(null)} title={`Edit ${selectedAcc?.account_id}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Holder Name</label>
            <input
              type="text"
              required
              value={formHolderName}
              onChange={(e) => setFormHolderName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={activeModal === 'DELETE'} onClose={() => setActiveModal(null)} title="Confirm Account Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete account <strong className="text-white font-mono">{selectedAcc?.account_id}</strong> ({selectedAcc?.holder_name})?
          </p>
          <div className="flex justify-end space-x-2 pt-2">
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white">
              Delete Account
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Seed Modal */}
      <Modal isOpen={activeModal === 'RESET'} onClose={() => setActiveModal(null)} title="Reset SQLite Database">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Restore database to initial five sample accounts and initial funding transactions?
          </p>
          <div className="flex justify-end space-x-2 pt-2">
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">
              Cancel
            </button>
            <button onClick={handleResetDb} className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white">
              Restore Initial Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
