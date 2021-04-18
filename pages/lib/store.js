import { writable } from 'svelte/store';

export const access_token = writable(localStorage.getItem("access_token") || "");