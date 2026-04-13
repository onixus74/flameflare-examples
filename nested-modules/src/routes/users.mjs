import { jsonResponse } from '../lib/response-helpers.mjs';

const USERS = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'member' },
  { id: 3, name: 'Charlie', role: 'viewer' },
];

export function handleUsers(request, env) {
  return jsonResponse({ users: USERS, count: USERS.length });
}