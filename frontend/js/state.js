// Shared application state — all values are live bindings via ES module exports

export let currentUser = null;
export let adminSelected = null;
export let adminUsers = [];
export let adminTariffs = [];
export let connectionTypes = [];

export function setCurrentUser(user) { currentUser = user; }
export function setAdminSelected(user) { adminSelected = user; }
export function setAdminUsers(users) { adminUsers = users; }
export function setAdminTariffs(tariffs) { adminTariffs = tariffs; }
export function setConnectionTypes(types) { connectionTypes = types; }
