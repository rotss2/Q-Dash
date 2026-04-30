import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

export const getFingerprint = async (): Promise<string> => {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
};

export const getDeviceId = (): string => {
  // Fallback if fingerprint fails
  let deviceId = localStorage.getItem('q-dash-device-id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('q-dash-device-id', deviceId);
  }
  return deviceId;
};

export const getAnonymousUserId = async (): Promise<string> => {
  try {
    const fingerprint = await getFingerprint();
    return fingerprint;
  } catch {
    return getDeviceId();
  }
};
