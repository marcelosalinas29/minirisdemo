-- 1) Sobreturno acordado
alter table public.appointments add column if not exists sobreturno_acordado_con text;

-- 2) Excepciones de agenda por médico
create table if not exists public.doctor_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  kind text not null check (kind in ('block','open')),
  date_from date not null,
  date_to date not null,
  start_time text,
  end_time text,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint dse_dates_ok check (date_to >= date_from),
  constraint dse_open_has_hours check (kind = 'block' or (start_time is not null and end_time is not null))
);
alter table public.doctor_schedule_exceptions enable row level security;

drop policy if exists "Autenticados ven excepciones de agenda" on public.doctor_schedule_exceptions;
create policy "Autenticados ven excepciones de agenda" on public.doctor_schedule_exceptions
  for select to authenticated using (true);
drop policy if exists "Doctor o secretaria crean excepciones de agenda" on public.doctor_schedule_exceptions;
create policy "Doctor o secretaria crean excepciones de agenda" on public.doctor_schedule_exceptions
  for insert to authenticated with check (public.has_role(auth.uid(),'doctor'::app_role) or public.has_role(auth.uid(),'secretary'::app_role));
drop policy if exists "Doctor o secretaria editan excepciones de agenda" on public.doctor_schedule_exceptions;
create policy "Doctor o secretaria editan excepciones de agenda" on public.doctor_schedule_exceptions
  for update to authenticated using (public.has_role(auth.uid(),'doctor'::app_role) or public.has_role(auth.uid(),'secretary'::app_role));
drop policy if exists "Doctor o secretaria borran excepciones de agenda" on public.doctor_schedule_exceptions;
create policy "Doctor o secretaria borran excepciones de agenda" on public.doctor_schedule_exceptions
  for delete to authenticated using (public.has_role(auth.uid(),'doctor'::app_role) or public.has_role(auth.uid(),'secretary'::app_role));

create index if not exists dse_doctor_dates_idx on public.doctor_schedule_exceptions (doctor_id, date_from, date_to);

-- 3) Cantidad de turnos por estudio
create or replace function public.appt_time(t text) returns time
language plpgsql immutable set search_path = public as $$
begin
  return t::time;
exception when others then
  return null;
end $$;

create or replace function public.appt_slots_needed(_study text) returns int
language sql immutable set search_path = public as $$
  select case
    when exists (
      select 1 from regexp_split_to_table(upper(coalesce(_study,'')), '\s*\+\s*') as p(x)
      where trim(p.x) like '%PUNCIÓN%' or trim(p.x) like '%PUNCION%'
         or trim(p.x) like '%BIOPSIA%' or trim(p.x) like '%PAAF%' or trim(p.x) like '%TRUCUT%'
    ) then 3
    when exists (
      select 1 from regexp_split_to_table(upper(coalesce(_study,'')), '\s*\+\s*') as p(x)
      where trim(p.x) like '%DOPPLER%'
         or trim(p.x) like '%MORFOLÓGICA%' or trim(p.x) like '%MORFOLOGICA%'
         or trim(p.x) like '% TN%' or trim(p.x) like 'TN %' or trim(p.x) = 'TN'
         or trim(p.x) like '%SCAN FETAL%'
         or trim(p.x) like '%TEST DE FUNCIÓN ENDOTELIAL%' or trim(p.x) like '%TEST DE FUNCION ENDOTELIAL%'
    ) then 2
    else 1 end
$$;

-- 4) ¿Atiende este médico en ese día y horario?
create or replace function public.doctor_works_at(_doctor uuid, _date date, _time text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  t time := public.appt_time(_time);
begin
  if _doctor is null or t is null then return true; end if;
  if exists (select 1 from public.blocked_dates bd where bd.date = _date) then return false; end if;
  if exists (
    select 1 from public.doctor_schedule_exceptions e
    where e.doctor_id = _doctor and e.kind = 'block' and _date between e.date_from and e.date_to
      and (e.start_time is null or e.end_time is null
           or (t >= public.appt_time(e.start_time) and t < public.appt_time(e.end_time)))
  ) then return false; end if;
  return exists (
    select 1 from public.doctor_schedules s
    where s.doctor_id = _doctor and s.active and s.day_of_week = extract(dow from _date)::int
      and t >= public.appt_time(s.start_time) and t < public.appt_time(s.end_time)
  ) or exists (
    select 1 from public.doctor_schedule_exceptions e
    where e.doctor_id = _doctor and e.kind = 'open' and _date between e.date_from and e.date_to
      and t >= public.appt_time(e.start_time) and t < public.appt_time(e.end_time)
  );
end $$;

-- 5) Regla de agenda (última barrera), válida entre todos los médicos
create or replace function public.enforce_double_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_t time;
  v_slot time;
  v_n int;
  k int;
  v_hit text;
  v_hit_n int;
  v_doc text;
  v_avail text;
  v_msg text;
