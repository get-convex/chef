import { atom } from 'nanostores';

interface Profile {
  username: string;
  avatar: string;
}

// Initialize with stored profile or defaults
const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('bolt_profile') : null;
const initialProfile: Profile = storedProfile
  ? JSON.parse(storedProfile)
  : {
      username: '',
      avatar: '',
    };

export const profileStore = atom<Profile>(initialProfile);

export const setProfile = (profile: Profile) => {
  profileStore.set(profile);
  localStorage.setItem('bolt_profile', JSON.stringify(profile));
};
