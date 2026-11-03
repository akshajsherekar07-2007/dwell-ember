-- Dwell Ember: initial schema, PostgreSQL/Supabase.
-- Run once on a fresh Supabase database as the migration role.
-- Command functions, cron jobs and storage policies are implemented separately.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TYPE public.member_role AS ENUM ('owner', 'staff');
CREATE TYPE public.publication_state AS ENUM ('draft', 'pending_review', 'published', 'archived');
CREATE TYPE public.allocation_state AS ENUM
  ('invited', 'offered', 'held', 'booked', 'expired', 'released', 'cancelled', 'ended');
CREATE TYPE public.queue_state AS ENUM
  ('waiting', 'offered', 'converted', 'declined', 'expired', 'cancelled', 'closed');
CREATE TYPE public.plan_audience AS ENUM ('owner', 'student');
CREATE TYPE public.subscription_state AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE public.booking_state AS ENUM ('confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE public.delivery_state AS ENUM ('pending', 'leased', 'sent', 'failed');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  phone_e164 text CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role public.member_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  can_exceptionally_cancel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX memberships_user ON public.memberships(user_id, organization_id) WHERE active;

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('pg', 'hostel', 'shared_flat')),
  audience_policy text NOT NULL DEFAULT 'Owner policy to be provided',
  address_line text NOT NULL,
  locality text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  postal_code text NOT NULL CHECK (postal_code ~ '^[1-9][0-9]{5}$'),
  country_code char(2) NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  location extensions.geography(Point, 4326) NOT NULL,
  google_place_id text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (timezone = 'Asia/Kolkata'),
  monthly_price_from_paise bigint NOT NULL CHECK (monthly_price_from_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  publication public.publication_state NOT NULL DEFAULT 'draft',
  approved_at timestamptz,
  inventory_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  CHECK (publication <> 'published' OR approved_at IS NOT NULL)
);
CREATE INDEX properties_geo ON public.properties USING gist(location);
CREATE INDEX properties_discovery ON public.properties(city, locality, monthly_price_from_paise)
  WHERE publication = 'published';

CREATE TABLE public.property_staff (
  property_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY(property_id, user_id),
  FOREIGN KEY(property_id, organization_id) REFERENCES public.properties(id, organization_id),
  FOREIGN KEY(organization_id, user_id) REFERENCES public.memberships(organization_id, user_id)
);

CREATE TABLE public.floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(id, property_id),
  UNIQUE(property_id, label)
);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  floor_id uuid NOT NULL,
  label text NOT NULL,
  sharing_capacity integer NOT NULL CHECK (sharing_capacity BETWEEN 1 AND 30),
  monthly_price_paise bigint NOT NULL CHECK (monthly_price_paise >= 0),
  layout_x numeric NOT NULL DEFAULT 0,
  layout_y numeric NOT NULL DEFAULT 0,
  layout_width numeric NOT NULL DEFAULT 200 CHECK (layout_width > 0),
  layout_height numeric NOT NULL DEFAULT 160 CHECK (layout_height > 0),
  FOREIGN KEY(floor_id, property_id) REFERENCES public.floors(id, property_id),
  UNIQUE(id, property_id),
  UNIQUE(floor_id, label)
);

CREATE TABLE public.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  room_id uuid NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  blocked_reason text,
  archived_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  layout_x numeric NOT NULL DEFAULT 0,
  layout_y numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(room_id, property_id) REFERENCES public.rooms(id, property_id),
  UNIQUE(id, property_id),
  UNIQUE(room_id, label),
  CHECK (enabled OR nullif(btrim(blocked_reason), '') IS NOT NULL),
  CHECK (archived_at IS NULL OR NOT enabled)
);
CREATE INDEX beds_property_room ON public.beds(property_id, room_id);

CREATE TABLE public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL
);
CREATE TABLE public.property_amenities (
  property_id uuid NOT NULL REFERENCES public.properties(id),
  amenity_id uuid NOT NULL REFERENCES public.amenities(id),
  PRIMARY KEY(property_id, amenity_id)
);

CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  floor_id uuid,
  kind text NOT NULL CHECK (kind IN ('property_photo', 'layout_background')),
  bucket text NOT NULL CHECK (bucket IN ('property-photos', 'floor-layouts', 'quarantine')),
  object_path text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  alt_text text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket, object_path),
  FOREIGN KEY(floor_id, property_id) REFERENCES public.floors(id, property_id),
  CHECK (kind <> 'layout_background' OR bucket IN ('floor-layouts', 'quarantine'))
);
CREATE INDEX media_property ON public.media(property_id, kind);

CREATE TABLE public.saved_properties (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, property_id)
);

-- API sends one-use account-bound tokens; only their digest is persisted.
CREATE TABLE public.bed_access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL REFERENCES public.beds(id),
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE TABLE public.bed_access_grants (
  bed_id uuid NOT NULL REFERENCES public.beds(id),
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bed_id, student_id),
  CHECK (expires_at > created_at)
);

CREATE SEQUENCE public.queue_position_seq;
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL,
  property_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  position_seq bigint NOT NULL DEFAULT nextval('public.queue_position_seq') UNIQUE,
  state public.queue_state NOT NULL DEFAULT 'waiting',
  close_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(bed_id, property_id) REFERENCES public.beds(id, property_id),
  UNIQUE(id, bed_id, student_id)
);
CREATE UNIQUE INDEX waitlist_one_live_student_bed ON public.waitlist_entries(bed_id, student_id)
  WHERE state IN ('waiting', 'offered');
CREATE INDEX waitlist_fifo ON public.waitlist_entries(bed_id, position_seq) WHERE state = 'waiting';
CREATE INDEX waitlist_student_live ON public.waitlist_entries(student_id) WHERE state IN ('waiting', 'offered');

CREATE TABLE public.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL,
  property_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  waitlist_entry_id uuid,
  source text NOT NULL CHECK (source IN ('owner_invitation', 'waitlist')),
  state public.allocation_state NOT NULL,
  hold_duration_seconds integer NOT NULL DEFAULT 172800
    CHECK (hold_duration_seconds BETWEEN 3600 AND 172800),
  accepted_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  created_by uuid REFERENCES public.profiles(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(bed_id, property_id) REFERENCES public.beds(id, property_id),
  FOREIGN KEY(waitlist_entry_id, bed_id, student_id)
    REFERENCES public.waitlist_entries(id, bed_id, student_id),
  UNIQUE(id, bed_id, student_id),
  CHECK ((source = 'waitlist') = (waitlist_entry_id IS NOT NULL)),
  CHECK ((state IN ('invited', 'offered', 'held')) = (expires_at IS NOT NULL)),
  CHECK (state <> 'invited' OR source = 'owner_invitation'),
  CHECK (state <> 'offered' OR source = 'waitlist'),
  CHECK (state NOT IN ('held', 'booked', 'ended') OR accepted_at IS NOT NULL),
  CHECK (state NOT IN ('invited', 'offered') OR accepted_at IS NULL),
  CHECK (state <> 'held' OR expires_at = accepted_at + hold_duration_seconds * interval '1 second'),
  CHECK (state NOT IN ('invited', 'offered') OR expires_at = created_at + interval '2 hours'),
  CHECK ((state IN ('expired', 'released', 'cancelled', 'ended')) = (closed_at IS NOT NULL)),
  CHECK (state <> 'cancelled' OR nullif(btrim(close_reason), '') IS NOT NULL),
  CHECK (source <> 'waitlist' OR hold_duration_seconds = 172800)
);
CREATE UNIQUE INDEX allocations_one_active_per_bed ON public.allocations(bed_id)
  WHERE state IN ('invited', 'offered', 'held', 'booked');
CREATE UNIQUE INDEX allocations_one_pending_per_student ON public.allocations(student_id)
  WHERE state IN ('invited', 'offered', 'held');
CREATE UNIQUE INDEX allocations_one_offer_per_entry ON public.allocations(waitlist_entry_id)
  WHERE waitlist_entry_id IS NOT NULL;
CREATE INDEX allocations_due ON public.allocations(expires_at, bed_id)
  WHERE state IN ('invited', 'offered', 'held');
