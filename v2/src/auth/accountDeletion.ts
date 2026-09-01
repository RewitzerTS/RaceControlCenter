export const ACCOUNT_DELETION_FUNCTION = 'delete-racevora-account';

export function isAccountDeletionConfirmed(value: string, accountEmail: string | null | undefined): boolean {
  const normalizedEmail = accountEmail?.trim().toLowerCase() ?? '';
  return normalizedEmail.length > 0 && value.trim().toLowerCase() === normalizedEmail;
}
