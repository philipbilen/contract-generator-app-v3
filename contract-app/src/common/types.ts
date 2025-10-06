import type { Dayjs } from 'dayjs';

export interface LicensorEntry {
  stageName?: string;
  legalName?: string;
  address?: string;
  email?: string;
}

export interface RoyaltyPartyEntry {
  displayName?: string;
  legalName?: string;
  role?: string;
  royaltyShare?: number;
  email?: string;
}

export interface LegacyArtistEntry {
  stageName?: string;
  legalName?: string;
  address?: string;
  email?: string;
  royaltyShare?: number;
  role?: string;
}

export interface AgreementDefaults {
  labelName?: string;
  labelLegalName?: string;
  labelAddress?: string;
  labelEmail?: string;
  labelSignatory?: string;
  distroPartner?: string;
  distroFee?: number;
  adaFee?: number;
  labelShare?: number;
  releaseTitle?: string;
  releaseDate?: string | null;
  releaseDateISO?: string | null;
  releaseUPC?: string;
  releaseISRC?: string;
  mainArtists?: string[];
  featuredArtists?: string[];
  licensors?: LicensorEntry[];
  royaltyParties?: RoyaltyPartyEntry[];
  /**
   * @deprecated legacy structure retained for backwards compatibility
   */
  artists?: LegacyArtistEntry[];
}

export interface AppConfig {
  agreementDefaults: AgreementDefaults;
  templateDirectory: string;
}

export interface AppConfigUpdate {
  agreementDefaults?: AgreementDefaults;
  templateDirectory?: string;
}

export interface Project {
  name: string;
  path: string;
  artists?: string;
}

/**
 * Data shape persisted to disk. Mirrors `AgreementDefaults` but represents the
 * authoritative project-level agreement state.
 */
export type PersistedAgreement = AgreementDefaults;

/**
 * Form-friendly representation with Dayjs support.
 */
export type FormAgreementValues = Omit<PersistedAgreement, 'releaseDate'> & {
  releaseDate?: Dayjs | null;
  royaltyParties?: Array<Omit<RoyaltyPartyEntry, 'royaltyShare'> & {
    royaltyShare?: number | null;
  }>;
};

/**
 * Presentation-friendly representation sent to the PDF pipeline. Mirrors the
 * persisted agreement shape but allows derived, human-readable fields.
 */
export interface PdfInput extends PersistedAgreement {
  releaseDateFormatted?: string | null;
}
