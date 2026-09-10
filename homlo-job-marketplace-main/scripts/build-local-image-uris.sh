#!/usr/bin/env bash
set -euo pipefail

output="lib/local-image-uris.ts"
printf '%s\n' 'export const localImageUris: Record<string, string> = {' > "$output"

while IFS='|' read -r id filename; do
  encoded="$(base64 -w0 "assets/images/${filename}")"
  printf '  "%s": "data:image/jpeg;base64,%s",\n' "$id" "$encoded" >> "$output"
done <<'IMAGES'
restaurant-server|restaurant-server.jpg
retail-assistant|retail-assistant.jpg
social-media-specialist|social-media-specialist.jpg
kitchen-assistant|kitchen-assistant.jpg
teaching-assistant|teaching-assistant.jpg
event-staff|event-staff.jpg
growth-marketing-intern|growth-marketing-intern.jpg
business-development-intern|business-development-intern.jpg
guest-relations-officer|guest-relations-officer.jpg
customer-support-rep|customer-support-rep.jpg
IMAGES

printf '%s\n' '};' >> "$output"
