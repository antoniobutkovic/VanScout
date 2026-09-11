declare namespace google.accounts.id {
  type CredentialResponse = { credential: string };
  type InitializeOptions = { client_id: string; callback: (response: CredentialResponse) => void };
  type PromptMomentNotification = { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; isDismissedMoment: () => boolean };
  function initialize(options: InitializeOptions): void;
  function prompt(callback?: (notification: PromptMomentNotification) => void): void;
}

interface Window {
  google?: { accounts: { id: typeof google.accounts.id } };
}
