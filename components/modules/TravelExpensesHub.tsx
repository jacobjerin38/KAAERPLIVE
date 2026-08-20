import React, { useState, useEffect, useMemo } from 'react';
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
  Paperclip,
  Ticket,
  ArrowRight,
  ArrowLeftRight,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface AirfareTicket {
  id: string;
  created_at: string;
  company_id: string;
  employee_id: string;
  departure: string;
  arrival: string;
  trip_type: 'ONE_WAY' | 'ROUND_TRIP';
  departure_date: string;
  return_date?: string | null;
  cost: number;
  airline?: string | null;
  ticket_number?: string | null;
  ticket_doc_url?: string | null;
  remarks?: string | null;
  status: 'BOOKED' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  employees?: {
    id: string;
    name: string;
    employee_code?: string;
  };
}

export const TravelExpensesHub: React.FC = () => {
  const { user, currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'tickets'>('tickets');
  
  // Data State
  const [trips, setTrips] = useState<any[]>([]);
  const [tickets, setTickets] = useState<AirfareTicket[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action State
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<AirfareTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [tripTypeFilter, setTripTypeFilter] = useState<'ALL' | 'ONE_WAY' | 'ROUND_TRIP'>('ALL');
  const [formError, setFormError] = useState<string | null>(null);

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

  // Airfare Ticket Form (Ticket Details)
  const [ticketForm, setTicketForm] = useState({
    employee_id: '',
    departure: '',
    arrival: '',
    trip_type: 'ONE_WAY' as 'ONE_WAY' | 'ROUND_TRIP',
    departure_date: new Date().toISOString().split('T')[0],
    return_date: '',
    cost: '',
    airline: '',
    ticket_number: '',
    remarks: '',
    status: 'BOOKED' as 'BOOKED' | 'CONFIRMED' | 'PENDING' | 'CANCELLED'
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
        .select('id, name, employee_code')
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

      // 3. Fetch Airfare Tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('hrms_airfare_tickets' as any)
        .select('*, employees(id, name, employee_code)')
        .eq('company_id', currentCompanyId)
        .order('departure_date', { ascending: false });

      if (ticketData) {
        setTickets(ticketData as unknown as AirfareTicket[]);
      } else if (ticketError) {
        console.error('Error fetching airfare tickets:', ticketError);
      }

    } catch (err) {
      console.error('Error loading travel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetTicketForm = () => {
    setTicketForm({
      employee_id: '',
      departure: 'Doha',
      arrival: '',
      trip_type: 'ONE_WAY',
      departure_date: new Date().toISOString().split('T')[0],
      return_date: '',
      cost: '',
      airline: '',
      ticket_number: '',
      remarks: '',
      status: 'BOOKED'
    });
    setEditingTicket(null);
    setFormError(null);
  };

  const handleOpenAddTicket = () => {
    resetTicketForm();
    setShowTicketModal(true);
  };

  const handleOpenEditTicket = (t: AirfareTicket) => {
    setEditingTicket(t);
    setTicketForm({
      employee_id: t.employee_id || '',
      departure: t.departure || '',
      arrival: t.arrival || '',
      trip_type: t.trip_type || 'ONE_WAY',
      departure_date: t.departure_date || new Date().toISOString().split('T')[0],
      return_date: t.return_date || '',
      cost: t.cost ? String(t.cost) : '',
      airline: t.airline || '',
      ticket_number: t.ticket_number || '',
      remarks: t.remarks || '',
      status: t.status || 'BOOKED'
    });
    setFormError(null);
    setShowTicketModal(true);
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

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!ticketForm.employee_id) {
      setFormError('Please select an employee');
      return;
    }
    if (!ticketForm.departure.trim()) {
      setFormError('Please enter departure location');
      return;
    }
    if (!ticketForm.arrival.trim()) {
      setFormError('Please enter arrival location');
      return;
    }
    if (!ticketForm.departure_date) {
      setFormError('Please enter departure date');
      return;
    }
    if (ticketForm.trip_type === 'ROUND_TRIP' && !ticketForm.return_date) {
      setFormError('Please enter return date for two-way round trip');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: currentCompanyId,
        employee_id: ticketForm.employee_id,
        departure: ticketForm.departure.trim(),
        arrival: ticketForm.arrival.trim(),
        trip_type: ticketForm.trip_type,
        departure_date: ticketForm.departure_date,
        return_date: ticketForm.trip_type === 'ROUND_TRIP' ? (ticketForm.return_date || null) : null,
        cost: parseFloat(ticketForm.cost) || 0.00,
        airline: ticketForm.airline.trim() || null,
        ticket_number: ticketForm.ticket_number.trim() || null,
        remarks: ticketForm.remarks.trim() || null,
        status: ticketForm.status,
        updated_at: new Date().toISOString()
      };

      if (editingTicket) {
        const { error } = await supabase
          .from('hrms_airfare_tickets' as any)
          .update(payload)
          .eq('id', editingTicket.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hrms_airfare_tickets' as any)
          .insert(payload);
        if (error) throw error;
      }

      setShowTicketModal(false);
      resetTicketForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving ticket details:', err);
      setFormError(err.message || 'Failed to save ticket details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this airfare ticket record?')) return;
    try {
      const { error } = await supabase
        .from('hrms_airfare_tickets' as any)
        .delete()
        .eq('id', ticketId);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert('Failed to delete ticket');
    }
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = 
        !ticketSearch ||
        t.employees?.name?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.employees?.employee_code?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.departure?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.arrival?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.airline?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.ticket_number?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.remarks?.toLowerCase().includes(ticketSearch.toLowerCase());

      const matchesType = 
        tripTypeFilter === 'ALL' || t.trip_type === tripTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [tickets, ticketSearch, tripTypeFilter]);

  // Statistics
  const totalTicketSpend = useMemo(() => {
    return tickets.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  }, [tickets]);

  const oneWayCount = useMemo(() => tickets.filter(t => t.trip_type === 'ONE_WAY').length, [tickets]);
  const roundTripCount = useMemo(() => tickets.filter(t => t.trip_type === 'ROUND_TRIP').length, [tickets]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950 min-h-[400px]">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <Plane className="w-6 h-6" />
            </div>
            Airfare & Travel Management
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
            Manage employee airfare tickets, routes, one-way/two-way travel, and business trip itineraries.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'trips' && (
            <button
              onClick={() => setShowAddTrip(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Book/Request Trip
            </button>
          )}
          {activeTab === 'tickets' && (
            <button
              onClick={handleOpenAddTicket}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl transition text-sm font-semibold shadow-sm shadow-rose-500/20"
            >
              <Plus className="w-4 h-4" /> Ticket Details
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 -mb-px flex items-center gap-2.5 ${
            activeTab === 'tickets'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <Ticket className="w-4 h-4" /> Airfare Tickets
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
            activeTab === 'tickets' 
              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' 
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
          }`}>
            {tickets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 -mb-px flex items-center gap-2.5 ${
            activeTab === 'trips'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Travel Requests
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
            activeTab === 'trips' 
              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' 
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
          }`}>
            {trips.length}
          </span>
        </button>
      </div>

      {/* Airfare Tickets View */}
      {activeTab === 'tickets' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Total Tickets</span>
                <Ticket className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {tickets.length}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                Registered employee airfares
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Total Spend</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                QAR {totalTicketSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                Cumulative airfare cost
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>One-Way Trips</span>
                <ArrowRight className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {oneWayCount}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                Single direction flights
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>Two-Way (Round Trips)</span>
                <ArrowLeftRight className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {roundTripCount}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                Return flights booked
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee, route, airline, ticket #..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5" /> Trip Type:
              </span>
              <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-xs font-bold">
                <button
                  onClick={() => setTripTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    tripTypeFilter === 'ALL'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                  }`}
                >
                  All ({tickets.length})
                </button>
                <button
                  onClick={() => setTripTypeFilter('ONE_WAY')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    tripTypeFilter === 'ONE_WAY'
                      ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                  }`}
                >
                  One Way ({oneWayCount})
                </button>
                <button
                  onClick={() => setTripTypeFilter('ROUND_TRIP')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    tripTypeFilter === 'ROUND_TRIP'
                      ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                  }`}
                >
                  Two Way ({roundTripCount})
                </button>
              </div>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-400">
                <thead className="bg-slate-50/80 dark:bg-zinc-800/50 text-slate-500 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Route (Departure → Arrival)</th>
                    <th className="px-5 py-4 text-center">Trip Type</th>
                    <th className="px-5 py-4">Travel Dates</th>
                    <th className="px-5 py-4 text-right">Cost (QAR)</th>
                    <th className="px-5 py-4">Airline / Ticket #</th>
                    <th className="px-5 py-4">Remarks</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-slate-400">
                        <Ticket className="w-12 h-12 mx-auto mb-3 opacity-20 text-rose-500" />
                        <p className="font-bold text-sm text-slate-600 dark:text-zinc-300">No airfare tickets found</p>
                        <p className="text-xs text-slate-400 mt-1">Click "+ Ticket Details" above to record a new employee flight ticket.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t) => {
                      const isOneWay = t.trip_type === 'ONE_WAY';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                          {/* Employee */}
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {t.employees?.name || 'Unknown Employee'}
                            </div>
                            {t.employees?.employee_code && (
                              <span className="text-[10px] font-mono text-slate-400 font-medium">
                                {t.employees.employee_code}
                              </span>
                            )}
                          </td>

                          {/* Route */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200">
                              <span className="text-slate-900 dark:text-white">{t.departure}</span>
                              {isOneWay ? (
                                <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              ) : (
                                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              )}
                              <span className="text-rose-600 dark:text-rose-400">{t.arrival}</span>
                            </div>
                          </td>

                          {/* Trip Type */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isOneWay 
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' 
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                            }`}>
                              {isOneWay ? (
                                <>
                                  <ArrowRight className="w-3 h-3" /> One Way
                                </>
                              ) : (
                                <>
                                  <ArrowLeftRight className="w-3 h-3" /> Two Way
                                </>
                              )}
                            </span>
                          </td>

                          {/* Travel Dates */}
                          <td className="px-5 py-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Dept: <strong>{t.departure_date || '-'}</strong></span>
                            </div>
                            {!isOneWay && t.return_date && (
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 mt-0.5">
                                <Calendar className="w-3.5 h-3.5 text-purple-400 opacity-60" />
                                <span>Ret: <strong>{t.return_date}</strong></span>
                              </div>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="px-5 py-4 text-right">
                            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                              QAR {Number(t.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Airline / Ticket # */}
                          <td className="px-5 py-4 text-xs">
                            {t.airline ? (
                              <div className="font-semibold text-slate-800 dark:text-zinc-200">{t.airline}</div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {t.ticket_number && (
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                #{t.ticket_number}
                              </span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-5 py-4 text-xs text-slate-500 dark:text-zinc-400 max-w-[200px] truncate" title={t.remarks || ''}>
                            {t.remarks || '—'}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                              t.status === 'CONFIRMED' || t.status === 'BOOKED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : t.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}>
                              {(t.status === 'CONFIRMED' || t.status === 'BOOKED') && <CheckCircle className="w-3 h-3" />}
                              {t.status === 'PENDING' && <Clock className="w-3 h-3" />}
                              {t.status === 'CANCELLED' && <XCircle className="w-3 h-3" />}
                              {t.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditTicket(t)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                                title="Edit Ticket Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTicket(t.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                title="Delete Ticket"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Trips Requests View */}
      {activeTab === 'trips' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
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
                      {trip.need_hotel && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 text-xs font-semibold">Hotel</span>}
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

      {/* Ticket Details Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6 max-h-[90vh] overflow-y-auto animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-rose-500" />
                  {editingTicket ? 'Edit Ticket Details' : 'Ticket Details'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter employee airfare route, one-way or two-way itinerary, cost, and booking remarks.
                </p>
              </div>
              <button 
                onClick={() => setShowTicketModal(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTicket} className="space-y-5">
              {/* Employee Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Employee Name <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={ticketForm.employee_id}
                  onChange={(e) => setTicketForm({ ...ticketForm, employee_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  <option value="">Select employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.employee_code ? `(${e.employee_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trip Type (One Way vs Two Way) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Trip Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTicketForm({ ...ticketForm, trip_type: 'ONE_WAY', return_date: '' })}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      ticketForm.trip_type === 'ONE_WAY'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" /> One Way
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketForm({ ...ticketForm, trip_type: 'ROUND_TRIP' })}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      ticketForm.trip_type === 'ROUND_TRIP'
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 shadow-xs ring-2 ring-purple-500/20'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" /> Two Way (Round Trip)
                  </button>
                </div>
              </div>

              {/* Route: Departure & Arrival */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Departure Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Doha (DOH)"
                    value={ticketForm.departure}
                    onChange={(e) => setTicketForm({ ...ticketForm, departure: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Arrival Destination <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Manila (MNL)"
                    value={ticketForm.arrival}
                    onChange={(e) => setTicketForm({ ...ticketForm, arrival: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Travel Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Departure Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={ticketForm.departure_date}
                    onChange={(e) => setTicketForm({ ...ticketForm, departure_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {ticketForm.trip_type === 'ROUND_TRIP' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                      Return Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="date"
                      value={ticketForm.return_date}
                      onChange={(e) => setTicketForm({ ...ticketForm, return_date: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5 opacity-50 pointer-events-none">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Return Date (N/A for One-Way)
                    </label>
                    <input
                      disabled
                      type="text"
                      placeholder="One-way flight"
                      className="w-full px-4 py-2.5 border border-dashed border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-slate-50 dark:bg-zinc-850 text-slate-400"
                    />
                  </div>
                )}
              </div>

              {/* Cost & Airline Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Cost of the Ticket (QAR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      QAR
                    </span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1850.00"
                      value={ticketForm.cost}
                      onChange={(e) => setTicketForm({ ...ticketForm, cost: e.target.value })}
                      className="w-full pl-14 pr-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Airline / Carrier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Qatar Airways"
                    value={ticketForm.airline}
                    onChange={(e) => setTicketForm({ ...ticketForm, airline: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Ticket / PNR Number & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Ticket / PNR Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 157-2349081234"
                    value={ticketForm.ticket_number}
                    onChange={(e) => setTicketForm({ ...ticketForm, ticket_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Ticket Status
                  </label>
                  <select
                    value={ticketForm.status}
                    onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="BOOKED">Booked</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="PENDING">Pending Approval</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Remarks / Notes
                </label>
                <textarea
                  value={ticketForm.remarks}
                  onChange={(e) => setTicketForm({ ...ticketForm, remarks: e.target.value })}
                  placeholder="e.g. Annual leave airfare allowance / emergency flight booking..."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 h-20 resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-sm shadow-rose-500/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTicket ? 'Update Ticket Details' : 'Save Ticket Details')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Trip Modal */}
      {showAddTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
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
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm text-slate-800 dark:text-white"
                >
                  <option value="">Choose employee...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} {e.employee_code ? `(${e.employee_code})` : ''}</option>
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
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Estimated Cost (QAR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={tripForm.estimated_cost}
                    onChange={(e) => setTripForm({ ...tripForm, estimated_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm text-slate-800 dark:text-white"
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
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Return Date</label>
                  <input
                    required
                    type="date"
                    value={tripForm.return_date}
                    onChange={(e) => setTripForm({ ...tripForm, return_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm text-slate-800 dark:text-white"
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
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded-lg text-sm h-16 text-slate-800 dark:text-white"
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
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition text-sm font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Travel Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
