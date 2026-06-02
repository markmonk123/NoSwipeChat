const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const maxmind = require('maxmind');
const { isValidPhoneNumber } = require('./compliance');

const GEO_DB_PATH = path.resolve(__dirname, '../../GeoLite2-City_20251202/GeoLite2-City.mmdb');
const MAX_DISTANCE_MILES = Number(process.env.PHONE_VERIFICATION_MAX_DISTANCE_MILES || 25);
const PHONE_VERIFICATION_TOKEN_TTL = process.env.PHONE_VERIFICATION_TOKEN_TTL || '15m';
const PHONE_LINE_TYPE_FIELDS = 'line_type_intelligence';
const VOIP_LINE_TYPES = new Set([
  'non_fixed_voip',
  'nonFixedVoip',
  'voip',
  'fixed_voip',
  'fixedVoip',
  'personal'
]);

let maxmindReaderPromise;

const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const normalizeIp = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && value.startsWith('::ffff:')) {
    return value.slice(7);
  }

  return String(value).trim();
};

const isPrivateIpv4Range = (ip) => {
  const octets = ip.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 127) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
};

const isPrivateIp = (ip) => {
  if (!ip) {
    return true;
  }

  if (
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  ) {
    return true;
  }

  return isPrivateIpv4Range(ip);
};

const getClientIp = (req) => normalizeIp(req.ip || req.headers['x-real-ip'] || req.socket?.remoteAddress);

const getTwilioCredentials = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    throw createHttpError(
      503,
      'Phone verification is not configured',
      { missing: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'] }
    );
  }

  return { accountSid, authToken, verifyServiceSid };
};

const getVerificationSigningSecret = () =>
  process.env.PHONE_VERIFICATION_JWT_SECRET || process.env.JWT_SECRET;

const requiresIpGeoMatch = () => {
  if (typeof process.env.PHONE_VERIFICATION_REQUIRE_IP_GEO === 'string') {
    return process.env.PHONE_VERIFICATION_REQUIRE_IP_GEO !== 'false';
  }

  return process.env.NODE_ENV === 'production';
};

const buildTwilioAuth = () => {
  const { accountSid, authToken } = getTwilioCredentials();
  return {
    username: accountSid,
    password: authToken
  };
};

const getMaxmindReader = async () => {
  if (!maxmindReaderPromise) {
    maxmindReaderPromise = (async () => {
      if (!fs.existsSync(GEO_DB_PATH)) {
        throw createHttpError(503, 'GeoIP database file is missing');
      }

      return maxmind.open(GEO_DB_PATH);
    })();
  }

  return maxmindReaderPromise;
};

const getIpGeo = async (ip) => {
  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp || isPrivateIp(normalizedIp)) {
    return null;
  }

  const reader = await getMaxmindReader();
  const match = reader.get(normalizedIp);
  if (!Number.isFinite(match?.location?.latitude) || !Number.isFinite(match?.location?.longitude)) {
    return null;
  }

  return {
    latitude: match.location.latitude,
    longitude: match.location.longitude,
    accuracyRadiusKm: match.location.accuracy_radius || null,
    city: match.city?.names?.en || null,
    subdivision: match.subdivisions?.[0]?.names?.en || null,
    country: match.country?.names?.en || null
  };
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceMiles = (origin, target) => {
  const earthRadiusMiles = 3958.7613;
  const deltaLatitude = toRadians(target.latitude - origin.latitude);
  const deltaLongitude = toRadians(target.longitude - origin.longitude);
  const latitude1 = toRadians(origin.latitude);
  const latitude2 = toRadians(target.latitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) * Math.cos(latitude2) *
    Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
};

const normalizeDeviceLocation = (value) => {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const accuracy = Number(value?.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    capturedAt: value?.capturedAt ? new Date(value.capturedAt) : new Date()
  };
};

