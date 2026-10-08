function samePlacePart(left: string, right: string): boolean {
  return left.localeCompare(right, "sv-SE", { sensitivity: "base" }) === 0;
}

export function formatPlaceAddressWithCity(
  address?: string | null,
  city?: string | null,
  separator = " · ",
): string {
  const normalizedAddress = address?.trim() ?? "";
  const normalizedCity = city?.trim() ?? "";
  if (!normalizedAddress) return normalizedCity;
  if (!normalizedCity) return normalizedAddress;

  const finalAddressPart = normalizedAddress.split(",").at(-1)?.trim() ?? "";
  return samePlacePart(finalAddressPart, normalizedCity)
    ? normalizedAddress
    : `${normalizedAddress}${separator}${normalizedCity}`;
}
