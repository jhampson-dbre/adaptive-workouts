import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import WorkoutView from '../components/WorkoutView';
import * as storage from '../utils/storage';
import { expect, test, vi, afterEach } from 'vitest';

afterEach(cleanup);

vi.mock('../utils/storage', () => ({
  saveWorkout: vi.fn()
}));

test('renders start workout button initially', () => {
  render(<WorkoutView workout={[]} onFinish={() => {}} />);
  expect(screen.getByText('Ready to sweat?')).toBeDefined();
  expect(screen.getByText('Start Workout')).toBeDefined();
});

test('starts workout and displays checklist', () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', sets: 3 }];
  render(<WorkoutView workout={workout} onFinish={() => {}} />);
  
  fireEvent.click(screen.getByText('Start Workout'));
  
  expect(screen.getByText('Active Workout')).toBeDefined();
  expect(screen.getByText('Push Up')).toBeDefined();
  expect(screen.getByText('Finish Workout')).toBeDefined();
});

test('completes workout and calls saveWorkout', () => {
  const workout = [{ id: '1', name: 'Push Up', muscleGroup: 'chest', sets: 3 }];
  const onFinish = vi.fn();
  render(<WorkoutView workout={workout} onFinish={onFinish} />);
  
  fireEvent.click(screen.getByText('Start Workout'));
  fireEvent.click(screen.getByText('Finish Workout'));
  
  expect(storage.saveWorkout).toHaveBeenCalled();
  expect(onFinish).toHaveBeenCalled();
});