const requestVerificationCode = async (phoneNumber) => {
  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  if (!isValidPhoneNumber(normalizedPhoneNumber)) {
    throw createHttpError(400, 'Invalid phone number format');
  }

  const lookupResult = await lookupPhoneNumber(normalizedPhoneNumber);
  const lineType = getLineType(lookupResult);
  if (isVoipLineType(lineType)) {
    throw createHttpError(400, 'VOIP phone numbers are not allowed for account verification', {
      lineType
    });
  }

  const { verifyServiceSid } = getTwilioCredentials();
  const body = new URLSearchParams({
    To: normalizedPhoneNumber,
    Channel: 'sms'
  });

  await axios.post(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
    body.toString(),
    {
      auth: buildTwilioAuth(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
};

const lookupPhoneNumber = async (phoneNumber) => {
  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  const response = await axios.get(
    `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalizedPhoneNumber)}`,
    {
      auth: buildTwilioAuth(),
      params: {
        Fields: PHONE_LINE_TYPE_FIELDS
      }
    }
  );

  return response.data;
};

const getLineType = (lookupResult) => {
  const rawType = lookupResult?.line_type_intelligence?.type || lookupResult?.lineTypeIntelligence?.type;
  return rawType ? String(rawType).trim() : 'unknown';
};

const isVoipLineType = (lineType) => VOIP_LINE_TYPES.has(String(lineType || '').trim());

const verifyCodeWithTwilio = async (phoneNumber, code) => {
  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  const normalizedCode = String(code || '').trim();

  if (!normalizedCode) {
    throw createHttpError(400, 'Verification code is required');
  }

  const { verifyServiceSid } = getTwilioCredentials();
  const body = new URLSearchParams({
    To: normalizedPhoneNumber,
    Code: normalizedCode
  });

  const response = await axios.post(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
    body.toString(),
    {
      auth: buildTwilioAuth(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  if (response.data?.status !== 'approved') {
    throw createHttpError(400, 'Invalid verification code');
  }

  return response.data;
};

const ensurePhoneVerificationRiskChecks = async ({ req, phoneNumber, code, deviceLocation }) => {
  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  const normalizedDeviceLocation = normalizeDeviceLocation(deviceLocation);

  if (!normalizedDeviceLocation) {
    throw createHttpError(400, 'Current device location is required for phone verification');
  }

  await verifyCodeWithTwilio(normalizedPhoneNumber, code);

  const [lookupResult, ipGeo] = await Promise.all([
    lookupPhoneNumber(normalizedPhoneNumber),
    getIpGeo(getClientIp(req))
  ]);

  const lineType = getLineType(lookupResult);
  if (isVoipLineType(lineType)) {
    throw createHttpError(400, 'VOIP phone numbers are not allowed for account verification', {
      lineType
    });
  }

  if (!ipGeo) {
    if (requiresIpGeoMatch()) {
      throw createHttpError(400, 'Unable to verify IP geolocation for this signup request');
    }

    return {
      phoneNumber: normalizedPhoneNumber,
      lineType,
      distanceMiles: null,
      clientIp: getClientIp(req),
      ipGeo: null,
      deviceLocation: normalizedDeviceLocation,
      lookupResult
    };
  }

  const distanceMiles = calculateDistanceMiles(ipGeo, normalizedDeviceLocation);
  if (distanceMiles > MAX_DISTANCE_MILES) {
    throw createHttpError(
      400,
      'Phone verification location does not match the request IP location closely enough',
      { distanceMiles }
    );
  }

  return {
    phoneNumber: normalizedPhoneNumber,
    lineType,
    distanceMiles,
    clientIp: getClientIp(req),
    ipGeo,
    deviceLocation: normalizedDeviceLocation,
    lookupResult
  };
};

const buildPhoneVerificationToken = (payload) => {
  const signingSecret = getVerificationSigningSecret();
  if (!signingSecret) {
    throw createHttpError(500, 'Phone verification signing secret is not configured');
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${payload.clientIp}:${payload.phoneNumber}`)
    .digest('hex');

  return jwt.sign(
    {
      phoneNumber: payload.phoneNumber,
      lineType: payload.lineType,
      distanceMiles: payload.distanceMiles,
      clientIp: payload.clientIp,
      ipGeo: payload.ipGeo,
      deviceLocation: payload.deviceLocation,
      lookupSummary: {
        countryCode: payload.lookupResult?.country_code || payload.lookupResult?.countryCode || null,
        nationalFormat: payload.lookupResult?.national_format || payload.lookupResult?.nationalFormat || null
      },
      fingerprint
    },
    signingSecret,
    {
      expiresIn: PHONE_VERIFICATION_TOKEN_TTL,
      audience: 'phone-verification',
      issuer: 'noswipechat'
    }
  );
};

const verifyPhoneVerificationToken = ({ token, req, phoneNumber }) => {
  if (!token) {
    throw createHttpError(400, 'Phone verification is required before account creation');
  }

  const signingSecret = getVerificationSigningSecret();
  if (!signingSecret) {
    throw createHttpError(500, 'Phone verification signing secret is not configured');
  }

  const decoded = jwt.verify(token, signingSecret, {
    audience: 'phone-verification',
    issuer: 'noswipechat'
  });

  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  if (normalizedPhoneNumber && decoded.phoneNumber !== normalizedPhoneNumber) {
    throw createHttpError(400, 'Phone verification token does not match the supplied phone number');
  }

  const currentIp = getClientIp(req);
  if (decoded.clientIp && currentIp && decoded.clientIp !== currentIp) {
    throw createHttpError(400, 'Phone verification token must be used from the same network request source');
  }

  return decoded;
};

const toUserPhoneVerificationContext = (verification) => ({
  lineType: verification.lineType,
  distanceMiles: verification.distanceMiles,
  clientIp: verification.clientIp,
  ipGeo: verification.ipGeo,
  deviceLocation: verification.deviceLocation,
  lookupSummary: {
    countryCode: verification.lookupSummary?.countryCode || verification.lookupResult?.country_code || verification.lookupResult?.countryCode || null,
    nationalFormat: verification.lookupSummary?.nationalFormat || verification.lookupResult?.national_format || verification.lookupResult?.nationalFormat || null
  },
  verifiedAt: new Date()
});

module.exports = {
  buildPhoneVerificationToken,
  createHttpError,
  ensurePhoneVerificationRiskChecks,
  getClientIp,
  requestVerificationCode,
  toUserPhoneVerificationContext,
  verifyPhoneVerificationToken
};