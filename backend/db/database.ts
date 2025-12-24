const DB_KEY = "ci-rerun-db";

export type User = {
  id: string;
  team: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  pat?: string;
};

export type DB = {
  teams: string[];
  users: User[];
};

const defaultDB: DB = {
  teams: ["Team 1", "Team 2", "Team 3"],
  users: []
};

export function loadDB(): DB {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : defaultDB;
}

export function saveDB(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
