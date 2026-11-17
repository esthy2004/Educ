import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const RESTORE = process.env.EDUFLOW_SMOKE_RESTORE === '1';
const uniq = `SMOKE-${Date.now()}`;
let adminToken = '';
let backup = null;
const created = {
  years: [],
  terms: [],
  levels: [],
  classes: [],
  subjects: [],
  fees: [],
  expenses: [],
  discipline: [],
  timetable: [],
  staff: [],
  users: [],
  students: [],
  payments: [],
  attendance: [],
};

async function raw(method, path, { token = adminToken, body, allow = [200, 201, 204] } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!allow.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return { status: response.status, data: payload };
}

const get = async (path, token) => (await raw('GET', path, { token })).data;
const post = async (path, body, token) => (await raw('POST', path, { token, body })).data;
const put = async (path, body, token) => (await raw('PUT', path, { token, body })).data;
const patch = async (path, body, token) => (await raw('PATCH', path, { token, body })).data;
const del = async (path, token) => {
  await raw('DELETE', path, { token });
};

async function cleanup() {
  for (const id of created.payments) {
    try { await del(`/payments/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.attendance) {
    try { await del(`/attendance/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.students) {
    try { await del(`/students/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.discipline) {
    try { await del(`/discipline/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.timetable) {
    try { await del(`/timetable/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.users) {
    try { await del(`/users/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.staff) {
    try { await del(`/staff/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.fees) {
    try { await del(`/fees/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.expenses) {
    try { await del(`/expenses/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.subjects) {
    try { await del(`/academics/subjects/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.classes) {
    try { await del(`/academics/classes/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.terms) {
    try { await del(`/academics/terms/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.levels) {
    try { await del(`/academics/levels/${encodeURIComponent(id)}`); } catch {}
  }
  for (const id of created.years) {
    try { await del(`/academics/years/${encodeURIComponent(id)}`); } catch {}
  }
}

try {
  const login = await post('/auth/login', { username: 'admin', password: 'admin123' }, '');
  adminToken = login.token;
  assert(adminToken, 'login token missing');
  console.log('PASS login admin');

  const initialInfo = await get('/database');
  const exported = await get('/database/export');
  if (RESTORE) backup = exported;
  assert(
    exported.users.length > 0 &&
      exported.users.every((user) => /^(pbkdf2b?)\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(user.password)),
    'les mots de passe exportés ne sont pas hachés',
  );
  console.log(`PASS export ${initialInfo.counts.students} étudiants, ${initialInfo.counts.grades} notes, mots de passe hachés`);

  const overview = await get('/academics/overview');
  assert(
    overview.classes.length > 0 && overview.subjects.length > 0 && overview.terms.length > 0,
    'academic data missing',
  );
  const classId = overview.classes.find((schoolClass) => schoolClass.name.includes('6'))?.id ?? overview.classes[0].id;
  const subjectId = overview.subjects[0].id;
  const termId = overview.terms[0].id;
  const students = await get(`/students?classId=${encodeURIComponent(classId)}`);
  assert(students.length > 0, 'class students missing');
  const sampleStudent = students[0];

  const endpoints = [
    '/dashboard',
    '/students',
    `/students/${sampleStudent.id}`,
    `/students/${sampleStudent.id}/finance`,
    '/staff',
    '/staff/directory',
    '/academics/overview',
    '/academics/years',
    '/academics/terms',
    '/academics/levels',
    '/academics/classes',
    '/academics/subjects',
    '/academics/grades',
    `/academics/rankings?classId=${encodeURIComponent(classId)}&termId=${encodeURIComponent(termId)}`,
    `/academics/report-cards/${sampleStudent.id}?termId=${encodeURIComponent(termId)}`,
    `/attendance/session?classId=${encodeURIComponent(classId)}&date=2099-01-01`,
    '/attendance',
    `/timetable?classId=${encodeURIComponent(classId)}`,
    '/discipline',
    '/fees',
    '/invoices',
    '/invoices/open',
    '/payments',
    '/expenses',
    '/finance/cash-summary',
    '/settings',
    '/users',
    '/activities',
    '/database',
  ];
  for (const endpoint of endpoints) await raw('GET', endpoint);
  console.log(`PASS ${endpoints.length} endpoints GET`);

  const accountant = await post('/auth/login', { username: 'comptable', password: 'demo123' }, '');
  await raw('POST', '/students', {
    token: accountant.token,
    body: { firstName: 'X', lastName: 'Y', gender: 'F' },
    allow: [403],
  });
  const accountantFinance = await get('/finance/cash-summary', accountant.token);
  assert(typeof accountantFinance.totalIn === 'number', 'accountant finance data invalid');
  console.log('PASS permissions par rôle');

  const year = await post('/academics/years', {
    name: `${uniq} YEAR`,
    startDate: '2099-09-01',
    endDate: '2100-07-01',
    isActive: false,
  });
  created.years.push(year.id);
  const term = await post('/academics/terms', {
    name: `${uniq} TERM`,
    academicYearId: year.id,
    startDate: '2099-09-01',
    endDate: '2099-12-01',
    order: 1,
  });
  created.terms.push(term.id);
  const level = await post('/academics/levels', { name: `${uniq} LEVEL`, cycle: 'college', order: 99 });
  created.levels.push(level.id);
  const schoolClass = await post('/academics/classes', {
    name: `${uniq} CLASS`,
    levelId: level.id,
    academicYearId: year.id,
    room: 'SMOKE',
    capacity: 10,
    tuitionFee: 1000,
  });
  created.classes.push(schoolClass.id);
  const subject = await post('/academics/subjects', {
    name: `${uniq} SUBJECT`,
    code: uniq.slice(-12),
    coefficient: 1,
    levelIds: [level.id],
  });
  created.subjects.push(subject.id);
  console.log('PASS CRUD référentiel académique');

  const student = await post('/students', {
    firstName: 'Élève',
    lastName: uniq,
    gender: 'F',
    classId: schoolClass.id,
    status: 'actif',
    enrollmentDate: '2099-09-01',
    parentName: 'Parent Test',
    parentPhone: '+229 90 00 00 00',
  });
  created.students.push(student.id);
  const updatedStudent = await put(`/students/${student.id}`, { ...student, firstName: 'Élève Modifié' });
  assert.equal(updatedStudent.firstName, 'Élève Modifié', 'student update failed');
  const transferClass = overview.classes.find((candidate) => candidate.id !== schoolClass.id)?.id;
  if (transferClass) {
    await post(`/students/${student.id}/transfer`, {
      newClassId: transferClass,
      previousClassName: 'SMOKE',
      yearName: '2099-2100',
    });
    const afterTransfer = await get(`/students/${student.id}`);
    assert.equal(afterTransfer.classId, transferClass, 'student transfer failed');
  }
  console.log('PASS CRUD élève + transfert');

  const slot = await post('/timetable', {
    classId: transferClass ?? schoolClass.id,
    day: 7,
    start: '08:00',
    end: '09:00',
    subjectId: subject.id,
    teacherId: '',
    room: `SMOKE-${uniq}`,
  });
  assert.equal(slot.success, true, `timetable create failed: ${slot.message}`);
  created.timetable.push(slot.slot.id);
  const conflict = await post('/timetable', {
    classId: transferClass ?? schoolClass.id,
    day: 7,
    start: '08:30',
    end: '09:30',
    subjectId: subject.id,
    teacherId: '',
    room: `SMOKE-${uniq}`,
  });
  assert.equal(conflict.success, false, 'timetable conflict not detected');
  console.log('PASS emploi du temps + conflit');

  const attendance = await post('/attendance/session', {
    classId: transferClass ?? schoolClass.id,
    date: '2099-12-31',
    entries: [{ studentId: student.id, status: 'retard', minutesLate: 12, justification: '' }],
  });
  assert.equal(attendance, 1, 'attendance save failed');
  const session = await get(
    `/attendance/session?classId=${encodeURIComponent(transferClass ?? schoolClass.id)}&date=2099-12-31`,
  );
  const record = session.find((row) => row.student.id === student.id);
  assert(record?.recordId, 'attendance record missing');
  created.attendance.push(record.recordId);
  const justified = await patch(`/attendance/${record.recordId}/justify`, { justification: 'Motif test' });
  assert.equal(justified.status, 'justifie', 'attendance justify failed');
  console.log('PASS appel + justification');

  const savedGrades = await post('/academics/grades', {
    classId: transferClass ?? schoolClass.id,
    subjectId,
    termId: term.id,
    entries: [{ studentId: student.id, type: 'devoir', score: 15.5 }],
  });
  assert.equal(savedGrades, 1, 'grade save failed');
  const report = await get(`/academics/report-cards/${student.id}?termId=${encodeURIComponent(term.id)}`);
  assert(report.student.id === student.id && report.average > 0, 'report card invalid');
  console.log('PASS notes + bulletin');

  const fee = await post('/fees', {
    levelId: level.id,
    academicYearId: year.id,
    label: `${uniq} FRAIS`,
    amount: 5000,
    dueDate: '2099-10-01',
  });
  created.fees.push(fee.id);
  const feeUpdated = await put(`/fees/${fee.id}`, { ...fee, amount: 6000 });
  assert.equal(feeUpdated.amount, 6000, 'fee update failed');
  console.log('PASS frais scolaires');

  const expense = await post('/expenses', {
    label: `${uniq} DEPENSE`,
    category: 'Test',
    amount: 1234,
    date: '2099-09-15',
    method: 'espece',
    note: '',
  });
  created.expenses.push(expense.id);
  const expenseUpdated = await put(`/expenses/${expense.id}`, { label: `${uniq} DEPENSE MOD`, amount: 2345 });
  assert.equal(expenseUpdated.amount, 2345, 'expense update failed');
  console.log('PASS dépenses');

  const staff = await post('/staff', {
    firstName: 'Test',
    lastName: uniq,
    gender: 'M',
    role: 'teacher',
    email: `${uniq}@test.local`,
    hireDate: '2099-09-01',
    contractType: 'CDD',
    salary: 1000,
    status: 'actif',
    subjectIds: [subject.id],
    classIds: [schoolClass.id],
  });
  created.staff.push(staff.id);
  const staffUpdated = await put(`/staff/${staff.id}`, { ...staff, phone: '+229 91 00 00 00' });
  assert.equal(staffUpdated.phone, '+229 91 00 00 00', 'staff update failed');
  console.log('PASS personnel');

  const user = await post('/users', {
    name: 'Smoke User',
    username: uniq.toLowerCase(),
    email: `${uniq}@test.local`,
    password: 'secret123',
    role: 'teacher',
    phone: '',
    active: true,
  });
  created.users.push(user.id);
  const userLogin = await post('/auth/login', { username: uniq.toLowerCase(), password: 'secret123' }, '');
  assert(userLogin.user.id === user.id, 'new user login failed');
  await put(`/users/${user.id}`, { name: 'Smoke User Updated', active: true });
  console.log('PASS utilisateurs + connexion');

  const discipline = await post('/discipline', {
    studentId: student.id,
    date: '2099-09-20',
    type: 'observation',
    severity: 'faible',
    category: 'Test',
    description: 'Observation test',
    action: 'Aucune',
    status: 'ouvert',
  });
  created.discipline.push(discipline.id);
  const disciplineUpdated = await put(`/discipline/${discipline.id}`, { status: 'traite' });
  assert.equal(disciplineUpdated.status, 'traite', 'discipline update failed');
  console.log('PASS discipline');

  const openInvoices = await get('/invoices/open');
  const invoice = openInvoices.find((row) => row.balance > 0);
  if (invoice) {
    const otherStudent = (await get('/students')).find((item) => item.id !== invoice.student.id);
    if (otherStudent) {
      await raw('POST', '/payments', {
        body: {
          studentId: otherStudent.id,
          invoiceId: invoice.invoice.id,
          amount: 1,
          method: 'espece',
          date: '2099-09-21',
          note: 'Test incohérence',
        },
        allow: [400],
      });
      console.log('PASS rejet d’un paiement élève/facture incohérent');
    }
    const payment = await post('/payments', {
      studentId: invoice.student.id,
      invoiceId: invoice.invoice.id,
      amount: 1,
      method: 'espece',
      date: '2099-09-21',
      note: 'Test',
    });
    created.payments.push(payment.id);
    const paymentRow = await get(`/payments/${payment.id}`);
    assert.equal(paymentRow.amount, 1, 'payment read failed');
    console.log('PASS paiement + reçu');
  }

  const dbInfo = await get('/database');
  assert(dbInfo.engine === 'PostgreSQL', 'PostgreSQL engine not active');

  await cleanup();
  console.log('PASS nettoyage des données de test');

  if (RESTORE && backup) {
    await raw('POST', '/database/import', { body: { database: backup } });
    const restored = await get('/database');
    assert.deepEqual(restored.counts, initialInfo.counts, 'database restore mismatch');
    console.log('PASS restauration de la sauvegarde');
  }

  console.log('SMOKE OK');
} catch (error) {
  console.error('SMOKE FAILED:', error.message);
  await cleanup();
  if (RESTORE && backup) {
    try {
      await raw('POST', '/database/import', { body: { database: backup } });
      console.log('Base restaurée après échec.');
    } catch (restoreError) {
      console.error('RESTORE FAILED:', restoreError.message);
    }
  }
  process.exitCode = 1;
}
