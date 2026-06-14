import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  Plane, 
  Plus, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  Paperclip
} from 'lucide-react';

export const TravelExpensesHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'expenses'>('trips');
  
  // Data State
  const [trips, setTrips] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action State
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Trip Form
  const [tripForm, setTripForm] = useState({
    employee_id: '',
    purpose: '',
    destination: '',
    departure_date: '',
    return_date: '',
    estimated_cost: '',
    need_flight: false,
    need_hotel: false
  });

  // New Expense Form
  const [expenseForm, setExpenseForm] = useState({
    travel_request_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'FLIGHT',
    amount: '',
    receipt_url: '',
    description: ''
  });

  useEffect(() => {
    if (user && currentCompanyId) {
      loadData();
    }
  }, [user, currentCompanyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Employees
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', currentCompanyId)
        .order('name');
      if (empData) setEmployees(empData);

      // 2. Fetch Trips
      const { data: tripData } = await supabase
        .from('hrms_travel_requests' as any)
        .select('*, employees(name)')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (tripData) setTrips(tripData);

      // 3. Fetch Expenses
      const { data: expenseData } = await supabase
        .from('hrms_travel_expenses' as any)
        .select('*, hrms_travel_requests(destination, purpose, employees(name))')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false });
      if (expenseData) setExpenses(expenseData);

    } catch (err) {
      console.error('Error loading travel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripForm.employee_id || !tripForm.purpose || !tripForm.destination || !tripForm.departure_date || !tripForm.return_date) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('hrms_travel_requests' as any)
        .insert({
          company_id: currentCompanyId,
          employee_id: tripForm.employee_id,
          purpose: tripForm.purpose,
          destination: tripForm.destination,
          departure_date: tripForm.departure_date,
          return_date: tripForm.return_date,
          estimated_cost: parseFloat(tripForm.estimated_cost) || 0.00,
          need_flight: tripForm.need_flight,
          need_hotel: tripForm.need_hotel,
          status: 'PENDING'
        });

      if (error) throw error;
      
      setShowAddTrip(false);
      loadData();
    } catch (err) {
      console.error('Error creating trip:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.travel_request_id || !expenseForm.amount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('hrms_travel_expenses' as any)
        .insert({
          company_id: currentCompanyId,
          travel_request_id: expenseForm.travel_request_id,
          expense_date: expenseForm.expense_date,
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          receipt_url: expenseForm.receipt_url || null,
          description: expenseForm.description,
          status: 'PENDING'
        });

      if (error) throw error;
      
      setShowAddExpense(false);
      loadData();
    } catch (err) {
      console.error('Error logging expense:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Plane className="w-6 h-6 text-rose-500" />
            Travel & Expense Management
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm">
            Approve business trip itineraries, accommodation logistics, and travel reimbursements.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'trips' && (
            <button
              onClick={() => setShowAddTrip(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Book/Request Trip
            </button>
          )}
          {activeTab === 'expenses' && (
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Log Trip Expense
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'trips'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Travel Requests
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'expenses'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Trip Expenses
        </button>
      </div>

      {/* Trips List */}
      {activeTab === 'trips' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50 dark:bg-zinc-850 text-slate-500 uppercase text-xs">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Destination</th>
                <th className="p-4">Dates</th>
                <th className="p-4">Logistics Needed</th>
                <th className="p-4">Est. Cost (QAR)</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No travel requests logged.</td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="p-4 font-semibold text-slate-900 dark:text-zinc-200">{trip.employees?.name}</td>
                    <td className="p-4">{trip.purpose}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {trip.destination}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {trip.departure_date} to {trip.return_date}
                      </span>
                    </td>
                    <td className="p-4 space-x-1">
                      {trip.need_flight && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 text-xs font-semibold">Flight</span>}
                      {trip.need_hotel && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-605 dark:bg-amber-950/30 dark:text-amber-400 text-xs font-semibold">Hotel</span>}
                      {!trip.need_flight && !trip.need_hotel && <span className="text-slate-400">-</span>}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-zinc-300">QAR {trip.estimated_cost}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        trip.status === 'APPROVED' || trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        trip.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {trip.status === 'APPROVED' && <CheckCircle className="w-3.5 h-3.5" />}
                        {trip.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                        {trip.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expenses List */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50 dark:bg-zinc-850 text-slate-500 uppercase text-xs">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Trip Destination</th>
                <th className="p-4">Expense Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Receipt</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No trip expenses logged.</td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="p-4 font-semibold text-slate-900 dark:text-zinc-200">
                      {exp.hrms_travel_requests?.employees?.name}
                    </td>
                    <td className="p-4">{exp.hrms_travel_requests?.destination}</td>
                    <td className="p-4">{exp.expense_date}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 text-xs font-semibold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4">
                      {exp.receipt_url ? (
                        <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="text-rose-500 hover:underline flex items-center gap-1 text-xs">
                          <Paperclip className="w-3.5 h-3.5" /> View Receipt
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-zinc-300">
                      QAR {parseFloat(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        exp.status === 'APPROVED' || exp.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        exp.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {exp.status === 'APPROVED' && <CheckCircle className="w-3.5 h-3.5" />}
                        {exp.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                        {exp.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Trip Modal */}
      {showAddTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Request Business Travel</h3>
              <button onClick={() => setShowAddTrip(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Select Employee</label>
                <select
                  required
                  value={tripForm.employee_id}
                  onChange={(e) => setTripForm({ ...tripForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Destination</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. London, UK"
                    value={tripForm.destination}
                    onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Estimated Cost (QAR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={tripForm.estimated_cost}
                    onChange={(e) => setTripForm({ ...tripForm, estimated_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Departure Date</label>
                  <input
                    required
                    type="date"
                    value={tripForm.departure_date}
                    onChange={(e) => setTripForm({ ...tripForm, departure_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Return Date</label>
                  <input
                    required
                    type="date"
                    value={tripForm.return_date}
                    onChange={(e) => setTripForm({ ...tripForm, return_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Business Purpose</label>
                <textarea
                  required
                  value={tripForm.purpose}
                  onChange={(e) => setTripForm({ ...tripForm, purpose: e.target.value })}
                  placeholder="e.g. Client onboarding workshops"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <div className="flex items-center gap-6 py-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tripForm.need_flight}
                    onChange={(e) => setTripForm({ ...tripForm, need_flight: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  Require Flight Booking
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tripForm.need_hotel}
                    onChange={(e) => setTripForm({ ...tripForm, need_hotel: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  Require Hotel Accommodation
                </label>
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Travel Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-200">Log Trip Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Associate Trip</label>
                <select
                  required
                  value={expenseForm.travel_request_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, travel_request_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                >
                  <option value="">Choose trip request...</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.employees?.name} - {t.destination} ({t.departure_date})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  >
                    <option value="FLIGHT">Flight Fare</option>
                    <option value="HOTEL">Hotel / Accommodation</option>
                    <option value="MEAL">Meals</option>
                    <option value="LOCAL_TRANSPORT">Local Transport</option>
                    <option value="PER_DIEM">Per Diem Allowance</option>
                    <option value="MISC">Miscellaneous</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Amount (QAR)</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 350"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Receipt Attachment URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://supabase.storage/receipt.jpg"
                  value={expenseForm.receipt_url}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receipt_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Description</label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Provide brief details about this expense..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16"
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
