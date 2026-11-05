import { api } from './api';

export function searchMembers(query, signal) {
    return api(`/members/search?q=${encodeURIComponent(query)}`, { signal });
}

export function getMember(id, signal) {
    return api(`/members/${encodeURIComponent(id)}`, { signal });
}
