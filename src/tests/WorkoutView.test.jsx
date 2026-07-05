import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import WorkoutView from '../components/WorkoutView';
import * as storage from '../utils/storage';
import { expect, test, vi, afterEach } from 'vitest';
import { AuthContext } from '../App';

afterEach(cleanup);

vi.mock('../utils/storage', () => ({
  saveWorkout: vi.fn(),
  getHistory: vi.fn(() => Promise.resolve([]))
}));

const mockUser = { uid: 'test-user-id' };

const renderWithContext = (ui) => {
  return render(
    <AuthContext.Provider value={mockUser}>
      {ui}
    </AuthContext.Provider>
  );
};

test('renders start workout button initially', async () => {
  renderWithContext(<WorkoutView workout={[]} onFinish={() => {}} />);
  expect(screen.getByText('Ready to sweat?')).toBeDefined();
  expect(screen.getByText('Start Workout')).toBeDefined();
  
  await waitFor(() => {
    expect(storage.getHistory).toHaveBeenCalledWith('test-user-id');
  });
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('starts workout and displays checklist', async () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', sets: 3 }];
  renderWithContext(<WorkoutView workout={workout} onFinish={() => {}} />);
  
  fireEvent.click(screen.getByText('Start Workout'));
  
  expect(screen.getByText('Active Workout')).toBeDefined();
  expect(screen.getByText('Push Up')).toBeDefined();
  expect(screen.getByText('Finish Workout')).toBeDefined();
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});

test('completes workout and calls saveWorkout', async () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', sets: 3 }];
  const onFinish = vi.fn();
  renderWithContext(<WorkoutView workout={workout} onFinish={onFinish} />);
  
  fireEvent.click(screen.getByText('Start Workout'));
  fireEvent.click(screen.getByText('Finish Workout'));
  
  await waitFor(() => {
    expect(storage.saveWorkout).toHaveBeenCalled();
  });
  expect(onFinish).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Loading history...')).toBeNull());
});
