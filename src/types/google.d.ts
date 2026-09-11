declare namespace google.accounts.id {
  type CredentialResponse = { credential: string };
  type InitializeOptions = { client_id: string; callback: (response: CredentialResponse) => void };
  function initialize(options: InitializeOptions): void;
  function prompt(): void;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id } };
}
