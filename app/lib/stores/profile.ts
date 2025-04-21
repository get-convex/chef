import { atom } from 'nanostores';

interface Profile {
  username: string;
  avatar: string;
  email: string;
  id: string;
}

// Initialize with stored profile or defaults
const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('chef_profile') : null;
const initialProfile: Profile | null = storedProfile ? JSON.parse(storedProfile) : null;

export const profileStore = atom<Profile | null>(initialProfile);

export const setProfile = (profile: Profile | null) => {
  profileStore.set(profile);
  localStorage.setItem('chef_profile', JSON.stringify(profile));
};