CREATE INDEX allocations_subject_history ON public.allocations(student_id, created_at DESC);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL UNIQUE,
  bed_id uuid NOT NULL,
  student_id uuid NOT NULL,
  state public.booking_state NOT NULL DEFAULT 'confirmed',
  move_in_date date NOT NULL,
  agreed_monthly_price_paise bigint NOT NULL CHECK (agreed_monthly_price_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  offline_reference text,
  confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(allocation_id, bed_id, student_id) REFERENCES public.allocations(id, bed_id, student_id),
  CHECK ((state IN ('checked_out', 'cancelled')) = (ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX bookings_one_open_bed ON public.bookings(bed_id) WHERE state IN ('confirmed', 'checked_in');

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  audience public.plan_audience NOT NULL,
  price_paise bigint NOT NULL CHECK (price_paise > 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval = 'monthly'),
  provider_plan_id text UNIQUE,
  property_cap integer CHECK (property_cap > 0),
  bed_cap integer CHECK (bed_cap > 0),
  active boolean NOT NULL DEFAULT false,
  UNIQUE(id, audience)
);
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  audience public.plan_audience NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  organization_id uuid REFERENCES public.organizations(id),
  provider_subscription_id text NOT NULL UNIQUE,
  state public.subscription_state NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  paid_through timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  provider_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(plan_id, audience) REFERENCES public.plans(id, audience),
  CHECK ((audience = 'student' AND user_id IS NOT NULL AND organization_id IS NULL)
      OR (audience = 'owner' AND organization_id IS NOT NULL AND user_id IS NULL)),
  CHECK (paid_through IS NULL OR (period_start IS NOT NULL AND paid_through > period_start))
);
CREATE INDEX subscriptions_student_access ON public.subscriptions(user_id, paid_through) WHERE audience = 'student';
CREATE INDEX subscriptions_owner_access ON public.subscriptions(organization_id, paid_through) WHERE audience = 'owner';

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider = 'razorpay'),
  provider_event_id text NOT NULL UNIQUE,
  event_kind text NOT NULL,
  verified_payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  organization_id uuid REFERENCES public.organizations(id),
  subscription_id uuid REFERENCES public.subscriptions(id),
  purpose text NOT NULL CHECK (purpose IN ('owner_subscription', 'student_subscription', 'credit_pack')),
  provider_order_id text UNIQUE,
  provider_payment_id text UNIQUE,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  credit_quantity integer CHECK (credit_quantity > 0),
  state text NOT NULL CHECK (state IN ('created', 'captured', 'failed', 'partially_refunded', 'refunded')),
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose = 'credit_pack') = (credit_quantity IS NOT NULL)),
  CHECK (purpose <> 'owner_subscription' OR organization_id IS NOT NULL)
);

