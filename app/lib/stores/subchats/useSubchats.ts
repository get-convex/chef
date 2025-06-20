import { useState, useEffect, useCallback } from 'react';
import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';

export interface Subchat {
  subchatIndex: number;
  description?: string;
}

export interface UseSubchatsResult {
  subchats: Subchat[];
  activeSubchatIndex: number;
  setActiveSubchatIndex: (index: number) => void;
  createSubchat: () => Promise<void>;
  isLoading: boolean;
  isCreating: boolean;
}

export function useSubchats(chatId: string): UseSubchatsResult {
  const convex = useConvex();
  const [subchats, setSubchats] = useState<Subchat[]>([]);
  const [activeSubchatIndex, setActiveSubchatIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load subchats
  useEffect(() => {
    const loadSubchats = async () => {
      try {
        setIsLoading(true);
        const sessionId = await waitForConvexSessionId('loadSubchats');
        const subchatList = await convex.query(api.subchats.get, {
          chatId,
          sessionId,
        });

        // Sort by subchatIndex to ensure correct order
        const sortedSubchats = subchatList.sort((a, b) => a.subchatIndex - b.subchatIndex);
        setSubchats(sortedSubchats);

        // If no active subchat is set and we have subchats, set to the first one
        if (sortedSubchats.length > 0) {
          const firstSubchatIndex = sortedSubchats[0].subchatIndex;
          if (activeSubchatIndex !== firstSubchatIndex) {
            setActiveSubchatIndex(firstSubchatIndex);
          }
        }
      } catch (error) {
        console.error('Error loading subchats:', error);
        toast.error('Failed to load chat history');
      } finally {
        setIsLoading(false);
      }
    };

    if (chatId) {
      void loadSubchats();
    }
  }, [convex, chatId]);

  const createSubchat = useCallback(async () => {
    try {
      setIsCreating(true);
      const sessionId = await waitForConvexSessionId('createSubchat');

      await convex.mutation(api.subchats.create, {
        chatId,
        sessionId,
      });

      // Reload subchats after creation
      const subchatList = await convex.query(api.subchats.get, {
        chatId,
        sessionId,
      });

      const sortedSubchats = subchatList.sort((a, b) => a.subchatIndex - b.subchatIndex);
      setSubchats(sortedSubchats);

      // Automatically switch to the newly created subchat
      if (sortedSubchats.length > 0) {
        const newSubchatIndex = sortedSubchats[sortedSubchats.length - 1].subchatIndex;
        setActiveSubchatIndex(newSubchatIndex);
      }

      toast.success('New chat feature created');
    } catch (error) {
      console.error('Error creating subchat:', error);
      toast.error('Failed to create new chat feature');
    } finally {
      setIsCreating(false);
    }
  }, [convex, chatId]);

  return {
    subchats,
    activeSubchatIndex,
    setActiveSubchatIndex,
    createSubchat,
    isLoading,
    isCreating,
  };
}
