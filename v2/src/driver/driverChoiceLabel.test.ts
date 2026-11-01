import { expect, it } from 'vitest';
import { driverChoiceLabel } from './driverChoiceLabel';

it('distinguishes equal public names using their gamertags', () => {
  expect(driverChoiceLabel({ display_name: 'Old A', public_name: 'Jakob', gamertag: 'JakobNbdg' })).toBe('Jakob · JakobNbdg');
  expect(driverChoiceLabel({ display_name: 'Jakob', gamertag: 'SecondJakob' })).toBe('Jakob · SecondJakob');
});
it('respects the public label without repeating a publicly chosen gamertag', () => {
  expect(driverChoiceLabel({ display_name: 'Private historical label', public_name: ' SecondJakob ', gamertag: 'secondjakob' })).toBe('SecondJakob');
  expect(driverChoiceLabel({ display_name: 'George Russell', gamertag: null })).toBe('George Russell');
  expect(driverChoiceLabel(undefined)).toBe('—');
});
