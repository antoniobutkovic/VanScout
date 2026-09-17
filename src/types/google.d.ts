declare namespace google.accounts.id {
  type CredentialResponse = { credential: string };
  type InitializeOptions = { client_id: string; callback: (response: CredentialResponse) => void; ux_mode?: "popup" | "redirect"; use_fedcm_for_button?: boolean };
  type ButtonOptions = { type: "standard" | "icon"; theme?: "outline" | "filled_blue" | "filled_black"; size?: "small" | "medium" | "large"; text?: "signin_with" | "signup_with" | "continue_with" | "signin"; shape?: "rectangular" | "pill" | "circle" | "square"; logo_alignment?: "left" | "center"; width?: number; locale?: string };
  function initialize(options: InitializeOptions): void;
  function renderButton(parent: HTMLElement, options: ButtonOptions): void;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id } };
}