begin
  if NEW.status in ('cancelled','no-show') then return NEW; end if;
  if NEW.date < v_today then return NEW; end if;
  v_t := public.appt_time(NEW.time);
  if v_t is null then return NEW; end if;

  if TG_OP = 'UPDATE' then
    if OLD.date = NEW.date and OLD.time = NEW.time
       and OLD.study_type is not distinct from NEW.study_type
       and OLD.doctor_id is not distinct from NEW.doctor_id
       and OLD.es_sobreturno = NEW.es_sobreturno
       and OLD.status not in ('cancelled','no-show') then
      return NEW;
    end if;
  end if;

  if NEW.doctor_id is null then
    raise exception 'Hay que indicar el médico del turno.' using errcode = 'P0001';
  end if;

  if NEW.es_sobreturno then
    if not public.doctor_works_at(NEW.doctor_id, NEW.date, NEW.time)
       and coalesce(btrim(NEW.sobreturno_acordado_con), '') = '' then
      raise exception 'Este sobreturno cae fuera del horario del médico: hay que indicar con quién se acordó.' using errcode = 'P0001';
    end if;
    return NEW;
  end if;

  select b.time into v_hit from public.appointments b
   where b.date = NEW.date and b.id <> NEW.id
     and b.status not in ('cancelled','no-show') and not b.es_sobreturno
     and public.appt_time(b.time) = v_t
   limit 1;
  if v_hit is not null then
    raise exception 'Ese horario ya está ocupado. Elegí otro horario o usá Sobreturno.' using errcode = 'P0001';
  end if;

  v_hit := null;
  select b.time, public.appt_slots_needed(b.study_type) into v_hit, v_hit_n from public.appointments b
   where b.date = NEW.date and b.id <> NEW.id
     and b.status not in ('cancelled','no-show') and not b.es_sobreturno
     and public.appt_slots_needed(b.study_type) > 1
     and public.appt_time(b.time) < v_t
     and v_t < public.appt_time(b.time) + (public.appt_slots_needed(b.study_type) * interval '10 minutes')
   limit 1;
  if v_hit is not null then
    raise exception 'Las % es parte de un estudio de % turnos que empieza a las %. Elegí otro horario o usá Sobreturno.', to_char(v_t,'HH24:MI'), v_hit_n, v_hit using errcode = 'P0001';
  end if;

  v_n := public.appt_slots_needed(NEW.study_type);
  if v_n > 1 then
    for k in 1..(v_n - 1) loop
      v_slot := v_t + (k * interval '10 minutes');
      v_hit := null;
      select b.time into v_hit from public.appointments b
       where b.date = NEW.date and b.id <> NEW.id
         and b.status not in ('cancelled','no-show') and not b.es_sobreturno
         and (
           public.appt_time(b.time) = v_slot
           or (public.appt_slots_needed(b.study_type) > 1
               and public.appt_time(b.time) < v_slot
               and v_slot < public.appt_time(b.time) + (public.appt_slots_needed(b.study_type) * interval '10 minutes'))
         )
       limit 1;
      if v_hit is not null then
        raise exception 'Este estudio ocupa % turnos y el horario de las % ya está ocupado. Elegí otro horario.', v_n, to_char(v_slot,'HH24:MI') using errcode = 'P0001';
      end if;
    end loop;
  end if;

  for k in 0..(v_n - 1) loop
    v_slot := v_t + (k * interval '10 minutes');
    if not public.doctor_works_at(NEW.doctor_id, NEW.date, to_char(v_slot,'HH24:MI')) then
      select p.full_name into v_doc from public.profiles p where p.user_id = NEW.doctor_id;
      select string_agg(p.full_name, ' o ') into v_avail
        from public.profiles p join public.user_roles r on r.user_id = p.user_id and r.role = 'doctor'
       where public.doctor_works_at(p.user_id, NEW.date, to_char(v_slot,'HH24:MI'));
      v_msg := coalesce(v_doc, 'El médico') || ' no atiende ese día u horario (' || to_char(v_slot,'HH24:MI') || '). ';
      if v_avail is not null then
        v_msg := v_msg || 'A esa hora atiende: ' || v_avail || '. Elegí ese médico o usá Sobreturno.';
      else
        v_msg := v_msg || 'A esa hora no atiende ningún médico. Elegí otro horario o usá Sobreturno.';
      end if;
      raise exception '%', v_msg using errcode = 'P0001';
    end if;
  end loop;

  return NEW;
end $$;

drop trigger if exists enforce_double_slot_trigger on public.appointments;
create trigger enforce_double_slot_trigger
  before insert or update of study_type, date, time, status, doctor_id, es_sobreturno, sobreturno_acordado_con
  on public.appointments for each row execute function public.enforce_double_slot();