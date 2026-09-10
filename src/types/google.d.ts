declare namespace google.accounts.id {
  type CredentialResponse = { credential: string };
  type InitializeOptions = { client_id: string; callback: (response: CredentialResponse) => void };
  type RenderOptions = { theme?: string; size?: string; width?: number; text?: string };
  function initialize(options: InitializeOptions): void;
  function renderButton(parent: HTMLElement, options: RenderOptions): void;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id } };
}
