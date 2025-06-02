import { atom } from 'nanostores';

interface Profile {
  username: string;
  avatar: string;
  email: string;
  id: string;
}

export const profileStore = atom<Profile | null>(null);

export const setProfile = (profile: Profile | null) => {
  profileStore.set(profile);
};
