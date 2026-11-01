type DriverChoice = { display_name: string; public_name?: string | null; gamertag?: string | null };

// Selections and confirmations identify people by ID; names are presentation only.
export function driverChoiceLabel(driver: DriverChoice | null | undefined): string {
  if (!driver) return '—';
  const name = driver.public_name?.trim() || driver.display_name.trim();
  const tag = driver.gamertag?.trim();
  return tag && tag.toLocaleLowerCase() !== name.toLocaleLowerCase() ? `${name} · ${tag}` : name;
}