CREATE TABLE public.property_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until = valid_from + interval '720 hours')
);
CREATE INDEX entitlements_lookup ON public.property_entitlements(user_id, property_id, valid_until);

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('purchase', 'property_unlock', 'refund', 'support_correction')),
  payment_id uuid REFERENCES public.payments(id),
  entitlement_id uuid UNIQUE REFERENCES public.property_entitlements(id),
  fulfillment_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'purchase' OR (delta > 0 AND payment_id IS NOT NULL)),
  CHECK (reason <> 'property_unlock' OR (delta = -1 AND entitlement_id IS NOT NULL)),
  CHECK (reason <> 'refund' OR (delta < 0 AND payment_id IS NOT NULL))
);
CREATE UNIQUE INDEX credit_purchase_once ON public.credit_ledger(payment_id) WHERE reason = 'purchase';
CREATE INDEX credit_wallet_sum ON public.credit_ledger(user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  kind text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  dedup_key text NOT NULL UNIQUE,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox ON public.notifications(user_id, created_at DESC);

CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_kind text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedup_key text NOT NULL UNIQUE,
  state public.delivery_state NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((state = 'leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (state <> 'leased' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX outbox_due ON public.outbox_events(next_attempt_at, created_at) WHERE state IN ('pending', 'leased');

CREATE TABLE public.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid NOT NULL REFERENCES public.outbox_events(id),
  notification_id uuid REFERENCES public.notifications(id),
  channel text NOT NULL CHECK (channel IN ('email', 'realtime', 'sms', 'whatsapp')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_message_id text,
  result text NOT NULL CHECK (result IN ('accepted', 'delivered', 'bounced', 'failed', 'skipped_stale')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outbox_event_id, channel, attempt_number)
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  property_id uuid REFERENCES public.properties(id),
  actor_id uuid REFERENCES public.profiles(id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'admin', 'worker')),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_resource ON public.audit_events(resource_type, resource_id, created_at DESC);

CREATE TABLE public.idempotency_requests (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  operation text NOT NULL,
  key text NOT NULL CHECK (length(key) BETWEEN 8 AND 128),
  request_hash text NOT NULL,
  response_status integer NOT NULL CHECK (response_status BETWEEN 200 AND 599),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id, operation, key),
  CHECK (expires_at > created_at)
);

-- Immutable records: correction creates a new ledger/audit row.
CREATE FUNCTION public.reject_record_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'immutable_record' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_credit_ledger BEFORE UPDATE OR DELETE ON public.credit_ledger
FOR EACH ROW EXECUTE FUNCTION public.reject_record_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.reject_record_change();

-- Defer color computation until canonical reads; no writable bed.status column.
-- Expired active rows still block new inserts until reconciliation closes them.
CREATE FUNCTION public.is_property_operator(p_property_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.memberships m ON m.organization_id = p.organization_id
    JOIN public.profiles u ON u.id = m.user_id AND u.active
    WHERE p.id = p_property_id AND m.user_id = auth.uid() AND m.active
      AND (m.role = 'owner' OR EXISTS (
        SELECT 1 FROM public.property_staff s WHERE s.property_id = p.id AND s.user_id = m.user_id
      ))
  );
$$;

CREATE FUNCTION public.has_property_details(p_property_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.is_property_operator(p_property_id) OR (
    EXISTS(SELECT 1 FROM public.profiles u WHERE u.id = auth.uid() AND u.active)
    AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id = p_property_id AND p.publication = 'published')
    AND (
      EXISTS(SELECT 1 FROM public.property_entitlements e
        WHERE e.user_id = auth.uid() AND e.property_id = p_property_id
          AND e.valid_from <= now() AND e.valid_until > now())
      OR EXISTS(SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = auth.uid() AND s.audience = 'student'
          AND s.state IN ('active', 'cancelled', 'past_due')
          AND s.period_start <= now() AND s.paid_through > now())
    )
  );
$$;

REVOKE ALL ON FUNCTION public.reject_record_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_property_operator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_property_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_property_operator(uuid), public.has_property_details(uuid) TO authenticated;

-- Every application table uses RLS. Lack of a policy means deny-by-default.
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (
      'profiles','organizations','memberships','properties','property_staff','floors','rooms','beds',
      'amenities','property_amenities','media','saved_properties','bed_access_invitations','bed_access_grants',
      'waitlist_entries','allocations','bookings','plans','subscriptions','payment_events','payments',
      'property_entitlements','credit_ledger','notifications','outbox_events','delivery_attempts',
      'audit_events','idempotency_requests'
    )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
  END LOOP;
END;
$$;

-- Only narrow reads are exposed. Profile write/notification read-status commands
-- also go through validated server command functions; no general client DML grants.
GRANT SELECT ON public.profiles, public.floors, public.rooms, public.beds TO authenticated;
CREATE POLICY profiles_own_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY floors_details_read ON public.floors FOR SELECT TO authenticated USING (public.has_property_details(property_id));
CREATE POLICY rooms_details_read ON public.rooms FOR SELECT TO authenticated USING (public.has_property_details(property_id));
CREATE POLICY beds_details_read ON public.beds FOR SELECT TO authenticated USING (public.has_property_details(property_id));

-- Public discovery is served through a minimal API projection, NOT table SELECT.
-- Personal allocations/queues likewise use narrow API DTOs, not raw PII tables.
REVOKE ALL ON SEQUENCE public.queue_position_seq FROM PUBLIC, anon, authenticated;

COMMIT;
