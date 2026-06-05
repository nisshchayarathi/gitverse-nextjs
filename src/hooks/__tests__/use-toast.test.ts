import { act, renderHook } from '@testing-library/react';

import { reducer, toast, useToast } from '../use-toast';

describe('useToast reducer', () => {
  const initialState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds a toast to the beginning of the list', () => {
      const toast = { id: '1', title: 'Test Toast', open: true };
      const action = { type: 'ADD_TOAST' as const, toast };
      const result = reducer(initialState, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('1');
    });

    it('limits toasts to TOAST_LIMIT (1)', () => {
      const state = {
        toasts: [{ id: '1', title: 'First', open: true }],
      };
      const newToast = { id: '2', title: 'Second', open: true };
      const action = { type: 'ADD_TOAST' as const, toast: newToast };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates an existing toast by id', () => {
      const state = {
        toasts: [{ id: '1', title: 'Original', open: true }],
      };
      const action = { type: 'UPDATE_TOAST' as const, toast: { id: '1', title: 'Updated' } };
      const result = reducer(state, action);
      expect(result.toasts[0].title).toBe('Updated');
    });

    it('does not modify other toasts', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };
      const action = { type: 'UPDATE_TOAST' as const, toast: { id: '1', title: 'Updated' } };
      const result = reducer(state, action);
      expect(result.toasts[1].title).toBe('Second');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open to false for a specific toast', () => {
      const state = {
        toasts: [{ id: '1', title: 'Test', open: true }],
      };
      const action = { type: 'DISMISS_TOAST' as const, toastId: '1' };
      const result = reducer(state, action);
      expect(result.toasts[0].open).toBe(false);
    });

    it('dismisses all toasts when toastId is undefined', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };
      const action = { type: 'DISMISS_TOAST' as const, toastId: undefined };
      const result = reducer(state, action);
      expect(result.toasts.every((t) => t.open === false)).toBe(true);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes a specific toast by id', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };
      const action = { type: 'REMOVE_TOAST' as const, toastId: '1' };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('removes all toasts when toastId is undefined', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };
      const action = { type: 'REMOVE_TOAST' as const, toastId: undefined };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(0);
    });
  });

  describe('dismiss timeout', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('removes dismissed toasts after the short cleanup delay', () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useToast());

      act(() => {
        const createdToast = toast({ title: 'Timed toast' });
        createdToast.dismiss();
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].open).toBe(false);

      act(() => {
        jest.advanceTimersByTime(999);
      });
      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.toasts).toHaveLength(0);
    });
  });
});
