import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { TutorialCenter } from './TutorialCenter';

function renderCenter(props: Partial<React.ComponentProps<typeof TutorialCenter>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <I18nProvider>
        <TutorialCenter role="driver" userId="driver-1" {...props} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('TutorialCenter', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('opens on demand and starts the available role tour', () => {
    renderCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Open tutorials' }));
    expect(screen.getByRole('heading', { name: 'Get to know RaceVora' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(screen.getByRole('heading', { name: 'What matters next' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('offers the role-specific owner tour first', () => {
    renderCenter({ role: 'platform_owner' });
    fireEvent.click(screen.getByRole('button', { name: 'Open tutorials' }));
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Owner Control');
  });

  it('opens once after onboarding and reports when it obscures feedback', async () => {
    const onVisibilityChange = vi.fn();
    renderCenter({ autoOpen: true, onVisibilityChange });
    expect(await screen.findByRole('heading', { name: 'Get to know RaceVora' })).toBeInTheDocument();
    await waitFor(() => expect(onVisibilityChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: 'Close tutorials' }));
    await waitFor(() => expect(onVisibilityChange).toHaveBeenLastCalledWith(false));
    expect(localStorage.getItem('racevora.tutorial.v1.driver-1.intro')).toBe('true');
  });
});
