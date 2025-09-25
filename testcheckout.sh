#!/bin/bash
# test-checkout.sh
# Hit your /api/billing/checkout endpoint locally with JWT and headers

JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OGQ1YTU0ZGFkNDAwYmNiNDM0OTkzOGMiLCJpYXQiOjE3NTg4MzE5NDksImV4cCI6MTc1OTQzNjc0OX0.Kvb7zevobPEq-SOC-KYiBPn26UfnXCb5b145vR5JnaQ"

# Replace with your actual test price ID from Stripe dashboard
PRICE_ID="price_1SBMJ5LV1NkgtKMpleoVeE6N"

# Generate a random UUID for idempotency
IDEMPOTENCY_KEY=$(uuidgen)

curl -i http://localhost:4000/api/billing/checkout \
  -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{\"priceId\":\"$PRICE_ID\"}"
