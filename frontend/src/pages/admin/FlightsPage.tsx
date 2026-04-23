import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AsyncSelect from 'react-select/async';
import type { AxiosError } from 'axios';
import client from '../../api/client';
import { useAuth } from '../../context/auth-context';
import { airportSelectStyles, loadAirportOptions } from '../../lib/airport-options';
import type { AirportOption } from '../../types';

type Template = {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  airline: { name: string };
};

type FlightInstanceRow = {
  id: string;
  instanceId: string;
  departureAt: string;
  arrivalAt: string;
  status: string;
  schedule: {
    departureTime: string;
    scheduledDate: string;
    isDaily: boolean;
  };
  seats: { id: string; seatNumber: string; status: string; class: string }[];
  /** Present on cross-route “upcoming” list from the API. */
  flight?: {
    id?: string;
    flightNumber: string;
    origin: string;
    destination: string;
    airline: { name: string };
  };
};

function staffCanManageFlights(role: string | undefined) {
  return role === 'ASSOCIATE' || role === 'SENIOR_ASSOCIATE' || role === 'SUPERADMIN';
}

const PAGE_SIZE = 20;

type PaginatedInstances = {
  items: FlightInstanceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function PaginationBar(props: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (p: number) => void;
}) {
  if (props.total === 0) {
    return null;
  }
  const from = (props.page - 1) * props.pageSize + 1;
  const to = Math.min(props.page * props.pageSize, props.total);
  return (
    <div
      className="btn-row"
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginTop: 8,
      }}
    >
      <button
        type="button"
        className="btn btn-ghost"
        disabled={props.disabled || props.page <= 1}
        onClick={() => props.onPageChange(props.page - 1)}
      >
        Previous
      </button>
      <span className="muted" style={{ fontSize: '0.875rem' }}>
        Page {props.page} of {props.totalPages} · {from}–{to} of {props.total}
      </span>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={props.disabled || props.page >= props.totalPages}
        onClick={() => props.onPageChange(props.page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export default function FlightsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['flight-templates'],
    queryFn: async () => {
      const res = await client.get<Template[]>('/flights/templates');
      return res.data;
    },
  });

  const [flightId, setFlightId] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isDaily, setIsDaily] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [instancesMsg, setInstancesMsg] = useState<string | null>(null);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [routeInstancesPage, setRouteInstancesPage] = useState(1);

  const canLoadInstances = staffCanManageFlights(user?.role);

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['flight-instances-upcoming', upcomingPage],
    queryFn: async () => {
      const res = await client.get<PaginatedInstances>('/flights/instances/upcoming', {
        params: { page: upcomingPage, pageSize: PAGE_SIZE },
      });
      return res.data;
    },
    enabled: canLoadInstances,
  });

  useEffect(() => {
    if (!upcomingData) return;
    if (upcomingPage > upcomingData.totalPages) {
      setUpcomingPage(upcomingData.totalPages);
    }
  }, [upcomingData, upcomingPage]);

  const { data: routeInstancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['flight-instances', flightId, routeInstancesPage],
    queryFn: async () => {
      const res = await client.get<PaginatedInstances>(`/flights/templates/${flightId}/instances`, {
        params: { page: routeInstancesPage, pageSize: PAGE_SIZE },
      });
      return res.data;
    },
    enabled: !!flightId && canLoadInstances,
  });

  useEffect(() => {
    setRouteInstancesPage(1);
  }, [flightId]);

  useEffect(() => {
    if (!routeInstancesData) return;
    if (routeInstancesPage > routeInstancesData.totalPages) {
      setRouteInstancesPage(routeInstancesData.totalPages);
    }
  }, [routeInstancesData, routeInstancesPage]);

  const deleteInstanceM = useMutation({
    mutationFn: async (instanceDbId: string) => {
      await client.delete(`/flights/${encodeURIComponent(instanceDbId)}`);
    },
    onSuccess: async () => {
      setInstancesMsg(null);
      await qc.invalidateQueries({ queryKey: ['flight-instances', flightId] });
      await qc.invalidateQueries({ queryKey: ['flight-instances-upcoming'] });
      await qc.invalidateQueries({ queryKey: ['flight-templates'] });
    },
    onError: (err: AxiosError<{ message?: string | string[] }>) => {
      const msg = err.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(' ') : msg || err.message || 'Could not delete instance.';
      setInstancesMsg(text);
    },
  });

  const scheduleM = useMutation({
    mutationFn: async () => {
      const res = await client.post<{ scheduleId: string; instancesGenerated: number }>('/flights/schedule', {
        flightId,
        departureTime,
        scheduledDate,
        isDaily,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setScheduleMsg(`Created ${data.instancesGenerated} instance(s). Schedule id: ${data.scheduleId}`);
      void qc.invalidateQueries({ queryKey: ['flight-templates'] });
      void qc.invalidateQueries({ queryKey: ['flight-instances-upcoming'] });
      void qc.invalidateQueries({ queryKey: ['flight-instances', flightId] });
      void qc.invalidateQueries({ queryKey: ['flight-instances-upcoming'] });
    },
    onError: () => {
      setScheduleMsg('Could not create schedule.');
    },
  });

  const [fn, setFn] = useState('');
  const [originAirport, setOriginAirport] = useState<AirportOption | null>(null);
  const [destinationAirport, setDestinationAirport] = useState<AirportOption | null>(null);
  const [duration, setDuration] = useState('120');
  const [routeMsg, setRouteMsg] = useState<string | null>(null);

  const loadAirports = useCallback((input: string) => loadAirportOptions(input), []);

  const createRouteM = useMutation({
    mutationFn: async () => {
      if (!user?.airlineId) throw new Error('No airline');
      if (!originAirport?.value || !destinationAirport?.value) throw new Error('Airports required');
      await client.post('/flights', {
        airlineId: user.airlineId,
        flightNumber: fn.trim(),
        origin: originAirport.value.toUpperCase(),
        destination: destinationAirport.value.toUpperCase(),
        durationMins: Number(duration) || 120,
      });
    },
    onSuccess: () => {
      setRouteMsg('Route created.');
      setFn('');
      setOriginAirport(null);
      setDestinationAirport(null);
      void qc.invalidateQueries({ queryKey: ['flight-templates'] });
      void qc.invalidateQueries({ queryKey: ['flight-instances-upcoming'] });
    },
    onError: () => {
      setRouteMsg('Could not create route.');
    },
  });

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Schedules</h1>
      <Link className="nav-link" to="/admin">
        ← Admin
      </Link>

      {canLoadInstances && (
        <section className="stack card" aria-labelledby="upcoming-scheduled-heading">
          <h2 id="upcoming-scheduled-heading" className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
            Upcoming scheduled flights
          </h2>
          {upcomingLoading && <p className="muted" style={{ margin: 0 }}>Loading…</p>}
          {instancesMsg && (
            <p className="muted" style={{ margin: 0, color: 'var(--danger)' }}>
              {instancesMsg}
            </p>
          )}
          {upcomingData && upcomingData.total === 0 && !upcomingLoading && (
            <p className="muted" style={{ margin: 0 }}>No upcoming instances.</p>
          )}
          {upcomingData && upcomingData.items.length > 0 && (
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
              {upcomingData.items.map((row) => {
                const dep = new Date(row.departureAt);
                const label = dep.toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                const routeLine = row.flight
                  ? `${row.flight.flightNumber} ${row.flight.origin}–${row.flight.destination} · ${row.flight.airline.name}`
                  : row.instanceId;
                return (
                  <li
                    key={row.id}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                      <strong style={{ fontWeight: 600 }}>{routeLine}</strong>
                      <span className="muted" style={{ fontSize: '0.875rem', wordBreak: 'break-all' }}>
                        {label} · {row.instanceId} · {row.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {row.flight?.id && (
                        <Link className="btn btn-ghost" to={`/admin/flights/${row.flight.id}`} style={{ textDecoration: 'none' }}>
                          Route & staff
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--danger)', flexShrink: 0 }}
                        disabled={deleteInstanceM.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove scheduled flight ${row.instanceId} on ${label}? This cannot be undone.`,
                            )
                          ) {
                            return;
                          }
                          setInstancesMsg(null);
                          deleteInstanceM.mutate(row.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {upcomingData && (
            <PaginationBar
              page={upcomingData.page}
              totalPages={upcomingData.totalPages}
              total={upcomingData.total}
              pageSize={upcomingData.pageSize}
              disabled={upcomingLoading || deleteInstanceM.isPending}
              onPageChange={setUpcomingPage}
            />
          )}
        </section>
      )}

      {isLoading && <p className="muted" style={{ margin: 0 }}>Loading routes…</p>}

      {!isLoading && templates && templates.length > 0 && (
        <section className="stack card" aria-labelledby="routes-staff-heading">
          <h2 id="routes-staff-heading" className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
            Routes & staff
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Flight details, schedules context, and add staff logins for that airline (superadmin, senior associate,
            associate).
          </p>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  className="card btn btn-ghost"
                  to={`/admin/flights/${t.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {t.flightNumber} {t.origin}–{t.destination}
                  </span>
                  <span className="muted">{t.airline.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user?.airlineId && (
        <form
          className="stack card"
          onSubmit={(e) => {
            e.preventDefault();
            setRouteMsg(null);
            if (fn.trim() && originAirport?.value && destinationAirport?.value) createRouteM.mutate();
          }}
        >
          <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
            New route (your airline)
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Airports load from the same catalog as passenger search (API + Redis cache).
          </p>
          <label className="field">
            <span className="field-label">Flight number</span>
            <input className="input" value={fn} onChange={(e) => setFn(e.target.value)} placeholder="FB101" />
          </label>
          <div className="grid grid-2">
            <label className="field">
              <span className="field-label">Origin</span>
              <div className="rs-wrap">
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  loadOptions={loadAirports}
                  value={originAirport}
                  onChange={(v) => setOriginAirport(v)}
                  placeholder="Search airport…"
                  isClearable
                  styles={airportSelectStyles}
                />
              </div>
            </label>
            <label className="field">
              <span className="field-label">Destination</span>
              <div className="rs-wrap">
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  loadOptions={loadAirports}
                  value={destinationAirport}
                  onChange={(v) => setDestinationAirport(v)}
                  placeholder="Search airport…"
                  isClearable
                  styles={airportSelectStyles}
                />
              </div>
            </label>
          </div>
          <label className="field">
            <span className="field-label">Duration (minutes)</span>
            <input className="input" type="number" min={15} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={
              createRouteM.isPending ||
              !fn.trim() ||
              !originAirport?.value ||
              !destinationAirport?.value ||
              originAirport.value === destinationAirport.value
            }
          >
            Add route
          </button>
          {routeMsg && <p className="muted" style={{ margin: 0 }}>{routeMsg}</p>}
        </form>
      )}

      {user?.role === 'SUPERADMIN' && !user.airlineId && (
        <p className="muted" style={{ margin: 0 }}>
          Superadmin: create routes via API with <code>airlineId</code>, or use an airline staff account here.
        </p>
      )}

      <form
        className="stack card"
        onSubmit={(e) => {
          e.preventDefault();
          setScheduleMsg(null);
          if (flightId && scheduledDate) scheduleM.mutate();
        }}
      >
        <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
          New schedule
        </h2>
        <label className="field">
          <span className="field-label">Route</span>
          <select className="input" value={flightId} onChange={(e) => setFlightId(e.target.value)} required>
            <option value="">Choose…</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.flightNumber} {t.origin}–{t.destination} ({t.airline.name})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">Departure time (24h)</span>
            <input className="input" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} placeholder="09:30" />
          </label>
          <label className="field">
            <span className="field-label">First date</span>
            <input className="input" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
          </label>
        </div>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={isDaily} onChange={(e) => setIsDaily(e.target.checked)} />
          <span className="field-label" style={{ margin: 0 }}>
            Daily (364 days from first date; cron adds day 365)
          </span>
        </label>
        <button className="btn btn-primary" type="submit" disabled={scheduleM.isPending || !flightId}>
          Generate instances
        </button>
        {scheduleMsg && <p className="muted" style={{ margin: 0 }}>{scheduleMsg}</p>}
      </form>

      {canLoadInstances && flightId && (
        <section className="stack card" aria-labelledby="scheduled-flights-heading">
          <h2 id="scheduled-flights-heading" className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
            Scheduled flights (this route)
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Delete removes the leg from the schedule and search index if it has no bookings. Uses the same route as
            above.
          </p>
          {instancesLoading && <p className="muted" style={{ margin: 0 }}>Loading instances…</p>}
          {instancesMsg && (
            <p className="muted" style={{ margin: 0, color: 'var(--danger)' }}>
              {instancesMsg}
            </p>
          )}
          {routeInstancesData && routeInstancesData.total === 0 && !instancesLoading && (
            <p className="muted" style={{ margin: 0 }}>No instances yet for this route.</p>
          )}
          {routeInstancesData && routeInstancesData.items.length > 0 && (
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
              {routeInstancesData.items.map((row) => {
                const dep = new Date(row.departureAt);
                const label = dep.toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                return (
                  <li
                    key={row.id}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                      <strong style={{ fontWeight: 600 }}>{label}</strong>
                      <span className="muted" style={{ fontSize: '0.875rem', wordBreak: 'break-all' }}>
                        {row.instanceId} · {row.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', flexShrink: 0 }}
                      disabled={deleteInstanceM.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove scheduled flight ${row.instanceId} on ${label}? This cannot be undone.`,
                          )
                        ) {
                          return;
                        }
                        setInstancesMsg(null);
                        deleteInstanceM.mutate(row.id);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {routeInstancesData && (
            <PaginationBar
              page={routeInstancesData.page}
              totalPages={routeInstancesData.totalPages}
              total={routeInstancesData.total}
              pageSize={routeInstancesData.pageSize}
              disabled={instancesLoading || deleteInstanceM.isPending}
              onPageChange={setRouteInstancesPage}
            />
          )}
        </section>
      )}
    </main>
  );
}
