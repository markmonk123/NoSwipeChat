#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  CODESPACE_URL="https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  EXPORT_LINE="export CODESPACE_PUBLIC_URL=${CODESPACE_URL}"
  PROFILE_FILE="${HOME}/.bashrc"

  if grep -q "^export CODESPACE_PUBLIC_URL=" "${PROFILE_FILE}"; then
    sed -i "s|^export CODESPACE_PUBLIC_URL=.*$|${EXPORT_LINE}|" "${PROFILE_FILE}"
  else
    echo "${EXPORT_LINE}" >> "${PROFILE_FILE}"
  fi

  echo "Configured CODESPACE_PUBLIC_URL in ${PROFILE_FILE}"
  echo "CODESPACE_PUBLIC_URL=${CODESPACE_URL}"
else
  echo "Codespaces environment variables not found; skipping CODESPACE_PUBLIC_URL bootstrap."
fi

echo "Installing backend dependencies..."
npm --prefix backend install

echo "Installing frontend dependencies..."
npm --prefix frontend install

echo "Codespaces setup complete."
