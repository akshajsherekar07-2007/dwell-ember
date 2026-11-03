/* Meaningful schema checks; no claim of implemented allocation workflows.
 * Uses the ephemeral PostgreSQL instance supplied by validate_technical.cjs.
 */
const assert = require('node:assert/strict');

module.exports = async function verify(db) {
  let checks = 0;
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
  const scalar = async sql => (await db.query(sql)).rows[0].value;
  const rejects = async (sql, code, label) => {
    await assert.rejects(() => db.query(sql), e => e.code === code, label);
    checks++;
  };
  const asUser = async n => {
    await db.exec('RESET ROLE; SET ROLE authenticated;');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id(n)]);
  };
  const reset = () => db.exec('RESET ROLE');

  await db.exec(`
    INSERT INTO auth.users(id,email_confirmed_at) VALUES
      ('${id(1)}',now()),('${id(2)}',now()),('${id(3)}',now()),('${id(4)}',now());
    INSERT INTO public.profiles(id,display_name) VALUES
      ('${id(1)}','Owner A'),('${id(2)}','Student A'),('${id(3)}','Owner B'),('${id(4)}','Staff A');
    INSERT INTO public.organizations(id,name,created_by) VALUES
      ('${id(10)}','Org A','${id(1)}'),('${id(11)}','Org B','${id(3)}');
    INSERT INTO public.memberships(organization_id,user_id,role) VALUES
      ('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(4)}','staff'),('${id(11)}','${id(3)}','owner');
    INSERT INTO public.properties(id,organization_id,name,slug,category,address_line,locality,city,region,postal_code,location,monthly_price_from_paise,publication,approved_at) VALUES
      ('${id(20)}','${id(10)}','Property A','property-a','pg','Sample address A','Locality','Bengaluru','Karnataka','560001',extensions.st_geogfromtext('SRID=4326;POINT(77.59 12.97)'),500000,'published',now()),
      ('${id(21)}','${id(11)}','Property B','property-b','hostel','Sample address B','Locality','Bengaluru','Karnataka','560001',extensions.st_geogfromtext('SRID=4326;POINT(77.60 12.98)'),600000,'published',now());
    INSERT INTO public.floors(id,property_id,label) VALUES
      ('${id(30)}','${id(20)}','First'),('${id(31)}','${id(21)}','First');
    INSERT INTO public.rooms(id,property_id,floor_id,label,sharing_capacity,monthly_price_paise) VALUES
      ('${id(40)}','${id(20)}','${id(30)}','A1',4,500000),
      ('${id(41)}','${id(21)}','${id(31)}','B1',2,600000);
    INSERT INTO public.beds(id,property_id,room_id,label) VALUES
      ('${id(50)}','${id(20)}','${id(40)}','A'),('${id(51)}','${id(20)}','${id(40)}','B'),
      ('${id(52)}','${id(20)}','${id(40)}','C'),('${id(53)}','${id(21)}','${id(41)}','A');
    INSERT INTO public.property_staff(property_id,organization_id,user_id) VALUES
      ('${id(20)}','${id(10)}','${id(4)}');
  `);
  equal(await scalar("SELECT count(*)::int AS value FROM public.beds"), 4, 'fixtures applied');
  equal(await scalar("SELECT count(*)::int AS value FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys' AND rowsecurity"), 28, 'all application tables use RLS');
  equal(await scalar(`SELECT extensions.st_dwithin(p.location,q.location,2000) AS value FROM public.properties p CROSS JOIN public.properties q WHERE p.id='${id(20)}' AND q.id='${id(21)}'`), true, 'actual PostGIS geography/radius works');

  await rejects(`INSERT INTO public.beds(property_id,room_id,label) VALUES ('${id(21)}','${id(40)}','Wrong tenant')`, '23503', 'cross-property bed is rejected');
  await rejects(`INSERT INTO public.property_staff(property_id,organization_id,user_id) VALUES ('${id(21)}','${id(10)}','${id(4)}')`, '23503', 'cross-tenant staff assignment is rejected');
  await rejects(`UPDATE public.beds SET enabled=false WHERE id='${id(50)}'`, '23514', 'disabled bed requires reason');
  await rejects(`UPDATE public.beds SET archived_at=now() WHERE id='${id(50)}'`, '23514', 'archived bed cannot stay enabled');

  const invitation = (allocation, bed, student, extraHours = 0) => `INSERT INTO public.allocations
    (id,bed_id,property_id,student_id,source,state,created_at,expires_at) VALUES
    ('${id(allocation)}','${id(bed)}','${id(20)}','${id(student)}','owner_invitation','invited',
     '2026-11-02T08:00:00Z','2026-11-02T${String(10 + extraHours).padStart(2, '0')}:00:00Z')`;
  await db.query(invitation(60, 50, 2));
  equal(await scalar(`SELECT state::text AS value FROM public.allocations WHERE id='${id(60)}'`), 'invited', 'valid invitation accepted');
  await rejects(invitation(61, 50, 3), '23505', 'one active allocation per bed');
  await rejects(invitation(61, 51, 2), '23505', 'one pending commitment per student');
  await rejects(invitation(61, 51, 3, 1), '23514', 'invitation acceptance window must be two hours');
  await db.query(`UPDATE public.allocations SET state='held',accepted_at='2026-11-02T08:30:00Z',expires_at='2026-11-04T08:30:00Z' WHERE id='${id(60)}'`);
  equal(await scalar(`SELECT extract(epoch FROM expires_at-accepted_at)::int AS value FROM public.allocations WHERE id='${id(60)}'`), 172800, '48h deadline stored accurately');
  await rejects(`UPDATE public.allocations SET expires_at=expires_at+interval '1 hour' WHERE id='${id(60)}'`, '23514', 'deadline must match accepted duration');
  await rejects(`UPDATE public.allocations SET hold_duration_seconds=172801 WHERE id='${id(60)}'`, '23514', 'hold cannot exceed 48h');

  await db.query(`INSERT INTO public.waitlist_entries(id,bed_id,property_id,student_id) VALUES ('${id(70)}','${id(50)}','${id(20)}','${id(4)}')`);
  await rejects(`INSERT INTO public.waitlist_entries(bed_id,property_id,student_id) VALUES ('${id(50)}','${id(20)}','${id(4)}')`, '23505', 'duplicate live queue membership rejected');
  await rejects(`INSERT INTO public.allocations(bed_id,property_id,student_id,waitlist_entry_id,source,state,created_at,expires_at) VALUES
    ('${id(52)}','${id(20)}','${id(3)}','${id(70)}','waitlist','offered','2026-11-02T08:00:00Z','2026-11-02T10:00:00Z')`, '23503', 'offer cannot reference another bed/student queue');
  await rejects(`INSERT INTO public.bookings(allocation_id,bed_id,student_id,move_in_date,agreed_monthly_price_paise,confirmed_by) VALUES
    ('${id(60)}','${id(50)}','${id(4)}','2026-11-05',500000,'${id(1)}')`, '23503', 'booking cannot change allocation subject');
  await db.exec(`UPDATE public.allocations SET state='booked',expires_at=NULL WHERE id='${id(60)}';
    INSERT INTO public.bookings(id,allocation_id,bed_id,student_id,move_in_date,agreed_monthly_price_paise,confirmed_by) VALUES
    ('${id(75)}','${id(60)}','${id(50)}','${id(2)}','2026-11-05',500000,'${id(1)}');`);
  await rejects(invitation(61, 50, 3), '23505', 'booked allocation still excludes another holder');

  await asUser(1);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 1, 'owner reads own property only');
  await asUser(3);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 1, 'other owner reads own property only');
  await asUser(4);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 1, 'assigned staff reads scoped property');
  await reset();
  await db.query(`UPDATE public.memberships SET active=false WHERE user_id='${id(4)}'`);
  await asUser(4);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 0, 'revoked staff loses detail access');
  await asUser(2);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 0, 'free student cannot read layouts despite own booking');
  await rejects('SELECT * FROM public.allocations', '42501', 'raw allocation data stays private');
  await rejects('SELECT * FROM public.credit_ledger', '42501', 'raw billing ledger stays private');
  await rejects(`UPDATE public.beds SET label='tamper'`, '42501', 'client cannot directly mutate bed');
  await reset();

  await db.query(`INSERT INTO public.property_entitlements(id,user_id,property_id,valid_from,valid_until) VALUES
    ('${id(80)}','${id(2)}','${id(20)}',now(),now()+interval '720 hours')`);
  await asUser(2);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 1, 'entitlement unlocks only one property');
  await reset();
  await db.query(`UPDATE public.profiles SET active=false WHERE id='${id(2)}'`);
  await asUser(2);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 0, 'inactive student loses paid detail access');
  await reset();
  await db.query(`UPDATE public.profiles SET active=false WHERE id='${id(1)}'`);
  await asUser(1);
  equal(await scalar('SELECT count(*)::int AS value FROM public.floors'), 0, 'inactive owner loses operator detail access');
  await reset();
  await db.query(`UPDATE public.profiles SET active=true`);

  await db.exec(`INSERT INTO public.payments(id,user_id,purpose,provider_payment_id,amount_paise,credit_quantity,state) VALUES
    ('${id(90)}','${id(2)}','credit_pack','pay_test_fixture',10000,10,'captured');
    INSERT INTO public.credit_ledger(id,user_id,delta,reason,payment_id,fulfillment_key) VALUES
    ('${id(91)}','${id(2)}',10,'purchase','${id(90)}','pay_test_fixture:credits');`);
  await rejects(`UPDATE public.credit_ledger SET delta=100 WHERE id='${id(91)}'`, '23514', 'ledger cannot be rewritten');
  await rejects(`DELETE FROM public.credit_ledger WHERE id='${id(91)}'`, '23514', 'ledger cannot be silently deleted');
  await rejects(`INSERT INTO public.credit_ledger(user_id,delta,reason,payment_id,fulfillment_key) VALUES
    ('${id(2)}',10,'purchase','${id(90)}','different-key')`, '23505', 'same captured payment cannot fund twice');
  await db.query(`INSERT INTO public.credit_ledger(user_id,delta,reason,entitlement_id,fulfillment_key) VALUES
    ('${id(2)}',-1,'property_unlock','${id(80)}','entitlement-80:debit')`);
  await rejects(`INSERT INTO public.credit_ledger(user_id,delta,reason,entitlement_id,fulfillment_key) VALUES
    ('${id(2)}',-1,'property_unlock','${id(80)}','entitlement-80:second-debit')`, '23505', 'one debit per entitlement');
  equal(await scalar(`SELECT sum(delta)::int AS value FROM public.credit_ledger WHERE user_id='${id(2)}'`), 9, 'wallet sums immutable entries');

  await db.query(`INSERT INTO public.audit_events(id,actor_kind,action,resource_type,resource_id,request_id) VALUES
    ('${id(100)}','worker','fixture','bed','${id(50)}','${id(101)}')`);
  await rejects(`DELETE FROM public.audit_events WHERE id='${id(100)}'`, '23514', 'audit history cannot be deleted');
  await rejects(`INSERT INTO public.outbox_events(event_kind,aggregate_type,aggregate_id,aggregate_version,dedup_key,lease_token) VALUES
    ('fixture','bed','${id(50)}',1,'bad-partial-lease','${id(102)}')`, '23514', 'outbox partial lease is invalid');
  await db.query(`INSERT INTO public.outbox_events(event_kind,aggregate_type,aggregate_id,aggregate_version,dedup_key) VALUES
    ('fixture','bed','${id(50)}',1,'fixture-unique-event')`);
  await rejects(`INSERT INTO public.outbox_events(event_kind,aggregate_type,aggregate_id,aggregate_version,dedup_key) VALUES
    ('fixture','bed','${id(50)}',1,'fixture-unique-event')`, '23505', 'outbox event intent deduplicates');

  console.log(`PASS: ${checks} PostgreSQL/PostGIS constraint, privacy and ledger assertions`);
};
